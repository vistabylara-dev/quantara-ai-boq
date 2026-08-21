import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("PR #23 review follow-up integrity", () => {
  it("registers the complete handler composition before every supported extraction dispatch", () => {
    for (const path of [
      "src/lib/services/table-extraction-service.ts",
      "src/lib/services/drawing-page-service.ts",
      "src/lib/services/project-file-service.ts",
    ]) {
      expect(source(path)).toContain('await import("@/lib/jobs/register-handlers");');
    }
  });

  it("keeps source selection stable while processing is busy", () => {
    const text = source("src/app/projects/[projectId]/files/page.tsx");
    expect(text).toMatch(/onClick=\{\(\) => void loadDetail\(file\.id\)\}[\s\S]{0,160}disabled=\{busy\}/);
  });

  it("does not show the reviewed-extraction empty state before the first request completes", () => {
    const text = source("src/components/boq/add-item-from-source-modal.tsx");
    expect(text).toContain("const [hasLoadedReviewed, setHasLoadedReviewed] = useState(false);");
    expect(text).toContain("setHasLoadedReviewed(true);");
    expect(text).toContain("!isLoadingReviewed && hasLoadedReviewed && reviewedEntities.length === 0");
  });

  it("keeps the source-to-candidate bridge exhaustive across every table and every stored row", () => {
    const text = source("src/lib/services/source-candidate-bridge-service.ts");
    expect(text).toContain("for (const table of tables)");
    expect(text).toContain("for (const row of table.rows)");
    expect(text).toContain("headerTitles,");
  });
});
