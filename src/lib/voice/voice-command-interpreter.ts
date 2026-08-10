import { AppError } from "@/lib/errors/app-error";
import type { DimensionInputDefinition } from "@/lib/calculations/required-dimensions-registry";
import type { VoiceCommandType } from "@/lib/voice/voice-types";

export type VoiceInterpreterContext =
  | { type: "DIMENSION_CALCULATION"; dimensions: DimensionInputDefinition[]; activeDimensionKey?: string }
  | { type: "BOQ_ITEM" }
  | { type: "BOQ_SECTION" };

export type VoiceAddItemDraft = {
  description: string;
  quantity: number;
  unit: string;
  itemCode?: string;
  unitCost?: number;
};

export type VoiceCommandIntent = {
  commandType: VoiceCommandType;
  field: "value" | "quantity" | "description" | "unit" | "notes" | "item";
  dimensionKey?: string;
  newValue: string | number;
  unit?: string;
  itemDraft?: VoiceAddItemDraft;
  warnings: string[];
  confidence?: number;
};

export interface NaturalLanguageVoiceInterpreter {
  interpret(transcript: string, context: VoiceInterpreterContext): Promise<VoiceCommandIntent | null>;
}

type DeterministicResult =
  | { status: "matched"; intent: VoiceCommandIntent }
  | { status: "ambiguous"; message: string }
  | { status: "unsupported"; message: string }
  | { status: "unrecognized" };

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .toLowerCase()
    .replace(/[^a-z0-9.%/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function camelCaseWords(value: string): string {
  return normalizeText(value.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
}

function numericValue(transcript: string): number | null {
  const connectorMatches = Array.from(transcript.matchAll(/\b(?:to|as|at|equals?)\s+(-?\d+(?:[.,]\d+)?)/gi));
  const selected = connectorMatches[connectorMatches.length - 1]?.[1];
  if (selected) return Number(selected.replace(",", "."));
  const all = Array.from(transcript.matchAll(/-?\d+(?:[.,]\d+)?/g));
  if (all.length !== 1) return null;
  return Number(all[0][0].replace(",", "."));
}

function labeledNumericValue(transcript: string, labels: string): number | null {
  const match = transcript.match(
    new RegExp(`\\b(?:${labels})\\b\\s*(?:to|as|of|at|equals?|=)?\\s*(-?\\d+(?:[.,]\\d+)?)`, "i"),
  );
  if (!match?.[1]) return null;
  return Number(match[1].replace(",", "."));
}

function textAfterConnector(transcript: string): string | null {
  const match = transcript.match(/\b(?:to|as)\s+(.+?)\s*$/i);
  const text = match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  return text || null;
}

function spokenUnit(transcript: string): string | null {
  const normalized = normalizeText(transcript);
  if (/\b(?:square metres?|square meters?|sqm|m2)\b/.test(normalized)) return "m2";
  if (/\b(?:cubic metres?|cubic meters?|cum|m3)\b/.test(normalized)) return "m3";
  if (/\b(?:percent|percentage)\b/.test(normalized) || transcript.includes("%")) return "%";
  if (/\b(?:kilograms?|kilos?|kg)\b/.test(normalized)) return "kg";
  if (/\b(?:metres?|meters?|m)\b/.test(normalized)) return "m";
  if (/\b(?:number|numbers|pieces?|pcs|nr)\b/.test(normalized)) return "nr";
  return null;
}

function aliasesForDimension(dimension: DimensionInputDefinition): string[] {
  const aliases = new Set([normalizeText(dimension.label), camelCaseWords(dimension.key)]);
  if (dimension.key === "wastagePercentage") aliases.add("wastage");
  if (dimension.key === "approvedAllowancePercentage") aliases.add("allowance");
  if (dimension.key === "approvedTerminationAllowance") aliases.add("termination allowance");
  if (dimension.key === "netFloorArea") aliases.add("floor area");
  if (dimension.key === "verifiedRouteLength") aliases.add("route length");
  if (dimension.key === "verifiedCount") aliases.add("count");
  return Array.from(aliases).filter(Boolean);
}

function parseDimensionCommand(
  transcript: string,
  context: Extract<VoiceInterpreterContext, { type: "DIMENSION_CALCULATION" }>,
): DeterministicResult {
  const normalized = normalizeText(transcript);
  const explicitMatches = context.dimensions.filter((dimension) =>
    aliasesForDimension(dimension).some((alias) => normalized.includes(alias)),
  );
  if (explicitMatches.length > 1) {
    return { status: "ambiguous", message: "The instruction refers to more than one dimension." };
  }
  let dimension: DimensionInputDefinition | undefined = explicitMatches[0];
  if (!dimension && context.activeDimensionKey) {
    dimension = context.dimensions.find((candidate) => candidate.key === context.activeDimensionKey);
  }
  if (!dimension) {
    if (/\b(?:change|set|update|make)\b/.test(normalized)) {
      return { status: "ambiguous", message: "The instruction does not identify which dimension to change." };
    }
    return { status: "unrecognized" };
  }
  const value = numericValue(transcript);
  if (value === null || !Number.isFinite(value)) {
    return { status: "ambiguous", message: "The instruction does not contain one clear numeric value." };
  }
  if (value < 0) return { status: "unsupported", message: "Negative measurement values are not supported." };
  const suppliedUnit = spokenUnit(transcript);
  if (suppliedUnit && suppliedUnit !== dimension.unit) {
    return {
      status: "ambiguous",
      message: `The spoken unit does not match ${dimension.label}'s required unit${dimension.unit ? ` (${dimension.unit})` : ""}.`,
    };
  }
  return {
    status: "matched",
    intent: {
      commandType: "SET_DIMENSION",
      field: "value",
      dimensionKey: dimension.key,
      newValue: value,
      ...(dimension.unit ? { unit: dimension.unit } : {}),
      warnings: [],
      confidence: 100,
    },
  };
}

const BOQ_FIELD_COMMANDS = {
  quantity: "SET_BOQ_QUANTITY",
  description: "SET_BOQ_DESCRIPTION",
  unit: "SET_BOQ_UNIT",
  notes: "SET_BOQ_NOTES",
} as const;

function deleteBoqItemResult(): DeterministicResult {
  return {
    status: "matched",
    intent: {
      commandType: "DELETE_BOQ_ITEM",
      field: "item",
      newValue: "Deleted",
      warnings: ["Deleting removes this item from the editable BOQ revision after confirmation."],
      confidence: 100,
    },
  };
}

function parseBoqCommand(transcript: string): DeterministicResult {
  const normalized = normalizeText(transcript);

  const mentionsSupportedField = /\b(?:quantity|description|unit|notes?)\b/.test(normalized);
  const explicitItemDelete =
    /\b(?:delete|remove)(?:\s+(?:this|the))?(?:\s+boq)?\s+item\b/.test(normalized);
  const looseThisDelete = /\b(?:delete|remove)\s+this\b/.test(normalized);

  if ((explicitItemDelete || looseThisDelete) && mentionsSupportedField) {
    return {
      status: "ambiguous",
      message: "Say “delete this item” to remove the whole BOQ item, or clearly name the field you want to change.",
    };
  }

  if (explicitItemDelete || looseThisDelete) {
    return deleteBoqItemResult();
  }

  if (/\b(?:add|create|insert)\b/.test(normalized) && /\bitem\b/.test(normalized)) {
    return { status: "unsupported", message: "Use the voice control on the target BOQ section to add a new item." };
  }
  if (/\b(?:move|lock|approve|issue|specification|allowance|deduction)\b/.test(normalized)) {
    return { status: "unsupported", message: "That voice command is not supported in this workflow." };
  }

  const fields = (Object.keys(BOQ_FIELD_COMMANDS) as Array<keyof typeof BOQ_FIELD_COMMANDS>).filter((field) => {
    if (field === "notes") return /\bnotes?\b/.test(normalized);
    return new RegExp(`\\b${field}\\b`).test(normalized);
  });
  if (fields.length > 1) return { status: "ambiguous", message: "The instruction refers to more than one BOQ field." };
  if (fields.length === 0) {
    if (/\b(?:change|set|update|make)\b/.test(normalized)) {
      return { status: "ambiguous", message: "The instruction does not identify a supported BOQ field." };
    }
    return { status: "unrecognized" };
  }

  const field = fields[0];
  if (field === "quantity") {
    const value = numericValue(transcript);
    if (value === null || !Number.isFinite(value)) {
      return { status: "ambiguous", message: "The instruction does not contain one clear quantity." };
    }
    if (value < 0) return { status: "unsupported", message: "Negative BOQ quantities are not supported." };
    const unit = spokenUnit(transcript);
    return {
      status: "matched",
      intent: {
        commandType: BOQ_FIELD_COMMANDS[field],
        field,
        newValue: value,
        ...(unit ? { unit } : {}),
        warnings: [],
        confidence: 100,
      },
    };
  }

  if (field === "notes" && /\bclear\s+(?:the\s+)?notes?\b/.test(normalized)) {
    return {
      status: "matched",
      intent: { commandType: BOQ_FIELD_COMMANDS[field], field, newValue: "", warnings: [], confidence: 100 },
    };
  }

  const value = textAfterConnector(transcript);
  if (value === null) return { status: "ambiguous", message: `The instruction does not provide a clear new ${field}.` };
  const normalizedValue = field === "unit" ? spokenUnit(value) ?? value.trim() : value.trim();
  return {
    status: "matched",
    intent: {
      commandType: BOQ_FIELD_COMMANDS[field],
      field,
      newValue: normalizedValue,
      warnings: [],
      confidence: 100,
    },
  };
}

function extractAddItemDescription(transcript: string): string | null {
  const explicit = transcript.match(
    /\bdescription\b\s*(?:to|as|is|=)?\s*["']?(.+?)["']?(?=\s+\b(?:quantity|qty|unit\s+cost|rate|cost|unit|code)\b|$)/i,
  );
  if (explicit?.[1]?.trim()) return explicit[1].trim();
  const afterItem = transcript.match(
    /\b(?:add|create|insert)\s+(?:(?:a|an|new)\s+)?(?:boq\s+)?item\b\s*(?:called|named|for)?\s*["']?(.+?)["']?(?=\s+\b(?:quantity|qty|unit\s+cost|rate|cost|unit|code)\b|$)/i,
  );
  return afterItem?.[1]?.trim() || null;
}

function extractItemCode(transcript: string): string | null {
  const match = transcript.match(/\bcode\b\s*(?:to|as|is|=)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{0,99})/i);
  return match?.[1]?.trim() || null;
}

function quantityAssociatedUnit(transcript: string): string | null {
  const match = transcript.match(
    /\b(?:quantity|qty)\b\s*(?:to|as|of|at|equals?|=)?\s*-?\d+(?:[.,]\d+)?\s*(.*?)(?=\s*[,;]?\s*\b(?:unit\s+cost|rate|cost|code|description)\b|$)/i,
  );
  const segment = match?.[1]?.trim() ?? "";
  if (!segment) return null;

  const normalized = normalizeText(segment);
  const candidates = new Set<string>();

  const hasM2 = /\b(?:square metres?|square meters?|sqm|m2)\b/.test(normalized);
  const hasM3 = /\b(?:cubic metres?|cubic meters?|cum|m3)\b/.test(normalized);

  if (hasM2) candidates.add("m2");
  if (hasM3) candidates.add("m3");
  if (/\b(?:percent|percentage)\b/.test(normalized) || segment.includes("%")) candidates.add("%");
  if (/\b(?:kilograms?|kilos?|kg)\b/.test(normalized)) candidates.add("kg");
  if (!hasM2 && !hasM3 && /\b(?:metres?|meters?|m)\b/.test(normalized)) candidates.add("m");
  if (/\b(?:number|numbers|pieces?|pcs|nr)\b/.test(normalized)) candidates.add("nr");

  return candidates.size === 1 ? Array.from(candidates)[0] : null;
}

function parseBoqSectionCommand(transcript: string): DeterministicResult {
  const normalized = normalizeText(transcript);
  if (!/\b(?:add|create|insert)\b/.test(normalized) || !/\bitem\b/.test(normalized)) {
    if (/\b(?:delete|remove|change|set|update)\b/.test(normalized)) {
      return { status: "unsupported", message: "Use an individual BOQ item's voice control to change or delete that item." };
    }
    return { status: "unrecognized" };
  }

  const description = extractAddItemDescription(transcript);
  if (!description) return { status: "ambiguous", message: "Say the new item's description after “add item” or “description”." };

  const quantity = labeledNumericValue(transcript, "quantity|qty");
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return { status: "ambiguous", message: "The new item needs one explicit positive quantity." };
  }

  const unit = quantityAssociatedUnit(transcript);
  if (!unit) {
    return {
      status: "ambiguous",
      message: "The new item needs one unambiguous supported unit associated with its quantity, such as m, m2, m3, kg, nr, or percent.",
    };
  }

  const unitCost = labeledNumericValue(transcript, "unit\\s+cost|rate|cost");
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
    return { status: "ambiguous", message: "The spoken unit cost/rate is not valid." };
  }

  const itemCode = extractItemCode(transcript);
  return {
    status: "matched",
    intent: {
      commandType: "ADD_BOQ_ITEM",
      field: "item",
      newValue: description,
      itemDraft: {
        description,
        quantity,
        unit,
        ...(itemCode ? { itemCode } : {}),
        ...(unitCost !== null ? { unitCost } : {}),
      },
      warnings: [
        ...(itemCode ? [] : ["No item code was spoken; Quantara will generate a draft voice item code for review."]),
        ...(unitCost === null ? ["No unit cost/rate was spoken; the draft item will use 0 until professionally reviewed."] : []),
      ],
      confidence: 100,
    },
  };
}

export function interpretVoiceCommandDeterministically(
  transcript: string,
  context: VoiceInterpreterContext,
): DeterministicResult {
  const normalized = normalizeText(transcript);
  if (!normalized) return { status: "ambiguous", message: "The voice instruction is empty." };
  if (context.type === "DIMENSION_CALCULATION") return parseDimensionCommand(transcript, context);
  if (context.type === "BOQ_SECTION") return parseBoqSectionCommand(transcript);
  return parseBoqCommand(transcript);
}

function validateOptionalIntent(intent: VoiceCommandIntent, context: VoiceInterpreterContext): VoiceCommandIntent {
  if (context.type === "DIMENSION_CALCULATION") {
    if (intent.commandType !== "SET_DIMENSION" || intent.field !== "value" || !intent.dimensionKey) {
      throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not supported in this context.", 400);
    }
    const dimension = context.dimensions.find((candidate) => candidate.key === intent.dimensionKey);
    if (!dimension || typeof intent.newValue !== "number" || !Number.isFinite(intent.newValue) || intent.newValue < 0) {
      throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That dimension command is not supported in this calculation.", 400);
    }
    if (intent.unit && intent.unit !== dimension.unit) {
      throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The spoken unit does not match the selected dimension.", 422);
    }
    return intent;
  }

  if (context.type === "BOQ_SECTION") {
    if (
      intent.commandType !== "ADD_BOQ_ITEM"
      || intent.field !== "item"
      || !intent.itemDraft
      || !intent.itemDraft.description.trim()
      || !Number.isFinite(intent.itemDraft.quantity)
      || intent.itemDraft.quantity <= 0
      || !intent.itemDraft.unit.trim()
    ) {
      throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That add-item voice command is not valid for this BOQ section.", 400);
    }
    return intent;
  }

  if (intent.commandType === "DELETE_BOQ_ITEM") {
    if (intent.field !== "item") throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The delete command target is inconsistent.", 422);
    return intent;
  }
  if (intent.commandType === "ADD_BOQ_ITEM" || intent.commandType === "SET_DIMENSION") {
    throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not supported in this context.", 400);
  }

  const expectedFieldByCommand = {
    SET_BOQ_QUANTITY: "quantity",
    SET_BOQ_DESCRIPTION: "description",
    SET_BOQ_UNIT: "unit",
    SET_BOQ_NOTES: "notes",
  } as const;
  if (intent.field !== expectedFieldByCommand[intent.commandType]) {
    throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The interpreted command field is inconsistent.", 422);
  }
  return intent;
}

export async function interpretVoiceCommand(
  transcript: string,
  context: VoiceInterpreterContext,
  optionalInterpreter?: NaturalLanguageVoiceInterpreter,
): Promise<VoiceCommandIntent> {
  const deterministic = interpretVoiceCommandDeterministically(transcript, context);
  if (deterministic.status === "matched") return deterministic.intent;
  if (deterministic.status === "ambiguous") throw new AppError("VOICE_COMMAND_AMBIGUOUS", deterministic.message, 422);
  if (deterministic.status === "unsupported") throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", deterministic.message, 400);

  if (optionalInterpreter) {
    const intent = await optionalInterpreter.interpret(transcript, context);
    if (intent) return validateOptionalIntent(intent, context);
  }
  throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not supported in this workflow.", 400);
}
