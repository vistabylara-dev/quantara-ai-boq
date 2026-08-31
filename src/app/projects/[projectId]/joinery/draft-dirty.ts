import type { FurnitureOrderCategory } from "@/lib/furniture/calculations";

export type EdgeChoice = "NONE" | "WIDTH" | "HEIGHT" | "ALL_FOUR" | "UNRESOLVED";

export type CandidateDraft = {
  room: string;
  elevationReference: string;
  assembly: string;
  part: string;
  quantity: string;
  width: string;
  height: string;
  depth: string;
  thickness: string;
  materialName: string;
  finish: string;
  grainDirection: string;
  hardwareNotes: string;
  edgeChoice: EdgeChoice;
  notes: string;
  reason: string;
  acknowledgeReviewItems: boolean;
};

export type OrderItemDraft = {
  description: string;
  quantity: string;
  unit: string;
  category: FurnitureOrderCategory;
  suppliedByOthers: boolean;
  notes: string;
  reason: string;
  acknowledgeReviewItems: boolean;
};

const candidateDomainDraftFields = [
  "room",
  "elevationReference",
  "assembly",
  "part",
  "quantity",
  "width",
  "height",
  "depth",
  "thickness",
  "materialName",
  "finish",
  "grainDirection",
  "hardwareNotes",
  "edgeChoice",
  "notes",
] as const satisfies readonly (keyof CandidateDraft)[];

const orderItemDomainDraftFields = [
  "description",
  "quantity",
  "unit",
  "category",
  "suppliedByOthers",
  "notes",
] as const satisfies readonly (keyof OrderItemDraft)[];

function hasDirtyDomainField<T extends object>(
  draft: T,
  persisted: T,
  fields: readonly (keyof T)[],
): boolean {
  return fields.some((field) => draft[field] !== persisted[field]);
}

export function isCandidateDraftDirty(draft: CandidateDraft, persisted: CandidateDraft): boolean {
  return hasDirtyDomainField(draft, persisted, candidateDomainDraftFields);
}

export function isOrderItemDraftDirty(draft: OrderItemDraft, persisted: OrderItemDraft): boolean {
  return hasDirtyDomainField(draft, persisted, orderItemDomainDraftFields);
}
