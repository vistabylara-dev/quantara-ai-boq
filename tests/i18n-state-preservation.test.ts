import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("locale switching preserves in-progress authenticated work", () => {
  it("does not refetch BOQ workspace data when only the translator changes", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/app/projects/[projectId]/boq/page.tsx"),
      "utf8",
    );

    expect(source).toContain("}, [params.projectId]);");
    expect(source).not.toContain("}, [params.projectId, t]);");
  });

  it("does not replace measurement inputs when only the locale changes", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/components/boq/quantity-calculation-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("[calculationType, definition, extractedEntityId, projectId, selectedRoomId]");
    expect(source).toContain("[calculationType, definition, dimensionValues]");
    expect(
      source.match(/\}, \[calculationType, definition, extractedEntityId, projectId, selectedRoomId\]\);/g),
    ).toHaveLength(1);
    expect(
      source.match(/\}, \[calculationType, definition, dimensionValues\]\);/g),
    ).toHaveLength(1);
  });
});
