import { AppError } from "@/lib/errors/app-error";
import type { DimensionInputDefinition } from "@/lib/calculations/required-dimensions-registry";
import type { VoiceCommandType } from "@/lib/voice/voice-types";

export type VoiceInterpreterContext =
  | {
      type: "DIMENSION_CALCULATION";
      dimensions: DimensionInputDefinition[];
      activeDimensionKey?: string;
    }
  | {
      type: "BOQ_ITEM";
    };

export type VoiceCommandIntent = {
  commandType: VoiceCommandType;
  field: "value" | "quantity" | "description" | "unit" | "notes";
  dimensionKey?: string;
  newValue: string | number;
  unit?: string;
  warnings: string[];
  confidence?: number;
};

/**
 * Optional second interpretation layer. A caller may inject a separately
 * approved natural-language interpreter, but this Release 1 module never
 * sends a transcript to another provider on its own. The interpreter can
 * propose intent only; it receives no database mutation capability.
 */
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
    .replace(/[^a-z0-9.%]+/g, " ")
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
  if (value < 0) {
    return { status: "unsupported", message: "Negative measurement values are not supported." };
  }

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

function parseBoqCommand(transcript: string): DeterministicResult {
  const normalized = normalizeText(transcript);
  if (/\b(?:delete|remove|move|lock|approve|issue|specification|allowance|deduction)\b/.test(normalized)) {
    return { status: "unsupported", message: "That voice command is not supported in Release 1." };
  }

  const fields = (Object.keys(BOQ_FIELD_COMMANDS) as Array<keyof typeof BOQ_FIELD_COMMANDS>).filter((field) => {
    if (field === "notes") return /\bnotes?\b/.test(normalized);
    return new RegExp(`\\b${field}\\b`).test(normalized);
  });
  if (fields.length > 1) {
    return { status: "ambiguous", message: "The instruction refers to more than one BOQ field." };
  }
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
  if (value === null) {
    return { status: "ambiguous", message: `The instruction does not provide a clear new ${field}.` };
  }
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

export function interpretVoiceCommandDeterministically(
  transcript: string,
  context: VoiceInterpreterContext,
): DeterministicResult {
  const normalized = normalizeText(transcript);
  if (!normalized) return { status: "ambiguous", message: "The voice instruction is empty." };
  return context.type === "DIMENSION_CALCULATION"
    ? parseDimensionCommand(transcript, context)
    : parseBoqCommand(transcript);
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

  const expectedFieldByCommand = {
    SET_BOQ_QUANTITY: "quantity",
    SET_BOQ_DESCRIPTION: "description",
    SET_BOQ_UNIT: "unit",
    SET_BOQ_NOTES: "notes",
  } as const;
  if (intent.commandType === "SET_DIMENSION") {
    throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not supported in this context.", 400);
  }
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
  if (deterministic.status === "ambiguous") {
    throw new AppError("VOICE_COMMAND_AMBIGUOUS", deterministic.message, 422);
  }
  if (deterministic.status === "unsupported") {
    throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", deterministic.message, 400);
  }

  if (optionalInterpreter) {
    const intent = await optionalInterpreter.interpret(transcript, context);
    if (intent) return validateOptionalIntent(intent, context);
  }
  throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not supported in Release 1.", 400);
}
