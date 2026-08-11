import { QuantityCalculationType } from "@prisma/client";
import { z } from "zod";

export type { DimensionValue } from "@/lib/calculations/required-dimensions-registry";

export const VOICE_COMMAND_TYPES = [
  "SET_DIMENSION",
  "SET_BOQ_QUANTITY",
  "SET_BOQ_DESCRIPTION",
  "SET_BOQ_UNIT",
  "SET_BOQ_NOTES",
  "ADD_BOQ_ITEM",
  "DELETE_BOQ_ITEM",
] as const;

export const voiceCommandTypeSchema = z.enum(VOICE_COMMAND_TYPES);
export type VoiceCommandType = z.infer<typeof voiceCommandTypeSchema>;

export const voiceTranscriptionResultSchema = z.object({
  transcript: z.string(),
  provider: z.literal("openai"),
  model: z.string(),
}).strict();

export type VoiceTranscriptionResult = z.infer<typeof voiceTranscriptionResultSchema>;

export const voiceDimensionValueSchema = z.object({
  key: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  unit: z.string().trim().max(20).nullable(),
  required: z.boolean(),
  value: z.number().finite().nullable(),
  source: z.enum(["extracted_entity", "detected_room", "manual_professional_input"]).nullable(),
  confidence: z.number().min(0).max(100).nullable(),
  reviewStatus: z.enum(["PREFILLED", "MANUAL_ENTRY", "MISSING"]),
}).strict();

export type VoiceDimensionValue = z.infer<typeof voiceDimensionValueSchema>;

const dimensionContextSchema = z.object({
  type: z.literal("DIMENSION_CALCULATION"),
  calculationType: z.nativeEnum(QuantityCalculationType),
  dimensionValues: z.array(voiceDimensionValueSchema).max(50),
  activeDimensionKey: z.string().trim().min(1).max(100).optional(),
}).strict();

const boqItemContextSchema = z.object({
  type: z.literal("BOQ_ITEM"),
  itemId: z.string().uuid("A valid BOQ item ID is required."),
}).strict();

const boqSectionContextSchema = z.object({
  type: z.literal("BOQ_SECTION"),
  sectionId: z.string().uuid("A valid BOQ section ID is required."),
}).strict();

export const voiceCommandContextSchema = z.discriminatedUnion("type", [
  dimensionContextSchema,
  boqItemContextSchema,
  boqSectionContextSchema,
]);

export type VoiceCommandContext = z.infer<typeof voiceCommandContextSchema>;

export const voiceProposeRequestSchema = z.object({
  transcript: z.string().trim().min(1, "A transcript is required.").max(4_000),
  context: voiceCommandContextSchema,
}).strict();

/**
 * Safe navigation intents ("take me to validation") never mutate anything,
 * so they skip the propose/confirm/apply pipeline entirely — the frontend
 * just navigates. Kept separate from VoiceCommandProposal so a navigation
 * result can never accidentally be sent to /voice/apply.
 */
export const VOICE_NAVIGATION_DESTINATIONS = [
  "sources",
  "extraction",
  "dimensions",
  "calculation",
  "boq_review",
  "validation",
  "output",
] as const;

export const voiceNavigationResultSchema = z.object({
  kind: z.literal("navigation"),
  destination: z.enum(VOICE_NAVIGATION_DESTINATIONS),
  message: z.string(),
}).strict();

export type VoiceNavigationResult = z.infer<typeof voiceNavigationResultSchema>;

export type VoiceProposeRequest = z.infer<typeof voiceProposeRequestSchema>;

const proposalBaseShape = {
  transcript: z.string().trim().min(1).max(4_000),
  humanSummary: z.string().trim().min(1).max(2_000),
  requiresConfirmation: z.literal(true),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
  confidence: z.number().finite().min(0).max(100).optional(),
};

const setDimensionProposalSchema = z.object({
  ...proposalBaseShape,
  commandType: z.literal("SET_DIMENSION"),
  targetType: z.literal("DIMENSION"),
  field: z.literal("value"),
  dimensionKey: z.string().trim().min(1).max(100),
  oldValue: z.number().finite().nullable(),
  newValue: z.number().finite().min(0),
  unit: z.string().trim().max(20).nullable().optional(),
}).strict();

const proposalTokenSchema = z.string().trim().min(1).max(512);

const unsignedSetBoqQuantityProposalSchema = z.object({
  ...proposalBaseShape,
  commandType: z.literal("SET_BOQ_QUANTITY"),
  targetType: z.literal("BOQ_ITEM"),
  targetId: z.string().uuid(),
  field: z.literal("quantity"),
  oldValue: z.number().finite().min(0),
  newValue: z.number().finite().min(0),
  unit: z.string().trim().min(1).max(50),
}).strict();

const unsignedSetBoqDescriptionProposalSchema = z.object({
  ...proposalBaseShape,
  commandType: z.literal("SET_BOQ_DESCRIPTION"),
  targetType: z.literal("BOQ_ITEM"),
  targetId: z.string().uuid(),
  field: z.literal("description"),
  oldValue: z.string().max(2_000),
  newValue: z.string().trim().min(1).max(2_000),
}).strict();

const unsignedSetBoqUnitProposalSchema = z.object({
  ...proposalBaseShape,
  commandType: z.literal("SET_BOQ_UNIT"),
  targetType: z.literal("BOQ_ITEM"),
  targetId: z.string().uuid(),
  field: z.literal("unit"),
  oldValue: z.string().max(50),
  newValue: z.string().trim().min(1).max(50),
}).strict();

const unsignedSetBoqNotesProposalSchema = z.object({
  ...proposalBaseShape,
  commandType: z.literal("SET_BOQ_NOTES"),
  targetType: z.literal("BOQ_ITEM"),
  targetId: z.string().uuid(),
  field: z.literal("notes"),
  oldValue: z.string().max(5_000),
  newValue: z.string().trim().max(5_000),
}).strict();

export const voiceNewBoqItemDraftSchema = z.object({
  itemNumber: z.number().int().positive(),
  itemCode: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(2_000),
  quantity: z.number().finite().positive(),
  unit: z.string().trim().min(1).max(50),
  unitCost: z.number().finite().min(0),
}).strict();

export type VoiceNewBoqItemDraft = z.infer<typeof voiceNewBoqItemDraftSchema>;

const unsignedAddBoqItemProposalSchema = z.object({
  ...proposalBaseShape,
  commandType: z.literal("ADD_BOQ_ITEM"),
  targetType: z.literal("BOQ_SECTION"),
  targetId: z.string().uuid(),
  field: z.literal("item"),
  oldValue: z.literal("No new BOQ item"),
  newValue: z.string().trim().min(1).max(2_000),
  expectedBoqVersion: z.number().int().nonnegative(),
  itemDraft: voiceNewBoqItemDraftSchema,
}).strict();

const unsignedDeleteBoqItemProposalSchema = z.object({
  ...proposalBaseShape,
  commandType: z.literal("DELETE_BOQ_ITEM"),
  targetType: z.literal("BOQ_ITEM"),
  targetId: z.string().uuid(),
  sectionId: z.string().uuid(),
  field: z.literal("item"),
  oldValue: z.string().trim().min(1).max(2_000),
  newValue: z.literal("Deleted"),
  expectedBoqVersion: z.number().int().nonnegative(),
}).strict();

export const unsignedBoqVoiceCommandProposalSchema = z.discriminatedUnion("commandType", [
  unsignedSetBoqQuantityProposalSchema,
  unsignedSetBoqDescriptionProposalSchema,
  unsignedSetBoqUnitProposalSchema,
  unsignedSetBoqNotesProposalSchema,
  unsignedAddBoqItemProposalSchema,
  unsignedDeleteBoqItemProposalSchema,
]);

const setBoqQuantityProposalSchema = unsignedSetBoqQuantityProposalSchema.extend({ proposalToken: proposalTokenSchema }).strict();
const setBoqDescriptionProposalSchema = unsignedSetBoqDescriptionProposalSchema.extend({ proposalToken: proposalTokenSchema }).strict();
const setBoqUnitProposalSchema = unsignedSetBoqUnitProposalSchema.extend({ proposalToken: proposalTokenSchema }).strict();
const setBoqNotesProposalSchema = unsignedSetBoqNotesProposalSchema.extend({ proposalToken: proposalTokenSchema }).strict();
const addBoqItemProposalSchema = unsignedAddBoqItemProposalSchema.extend({ proposalToken: proposalTokenSchema }).strict();
const deleteBoqItemProposalSchema = unsignedDeleteBoqItemProposalSchema.extend({ proposalToken: proposalTokenSchema }).strict();

export const boqVoiceCommandProposalSchema = z.discriminatedUnion("commandType", [
  setBoqQuantityProposalSchema,
  setBoqDescriptionProposalSchema,
  setBoqUnitProposalSchema,
  setBoqNotesProposalSchema,
  addBoqItemProposalSchema,
  deleteBoqItemProposalSchema,
]);

export const voiceCommandProposalSchema = z.union([
  setDimensionProposalSchema,
  boqVoiceCommandProposalSchema,
]);

export type VoiceCommandProposal = z.infer<typeof voiceCommandProposalSchema>;
export type UnsignedBoqVoiceCommandProposal = z.infer<typeof unsignedBoqVoiceCommandProposalSchema>;
export type BoqVoiceCommandProposal = z.infer<typeof boqVoiceCommandProposalSchema>;

export const voiceApplyRequestSchema = z.object({
  confirmed: z.literal(true),
  proposal: boqVoiceCommandProposalSchema,
}).strict();

export type VoiceApplyRequest = z.infer<typeof voiceApplyRequestSchema>;
