import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

describe("Joinery workspace UI and navigation guard", () => {
  it("adds the workspace link through an exact-industry visibility component", () => {
    const layout = source("src/app/projects/[projectId]/layout.tsx");
    const link = source("src/components/projects/joinery-workspace-link.tsx");

    expect(layout).toContain("<JoineryWorkspaceLink projectId={projectId} />");
    expect(link).toContain("project.industryId === JOINERY_INDUSTRY_KEY");
    expect(link).toContain("if (!visible) return null");
    expect(link).toContain("/joinery`");
  });

  it("keeps correction, approval and generated-output actions on dedicated guarded endpoints", () => {
    const page = source("src/app/projects/[projectId]/joinery/page.tsx");

    expect(page).toContain("project.industryId !== JOINERY_INDUSTRY_KEY");
    expect(page).toContain("/joinery/candidates");
    expect(page).toContain("/joinery/candidates/${encodeURIComponent(entry.id)}");
    expect(page).toContain("/joinery/order-items");
    expect(page).toContain("/joinery/order-items/${encodeURIComponent(entry.id)}");
    expect(page).toContain("/approve");
    expect(page).toContain("/joinery/generate-boq");
    expect(page).toContain("Correction saved with its original source evidence.");
    expect(page).toContain("Verified values approved and locked.");
  });

  it("removes managed furniture candidates from the generic review and AI Draft presentation", () => {
    const genericReview = source("src/app/projects/[projectId]/extractions/page.tsx");
    const aiDraft = source("src/lib/services/ai-draft-boq-service.ts");

    expect(genericReview).toContain("entity.categoryKey !== FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND");
    expect(genericReview).toContain("entity.categoryKey !== FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND");
    expect(genericReview).toContain("Open Joinery workspace");
    expect(aiDraft).toContain("{ categoryKey: { notIn: [");
    expect(aiDraft).toContain("FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND");
    expect(aiDraft).toContain("FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND");
  });

  it("renders separate order controls and keeps generation disabled until active rows are locked", () => {
    const page = source("src/app/projects/[projectId]/joinery/page.tsx");

    expect(page).toContain("Hardware, accessories and specialist order items");
    expect(page).toContain("Order category");
    expect(page).toContain("Ordering unit");
    expect(page).toContain("Supplied by others");
    expect(page).toContain("Hardware/order item correction saved with source evidence.");
    expect(page).toContain("Hardware/order item approved and locked.");
    expect(page).toContain("activeCandidates.every((entry) => entry.status === \"CONFIRMED\")");
    expect(page).toContain("activeOrderItems.every((entry) => entry.status === \"CONFIRMED\")");
    expect(page).toContain("!readyToGenerate");
    expect(page).toContain("Review and lock every detected part and hardware/order item before generating outputs.");
  });

  it("exposes governed false-positive exclusion without counting rejected rows in generation", () => {
    const page = source("src/app/projects/[projectId]/joinery/page.tsx");
    const service = source("src/lib/services/furniture-boq-service.ts");

    expect(page).toContain("Exclude false positive");
    expect(page).toContain("/reject");
    expect(page).toContain("Excluded false positive");
    expect(page).toContain("entry.status !== \"REJECTED\"");
    expect(service).toContain("status: { not: ExtractedEntityStatus.REJECTED }");
  });

  it("blocks candidate and order-item approval until domain corrections are saved", () => {
    const page = source("src/app/projects/[projectId]/joinery/page.tsx");

    expect(page).toContain("isCandidateDraftDirty(draft, draftFrom(entry.candidate))");
    expect(page).toContain("isOrderItemDraftDirty(draft, orderDraftFrom(entry.candidate))");
    expect(page).toContain("blocking.length > 0 || hasUnsavedDomainFields");
    expect(page).toContain("Save correction before approval");
    expect(page).toContain("[updated.id]: draftFrom(updated.candidate)");
    expect(page).toContain("[updated.id]: orderDraftFrom(updated.candidate)");
  });
});
