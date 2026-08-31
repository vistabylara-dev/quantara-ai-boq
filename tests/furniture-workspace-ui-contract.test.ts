import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

describe("Furniture workspace UI and navigation guard", () => {
  it("adds the workspace link through an exact-industry visibility component", () => {
    const layout = source("src/app/projects/[projectId]/layout.tsx");
    const link = source("src/components/projects/furniture-workspace-link.tsx");

    expect(layout).toContain("<FurnitureWorkspaceLink projectId={projectId} />");
    expect(link).toContain("project.industryId === FURNITURE_JOINERY_INDUSTRY_KEY");
    expect(link).toContain("if (!visible) return null");
    expect(link).toContain("/furniture`");
  });

  it("keeps correction, approval and generated-output actions on dedicated guarded endpoints", () => {
    const page = source("src/app/projects/[projectId]/furniture/page.tsx");

    expect(page).toContain("project.industryId !== FURNITURE_JOINERY_INDUSTRY_KEY");
    expect(page).toContain("/furniture/candidates");
    expect(page).toContain("/furniture/candidates/${encodeURIComponent(entry.id)}");
    expect(page).toContain("/furniture/order-items");
    expect(page).toContain("/furniture/order-items/${encodeURIComponent(entry.id)}");
    expect(page).toContain("/approve");
    expect(page).toContain("/furniture/generate-boq");
    expect(page).toContain("Correction saved with its original source evidence.");
    expect(page).toContain("Verified values approved and locked.");
  });

  it("removes managed furniture candidates from the generic review and AI Draft presentation", () => {
    const genericReview = source("src/app/projects/[projectId]/extractions/page.tsx");
    const aiDraft = source("src/lib/services/ai-draft-boq-service.ts");

    expect(genericReview).toContain("entity.categoryKey !== FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND");
    expect(genericReview).toContain("entity.categoryKey !== FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND");
    expect(genericReview).toContain("Open Furniture workspace");
    expect(aiDraft).toContain("{ categoryKey: { notIn: [");
    expect(aiDraft).toContain("FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND");
    expect(aiDraft).toContain("FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND");
  });

  it("renders separate order controls and keeps generation disabled until parts and order items are locked", () => {
    const page = source("src/app/projects/[projectId]/furniture/page.tsx");

    expect(page).toContain("Hardware, accessories and specialist order items");
    expect(page).toContain("Order category");
    expect(page).toContain("Ordering unit");
    expect(page).toContain("Supplied by others");
    expect(page).toContain("Hardware/order item correction saved with source evidence.");
    expect(page).toContain("Hardware/order item approved and locked.");
    expect(page).toContain("stats.lockedOrderItems !== orderItems.length");
    expect(page).toContain("Review and lock every detected part and hardware/order item before generating outputs.");
  });
});
