import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverCatalogueDatasets } from "../src/lib/services/catalogue-discovery-service";

const HEADER = "itemCode,discipline,category,description,specification,quantity,unit,supplier,cost,margin,sellingRate,manufacturer,brand,model";

function row(itemCode: string, discipline: string, category: string, description: string, specification = "spec"): string {
  return `${itemCode},${discipline},${category},${description},"${specification}",,nos,,,,,,,`;
}

let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "catalogue-discovery-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeCsv(relPath: string, lines: string[]): Promise<void> {
  const abs = join(root, relPath);
  await mkdir(join(abs, ".."), { recursive: true });
  await writeFile(abs, lines.join("\n"), "utf8");
}

describe("catalogue-discovery-service", () => {
  it("recursively discovers CSVs and supports a folder with a single file", async () => {
    await writeCsv("hvac/hvac-file.csv", [HEADER, row("HVAC-1", "mechanical", "Fans", "Exhaust fan")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["mechanical"]));
    expect(folders).toHaveLength(1);
    expect(folders[0].folderPath.endsWith("hvac")).toBe(true);
    expect(folders[0].totalFileCount).toBe(1);
    expect(folders[0].totalRowCount).toBe(1);
  });

  it("supports a folder with many files (8+)", async () => {
    const files = Array.from({ length: 9 }, (_, i) => `plumbing/part${i + 1}.csv`);
    for (const f of files) {
      await writeCsv(f, [HEADER, row(`P-${f}`, "plumbing", "Valves", "Gate valve")]);
    }
    const folders = await discoverCatalogueDatasets(root, new Set(["plumbing"]));
    expect(folders[0].totalFileCount).toBe(9);
    expect(folders[0].totalRowCount).toBe(9);
  });

  it("ignores non-CSV files in the same folder", async () => {
    await writeCsv("civil/data.csv", [HEADER, row("C-1", "construction", "Earthworks", "Excavation")]);
    await writeFile(join(root, "civil", "notes.txt"), "not a dataset");
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].totalFileCount).toBe(1);
  });

  it("returns files in deterministic (alphabetical) order", async () => {
    await writeCsv("multi/c-file.csv", [HEADER, row("C-1", "construction", "X", "x")]);
    await writeCsv("multi/a-file.csv", [HEADER, row("A-1", "construction", "X", "x")]);
    await writeCsv("multi/b-file.csv", [HEADER, row("B-1", "construction", "X", "x")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].files.map((f) => f.fileName)).toEqual(["a-file.csv", "b-file.csv", "c-file.csv"]);
  });

  it("computes a stable checksum for unchanged file content across two runs", async () => {
    await writeCsv("stable/file.csv", [HEADER, row("S-1", "construction", "X", "x")]);
    const first = await discoverCatalogueDatasets(root, new Set(["construction"]));
    const second = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(first[0].files[0].checksum).toBe(second[0].files[0].checksum);
    expect(first[0].files[0].checksum).toHaveLength(64); // sha256 hex
  });

  it("aggregates total rows correctly across multiple files in one folder", async () => {
    await writeCsv("agg/a.csv", [HEADER, row("A-1", "construction", "X", "x"), row("A-2", "construction", "X", "x")]);
    await writeCsv("agg/b.csv", [HEADER, row("B-1", "construction", "X", "x")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].totalRowCount).toBe(3);
  });

  it("classifies a clean, recognized folder as AUTO_VALIDATED", async () => {
    await writeCsv("hvac/f.csv", [HEADER, row("H-1", "mechanical", "Fans", "Exhaust fan")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["mechanical"]));
    expect(folders[0].confidence).toBe("AUTO_VALIDATED");
    expect(folders[0].candidateDisciplineCode).toBe("mechanical");
  });

  it("flags a discipline value with no matching MasterDiscipline key as NEEDS_OWNER_REVIEW", async () => {
    await writeCsv("hvac/f.csv", [HEADER, row("H-1", "hvac", "Fans", "Exhaust fan")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["mechanical"])); // "hvac" not in known keys
    expect(folders[0].confidence).toBe("NEEDS_OWNER_REVIEW");
    expect(folders[0].candidateDisciplineCode).toBeNull();
    expect(folders[0].warnings.join(" ")).toContain("hvac");
  });

  it("flags mixed/conflicting discipline values within one folder as NEEDS_OWNER_REVIEW", async () => {
    await writeCsv("mixed/a.csv", [HEADER, row("A-1", "construction", "X", "x")]);
    await writeCsv("mixed/b.csv", [HEADER, row("B-1", "plumbing", "X", "x")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction", "plumbing"]));
    expect(folders[0].confidence).toBe("NEEDS_OWNER_REVIEW");
  });

  it("rejects an empty folder with no CSV files", async () => {
    await mkdir(join(root, "empty"), { recursive: true });
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].confidence).toBe("REJECTED");
  });

  it("flags a mismatched header schema with a warning", async () => {
    await writeCsv("badheader/f.csv", ["name,cost", "Something,10"]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].warnings.some((w) => w.includes("header"))).toBe(true);
  });

  it("does not count blank lines as data rows", async () => {
    await writeCsv("blanks/f.csv", [HEADER, row("A-1", "construction", "X", "x"), "", row("A-2", "construction", "X", "x")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].totalRowCount).toBe(2);
    expect(folders[0].files[0].blankRowCount).toBe(1);
  });

  it("handles a quoted field containing an embedded comma correctly (does not miscount fields)", async () => {
    await writeCsv("quoted/f.csv", [HEADER, `Q-1,construction,X,desc,"Supply, install and test",,nos,,,,,,,`]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].totalRowCount).toBe(1);
    expect(folders[0].files[0].headerMatchesExpected).toBe(true);
  });

  it("handles a quoted field containing an embedded newline as one logical row, not two", async () => {
    await writeCsv("multiline/f.csv", [HEADER, `M-1,construction,X,desc,"Line one\nLine two",,nos,,,,,,,`]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    expect(folders[0].totalRowCount).toBe(1);
  });
});
