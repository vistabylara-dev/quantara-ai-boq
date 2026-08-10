import type { Prisma } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getRequiredDimensions } from "@/lib/calculations/required-dimensions-registry";
import { AppError } from "@/lib/errors/app-error";
import {
  createBOQItem,
  deleteBOQItem,
  getBOQ,
  getBOQItemRecord,
  getBOQSectionRecord,
  updateBOQItem,
  type BOQItemExpectedCurrent,
  type BOQItemWriteInput,
} from "@/lib/repositories/boq-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { itemCreateRouteSchema, itemUpdateRouteSchema } from "@/lib/validation/boq-route-schemas";
import {
  interpretVoiceCommand,
  type NaturalLanguageVoiceInterpreter,
  type VoiceCommandIntent,
} from "@/lib/voice/voice-command-interpreter";
import {
  voiceCommandProposalSchema,
  unsignedBoqVoiceCommandProposalSchema,
  type BoqVoiceCommandProposal,
  type UnsignedBoqVoiceCommandProposal,
  type VoiceApplyRequest,
  type VoiceCommandContext,
  type VoiceCommandProposal,
  type VoiceCommandType,
} from "@/lib/voice/voice-types";
import { createVoiceProposalToken, verifyVoiceProposalToken } from "@/lib/voice/voice-proposal-token";

const BOQ_FIELD_BY_COMMAND = {
  SET_BOQ_QUANTITY: "quantity",
  SET_BOQ_DESCRIPTION: "description",
  SET_BOQ_UNIT: "unit",
  SET_BOQ_NOTES: "notes",
} as const;

type BoqFieldCommand = keyof typeof BOQ_FIELD_BY_COMMAND;
type BoqFieldProposal = Extract<BoqVoiceCommandProposal, { commandType: BoqFieldCommand }>;

function isBoqFieldCommand(commandType: VoiceCommandType): commandType is BoqFieldCommand {
  return commandType in BOQ_FIELD_BY_COMMAND;
}

export type VoiceCommandServiceOptions = {
  interpreter?: NaturalLanguageVoiceInterpreter;
  proposalSigningKey?: string;
};

function proposalBinding(actor: CurrentActor, projectId: string) {
  return { actorUserId: actor.userId, companyId: actor.companyId, projectId };
}

function assertItemBelongsToProject(
  item: Awaited<ReturnType<typeof getBOQItemRecord>>,
  canonicalProjectId: string,
): void {
  if (item.section.boq.projectId !== canonicalProjectId) {
    throw new AppError("VOICE_TARGET_PROJECT_MISMATCH", "This BOQ item belongs to a different project.", 400);
  }
}

function assertSectionBelongsToProject(
  section: Awaited<ReturnType<typeof getBOQSectionRecord>>,
  canonicalProjectId: string,
): void {
  if (section.boq.projectId !== canonicalProjectId) {
    throw new AppError("VOICE_TARGET_PROJECT_MISMATCH", "This BOQ section belongs to a different project.", 400);
  }
}

function displayValue(value: string | number | null, unit?: string | null): string {
  if (value === null || value === "") return "not set";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function signPersistentProposal(
  actor: CurrentActor,
  projectId: string,
  unsignedProposal: UnsignedBoqVoiceCommandProposal,
  proposalSigningKey: string | undefined,
): VoiceCommandProposal {
  return voiceCommandProposalSchema.parse({
    ...unsignedProposal,
    proposalToken: createVoiceProposalToken(
      unsignedProposal,
      proposalBinding(actor, projectId),
      { signingKey: proposalSigningKey },
    ),
  });
}

function boqItemOldValue(
  item: Awaited<ReturnType<typeof getBOQItemRecord>>,
  field: "quantity" | "description" | "unit" | "notes",
): string | number {
  return field === "quantity" ? item.quantity.toNumber() : item[field];
}

function validateBoqIntentValue(intent: VoiceCommandIntent): string | number {
  if (!isBoqFieldCommand(intent.commandType)) {
    throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not a field update.", 400);
  }
  const expectedField = BOQ_FIELD_BY_COMMAND[intent.commandType];
  if (intent.field !== expectedField) {
    throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The interpreted command field is inconsistent.", 422);
  }
  if (expectedField === "quantity") {
    const value = itemUpdateRouteSchema.parse({ quantity: intent.newValue }).quantity;
    if (value === undefined) throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The instruction does not contain a valid new value.", 422);
    return value.toNumber();
  }
  if (expectedField === "description") {
    const value = itemUpdateRouteSchema.parse({ description: intent.newValue }).description;
    if (value === undefined) throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The instruction does not contain a valid new value.", 422);
    return value;
  }
  if (expectedField === "unit") {
    const value = itemUpdateRouteSchema.parse({ unit: intent.newValue }).unit;
    if (value === undefined) throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The instruction does not contain a valid new value.", 422);
    return value;
  }
  const value = itemUpdateRouteSchema.parse({ notes: intent.newValue }).notes;
  if (value === undefined) throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The instruction does not contain a valid new value.", 422);
  return value;
}

export async function proposeVoiceCommand(
  actor: CurrentActor,
  projectIdentifier: string,
  transcript: string,
  context: VoiceCommandContext,
  options: VoiceCommandServiceOptions = {},
): Promise<VoiceCommandProposal> {
  requireCapability(actor, "boq:edit");
  const project = await getProjectRecord(actor.companyId, projectIdentifier);

  if (context.type === "DIMENSION_CALCULATION") {
    const definition = getRequiredDimensions(context.calculationType);
    if (!definition) {
      throw new AppError(
        "CALCULATION_TYPE_NOT_SUPPORTED",
        `No deterministic formula is registered for calculation type "${context.calculationType}".`,
        400,
      );
    }
    if (context.activeDimensionKey && !definition.inputs.some((input) => input.key === context.activeDimensionKey)) {
      throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The active dimension is not valid for this calculation.", 422);
    }
    const currentByKey = new Map<string, number | null>();
    for (const value of context.dimensionValues) {
      if (!definition.inputs.some((input) => input.key === value.key)) {
        throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The supplied dimension context is not valid for this calculation.", 422);
      }
      if (currentByKey.has(value.key)) {
        throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The supplied dimension context contains duplicate values.", 422);
      }
      currentByKey.set(value.key, value.value);
    }
    const intent = await interpretVoiceCommand(
      transcript,
      {
        type: "DIMENSION_CALCULATION",
        dimensions: definition.inputs,
        ...(context.activeDimensionKey ? { activeDimensionKey: context.activeDimensionKey } : {}),
      },
      options.interpreter,
    );
    if (intent.commandType !== "SET_DIMENSION" || intent.field !== "value" || !intent.dimensionKey || typeof intent.newValue !== "number") {
      throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not supported in this context.", 400);
    }
    const dimension = definition.inputs.find((input) => input.key === intent.dimensionKey);
    if (!dimension) throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That dimension is not supported in this calculation.", 400);
    const oldValue = currentByKey.get(dimension.key) ?? null;
    return voiceCommandProposalSchema.parse({
      commandType: "SET_DIMENSION",
      targetType: "DIMENSION",
      field: "value",
      dimensionKey: dimension.key,
      oldValue,
      newValue: intent.newValue,
      unit: dimension.unit,
      transcript,
      humanSummary: `Change ${dimension.label} from ${displayValue(oldValue, dimension.unit)} to ${displayValue(intent.newValue, dimension.unit)}.`,
      requiresConfirmation: true,
      warnings: [...intent.warnings, ...(oldValue === null ? ["No current dimension value is set."] : [])],
      ...(intent.confidence !== undefined ? { confidence: intent.confidence } : {}),
    });
  }

  if (context.type === "BOQ_SECTION") {
    const section = await getBOQSectionRecord(actor.companyId, context.sectionId);
    assertSectionBelongsToProject(section, project.id);
    const intent = await interpretVoiceCommand(transcript, { type: "BOQ_SECTION" }, options.interpreter);
    if (intent.commandType !== "ADD_BOQ_ITEM" || intent.field !== "item" || !intent.itemDraft) {
      throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice instruction did not resolve to an add-item proposal.", 400);
    }
    const nextItemNumber = Math.max(0, ...section.items.map((item) => item.itemNumber)) + 1;
    const generatedCode = `VOICE-${String(nextItemNumber).padStart(3, "0")}`;
    const itemDraft = {
      itemNumber: nextItemNumber,
      itemCode: intent.itemDraft.itemCode?.trim() || generatedCode,
      category: section.title,
      description: intent.itemDraft.description.trim(),
      quantity: intent.itemDraft.quantity,
      unit: intent.itemDraft.unit.trim(),
      unitCost: intent.itemDraft.unitCost ?? 0,
    };
    const unsignedProposal = unsignedBoqVoiceCommandProposalSchema.parse({
      commandType: "ADD_BOQ_ITEM",
      targetType: "BOQ_SECTION",
      targetId: section.id,
      field: "item",
      oldValue: "No new BOQ item",
      newValue: `${itemDraft.itemCode} — ${itemDraft.description} — ${itemDraft.quantity} ${itemDraft.unit}`,
      expectedBoqVersion: section.boq.version,
      itemDraft,
      transcript,
      humanSummary:
        `Add ${itemDraft.itemCode} “${itemDraft.description}” to ${section.code} ${section.title} `
        + `with quantity ${itemDraft.quantity} ${itemDraft.unit} and unit cost ${itemDraft.unitCost}.`,
      requiresConfirmation: true,
      warnings: intent.warnings,
      ...(intent.confidence !== undefined ? { confidence: intent.confidence } : {}),
    });
    return signPersistentProposal(actor, project.id, unsignedProposal, options.proposalSigningKey);
  }

  const item = await getBOQItemRecord(actor.companyId, context.itemId);
  assertItemBelongsToProject(item, project.id);
  const intent = await interpretVoiceCommand(transcript, { type: "BOQ_ITEM" }, options.interpreter);

  if (intent.commandType === "DELETE_BOQ_ITEM") {
    const itemLabel = `${item.itemCode || `Item ${item.itemNumber}`} — ${item.description}`;
    const unsignedProposal = unsignedBoqVoiceCommandProposalSchema.parse({
      commandType: "DELETE_BOQ_ITEM",
      targetType: "BOQ_ITEM",
      targetId: item.id,
      sectionId: item.sectionId,
      field: "item",
      oldValue: itemLabel,
      newValue: "Deleted",
      expectedBoqVersion: item.section.boq.version,
      transcript,
      humanSummary: `Delete BOQ item ${itemLabel} from this editable revision.`,
      requiresConfirmation: true,
      warnings: [...intent.warnings, "Confirm only if this item should be removed from the current editable revision."],
      ...(intent.confidence !== undefined ? { confidence: intent.confidence } : {}),
    });
    return signPersistentProposal(actor, project.id, unsignedProposal, options.proposalSigningKey);
  }

  if (!isBoqFieldCommand(intent.commandType)) {
    throw new AppError("VOICE_COMMAND_NOT_SUPPORTED", "That voice command is not supported for this BOQ item.", 400);
  }
  const field = BOQ_FIELD_BY_COMMAND[intent.commandType];
  if (intent.field !== field) throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The interpreted command field is inconsistent.", 422);
  if (field === "quantity" && intent.unit && intent.unit !== item.unit) {
    throw new AppError(
      "VOICE_COMMAND_AMBIGUOUS",
      `The spoken quantity unit (${intent.unit}) does not match this BOQ item's current unit (${item.unit}). Change the unit separately.`,
      422,
    );
  }
  const oldValue = boqItemOldValue(item, field);
  const newValue = validateBoqIntentValue(intent);
  const unsignedProposal = unsignedBoqVoiceCommandProposalSchema.parse({
    commandType: intent.commandType,
    targetType: "BOQ_ITEM",
    targetId: item.id,
    field,
    oldValue,
    newValue,
    ...(field === "quantity" ? { unit: item.unit } : {}),
    transcript,
    humanSummary: `Change BOQ item ${item.itemCode} ${field} from ${displayValue(oldValue, field === "quantity" ? item.unit : null)} to ${displayValue(newValue, field === "quantity" ? item.unit : null)}.`,
    requiresConfirmation: true,
    warnings: intent.warnings,
    ...(intent.confidence !== undefined ? { confidence: intent.confidence } : {}),
  });
  return signPersistentProposal(actor, project.id, unsignedProposal, options.proposalSigningKey);
}

function mutationPatch(proposal: BoqFieldProposal): Partial<BOQItemWriteInput> {
  const field = BOQ_FIELD_BY_COMMAND[proposal.commandType];
  if (proposal.field !== field) throw new AppError("VOICE_COMMAND_AMBIGUOUS", "The voice command does not match its target field.", 422);
  return itemUpdateRouteSchema.parse({ [field]: proposal.newValue });
}

function expectedCurrentValues(proposal: BoqFieldProposal): BOQItemExpectedCurrent[] {
  const expected: BOQItemExpectedCurrent[] = proposal.field === "quantity"
    ? [{ field: "quantity", value: proposal.oldValue }]
    : [{ field: proposal.field, value: proposal.oldValue }];
  if (proposal.field === "quantity") expected.push({ field: "unit", value: proposal.unit });
  return expected;
}

export async function applyVoiceBOQCommand(
  actor: CurrentActor,
  projectIdentifier: string,
  input: VoiceApplyRequest,
  options: Pick<VoiceCommandServiceOptions, "proposalSigningKey"> = {},
) {
  requireCapability(actor, "boq:edit");
  if (input.confirmed !== true || input.proposal.requiresConfirmation !== true) {
    throw new AppError("VOICE_CONFIRMATION_REQUIRED", "Confirm the visible voice proposal before applying it.", 400);
  }

  const project = await getProjectRecord(actor.companyId, projectIdentifier);
  verifyVoiceProposalToken(input.proposal, proposalBinding(actor, project.id), { signingKey: options.proposalSigningKey });

  if (input.proposal.commandType === "ADD_BOQ_ITEM") {
    const section = await getBOQSectionRecord(actor.companyId, input.proposal.targetId);
    assertSectionBelongsToProject(section, project.id);
    const draft = input.proposal.itemDraft;
    const createInput = itemCreateRouteSchema.parse({
      itemNumber: draft.itemNumber,
      itemCode: draft.itemCode,
      category: draft.category,
      description: draft.description,
      quantity: draft.quantity,
      unit: draft.unit,
      unitCost: draft.unitCost,
      marginPercentage: 0,
      taxApplicable: true,
      confidenceScore: 100,
      notes: "Added from a confirmed voice proposal; professional review remains required.",
    });
    const result = await createBOQItem(
      actor.companyId,
      section.id,
      createInput,
      undefined,
      {
        expectedBoqVersion: input.proposal.expectedBoqVersion,
        additionalAudit: {
          action: "VOICE_BOQ_ITEM_ADDED",
          payload: {
            projectId: project.id,
            boqId: section.boqId,
            transcript: input.proposal.transcript,
            itemDraft: {
              itemNumber: draft.itemNumber,
              itemCode: draft.itemCode,
              category: draft.category,
              description: draft.description,
              quantity: draft.quantity,
              unit: draft.unit,
              unitCost: draft.unitCost,
            },
            actorUserId: actor.userId,
          } satisfies Prisma.InputJsonObject,
        },
      },
    );
    return "boq" in result && result.boq ? result.boq : getBOQ(actor.companyId, section.boqId);
  }

  if (input.proposal.commandType === "DELETE_BOQ_ITEM") {
    const item = await getBOQItemRecord(actor.companyId, input.proposal.targetId);
    assertItemBelongsToProject(item, project.id);
    if (item.sectionId !== input.proposal.sectionId) {
      throw new AppError("VOICE_PROPOSAL_STALE", "This item moved after the voice preview. Request a new proposal.", 409);
    }
    const boqId = item.section.boqId;
    await deleteBOQItem(actor.companyId, item.id, {
      expectedBoqVersion: input.proposal.expectedBoqVersion,
      additionalAudit: {
        action: "VOICE_BOQ_ITEM_DELETED",
        payload: {
          projectId: project.id,
          boqId,
          transcript: input.proposal.transcript,
          itemCode: item.itemCode,
          description: item.description,
          actorUserId: actor.userId,
        } satisfies Prisma.InputJsonObject,
      },
    });
    return getBOQ(actor.companyId, boqId);
  }

  const proposal: BoqFieldProposal = input.proposal;
  const item = await getBOQItemRecord(actor.companyId, proposal.targetId);
  assertItemBelongsToProject(item, project.id);
  const patch = mutationPatch(proposal);
  const auditPayload = {
    projectId: project.id,
    boqId: item.section.boqId,
    transcript: proposal.transcript,
    field: proposal.field,
    oldValue: proposal.oldValue,
    newValue: proposal.newValue,
    actorUserId: actor.userId,
  } satisfies Prisma.InputJsonObject;

  return updateBOQItem(actor.companyId, item.id, patch, {
    expectedCurrent: expectedCurrentValues(proposal),
    additionalAudit: { action: "VOICE_BOQ_CHANGE_APPLIED", payload: auditPayload },
  });
}
