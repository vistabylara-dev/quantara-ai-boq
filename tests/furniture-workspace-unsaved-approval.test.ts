import { describe, expect, it } from "vitest";
import {
  isCandidateDraftDirty,
  isOrderItemDraftDirty,
  type CandidateDraft,
  type OrderItemDraft,
} from "@/app/projects/[projectId]/joinery/draft-dirty";

function candidateDraft(): CandidateDraft {
  return {
    room: "Bedroom",
    elevationReference: "E-01",
    assembly: "Wardrobe",
    part: "Side panel",
    quantity: "2",
    width: "600",
    height: "2400",
    depth: "550",
    thickness: "18",
    materialName: "Oak veneer MDF",
    finish: "Natural oak",
    grainDirection: "Vertical",
    hardwareNotes: "Soft-close hinge",
    edgeChoice: "HEIGHT",
    notes: "Match approved sample",
    reason: "",
    acknowledgeReviewItems: false,
  };
}

function orderItemDraft(): OrderItemDraft {
  return {
    description: "Soft-close concealed hinge",
    quantity: "12",
    unit: "pcs",
    category: "HARDWARE",
    suppliedByOthers: false,
    notes: "Confirm finish",
    reason: "",
    acknowledgeReviewItems: false,
  };
}

describe("Joinery unsaved-approval domain comparators", () => {
  it("detects every candidate domain edit but ignores review-only controls", () => {
    const persisted = candidateDraft();
    const domainChanges: Partial<CandidateDraft>[] = [
      { room: "Kitchen" },
      { elevationReference: "E-02" },
      { assembly: "Base cabinet" },
      { part: "Door" },
      { quantity: "3" },
      { width: "601" },
      { height: "2399" },
      { depth: "551" },
      { thickness: "19" },
      { materialName: "Walnut veneer MDF" },
      { finish: "Dark walnut" },
      { grainDirection: "Horizontal" },
      { hardwareNotes: "Pull-out runner" },
      { edgeChoice: "ALL_FOUR" },
      { notes: "Revised from drawing" },
    ];

    expect(isCandidateDraftDirty(persisted, persisted)).toBe(false);
    for (const patch of domainChanges) {
      expect(isCandidateDraftDirty({ ...persisted, ...patch }, persisted)).toBe(true);
    }
    expect(isCandidateDraftDirty({
      ...persisted,
      reason: "Checked against the approved shop drawing",
      acknowledgeReviewItems: true,
    }, persisted)).toBe(false);
  });

  it("treats the candidate returned by a successful save as clean", () => {
    const savedResponseDraft = {
      ...candidateDraft(),
      materialName: "Walnut veneer MDF",
      notes: "Saved correction",
    };

    expect(isCandidateDraftDirty(savedResponseDraft, savedResponseDraft)).toBe(false);
  });

  it("detects every order-item domain edit but ignores review-only controls", () => {
    const persisted = orderItemDraft();
    const domainChanges: Partial<OrderItemDraft>[] = [
      { description: "Heavy-duty concealed hinge" },
      { quantity: "14" },
      { unit: "sets" },
      { category: "ELECTRICAL_ACCESSORY" },
      { suppliedByOthers: true },
      { notes: "Client supply" },
    ];

    expect(isOrderItemDraftDirty(persisted, persisted)).toBe(false);
    for (const patch of domainChanges) {
      expect(isOrderItemDraftDirty({ ...persisted, ...patch }, persisted)).toBe(true);
    }
    expect(isOrderItemDraftDirty({
      ...persisted,
      reason: "Checked against the hardware schedule",
      acknowledgeReviewItems: true,
    }, persisted)).toBe(false);
  });

  it("treats the order item returned by a successful save as clean", () => {
    const savedResponseDraft = {
      ...orderItemDraft(),
      quantity: "14",
      notes: "Saved correction",
    };

    expect(isOrderItemDraftDirty(savedResponseDraft, savedResponseDraft)).toBe(false);
  });
});
