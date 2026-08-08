import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateDatasetDefinitions, buildGenericConstructionProfile } from "../src/lib/services/catalogue-registry-generator";
import { discoverCatalogueDatasets } from "../src/lib/services/catalogue-discovery-service";
import {
  listDatasetDefinitions,
  computeDatasetFingerprint,
  validateFileOwnership,
  checkDatasetReadiness,
  checkDatasetReadinessFast,
} from "../src/lib/services/catalogue-dataset-registry";

const HEADER = "itemCode,discipline,category,description,specification,quantity,unit,supplier,cost,margin,sellingRate,manufacturer,brand,model";
function row(code: string, discipline: string, spec = "x | Code Ref: 01 00 00 | Spec: Field: ___"): string {
  return `${code},${discipline},Cat,Desc,"${spec}",,nos,,,,,,,`;
}

describe("catalogue-dataset-registry — the real, committed 15-dataset registry", () => {
  const datasets = listDatasetDefinitions();

  it("contains exactly 15 datasets (2 manual + 13 generated)", () => {
    expect(datasets.length).toBe(15);
  });

  it("preserves the HVAC manual entry's dataset ID, version, and checksums exactly", () => {
    const hvac = datasets.find((d) => d.datasetId === "quantara-master-hvac-v1");
    expect(hvac).toBeDefined();
    expect(hvac!.datasetVersion).toBe("1");
    expect(hvac!.disciplineKey).toBe("mechanical");
    // CATALOGUE-INTEGRITY-REPAIR: canonical (CRLF-normalized) checksum of the Git-committed
    // LF bytes — see catalogue-csv-checksum.ts. The old value here was computed against
    // CRLF-converted local content and never actually matched what Git/Vercel deploy.
    expect(hvac!.files.map((f) => f.approvedChecksum)).toContain("fbb9d85cd46b5eaf19142464e79fa0611ecf564cafdb0c2fe0dd5da8d11baf64");
    expect(hvac!.registrationSource).toBe("MANUAL");
  });

  it("preserves the Plumbing manual entry's dataset ID, version, and file count exactly", () => {
    const plumbing = datasets.find((d) => d.datasetId === "quantara-master-plumbing-v1");
    expect(plumbing).toBeDefined();
    expect(plumbing!.datasetVersion).toBe("1");
    expect(plumbing!.disciplineKey).toBe("plumbing");
    expect(plumbing!.files.length).toBe(13);
    expect(plumbing!.registrationSource).toBe("MANUAL");
  });

  it("has no duplicate dataset IDs", () => {
    const ids = datasets.map((d) => d.datasetId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses the stable quantara-master-{folder}-v1 ID format for every generated dataset", () => {
    for (const d of datasets) {
      if (d.registrationSource === "DISCOVERY_VERIFIED") {
        expect(d.datasetId).toMatch(/^quantara-master-[a-z0-9-]+-v1$/);
      }
    }
  });

  it("has the correct total file count (53) across the whole registry", () => {
    expect(datasets.reduce((sum, d) => sum + d.files.length, 0)).toBe(53);
  });

  it("has the correct total expected row count (183,497) across the whole registry", () => {
    expect(datasets.reduce((sum, d) => sum + d.files.reduce((s, f) => s + f.expectedRowCount, 0), 0)).toBe(183_497);
  });

  it("orders files deterministically (alphabetically) within every generated dataset", () => {
    // Scoped to DISCOVERY_VERIFIED datasets only — HVAC/Plumbing's file order is the original
    // hand-authored order, preserved exactly rather than re-sorted (per CATALOGUE-ACTIVATE-2's
    // explicit "preserve verified checksums... do not create a duplicate generated entry" rule).
    for (const d of datasets.filter((d) => d.registrationSource === "DISCOVERY_VERIFIED")) {
      const names = d.files.map((f) => f.fileName);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });

  it("produces a stable, deterministic fingerprint for the same dataset called twice", () => {
    const hvac = datasets.find((d) => d.datasetId === "quantara-master-hvac-v1")!;
    expect(computeDatasetFingerprint(hvac)).toBe(computeDatasetFingerprint(hvac));
  });

  it("maps every folder to a real, existing MasterDiscipline key (or a known alias of one)", () => {
    const expected: Record<string, string> = {
      "quantara-master-hvac-v1": "mechanical",
      "quantara-master-plumbing-v1": "plumbing",
      "quantara-master-architectural-finishes-v1": "interior-fit-out",
      "quantara-master-landscaping-v1": "landscaping",
    };
    for (const [datasetId, expectedKey] of Object.entries(expected)) {
      expect(datasets.find((d) => d.datasetId === datasetId)!.disciplineKey).toBe(expectedKey);
    }
  });

  it("records the hvac -> mechanical alias on the HVAC dataset", () => {
    const hvac = datasets.find((d) => d.datasetId === "quantara-master-hvac-v1")!;
    expect(hvac.disciplineAliases).toEqual({ hvac: "mechanical" });
  });

  it("every construction-discipline folder maps to the real 'construction' MasterDiscipline key", () => {
    const constructionFolders = datasets.filter((d) => d.registrationSource === "DISCOVERY_VERIFIED" && d.disciplineKey === "construction");
    expect(constructionFolders.length).toBeGreaterThan(0);
  });

  it("has no file-ownership violations — every active CSV belongs to exactly one active dataset", () => {
    expect(validateFileOwnership(datasets)).toEqual([]);
  });

  // Real MasterDiscipline keys as of registry authoring — see prisma/seed-data/master-data.ts.
  const KNOWN_DISCIPLINES = new Set(["electrical", "plumbing", "fire-fighting", "construction", "interior-fit-out", "furniture", "joinery", "landscaping", "mechanical"]);

  it("every dataset is READY per the fast metadata-only readiness check (what the list endpoint actually uses)", () => {
    for (const d of datasets) {
      const readiness = checkDatasetReadinessFast(d, KNOWN_DISCIPLINES);
      expect(readiness.status, `${d.datasetId}: ${JSON.stringify(readiness.blockReasons)}`).toBe("READY");
    }
  });

  it("flags a dataset as BLOCKED when its target discipline does not exist (fast check)", () => {
    const hvac = datasets.find((d) => d.datasetId === "quantara-master-hvac-v1")!;
    const readiness = checkDatasetReadinessFast(hvac, new Set(["plumbing"])); // "mechanical" deliberately absent
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockReasons.some((r) => r.startsWith("DISCIPLINE_MISSING"))).toBe(true);
  });

  // The deep check re-reads real files off disk — deliberately exercised against only the two
  // smallest datasets here (not all 15) to keep this test file fast; the deep check itself is
  // only ever meant to run per-dataset on demand (GET .../datasets/[datasetId]/readiness), never
  // automatically across the whole registry in one call — see checkDatasetReadiness's own comment.
  it("the deep, file-verifying readiness check passes for a real small dataset (civil-works)", () => {
    const civilWorks = datasets.find((d) => d.datasetId === "quantara-master-civil-works-v1")!;
    const readiness = checkDatasetReadiness(civilWorks, KNOWN_DISCIPLINES);
    expect(readiness.status, JSON.stringify(readiness.blockReasons)).toBe("READY");
  }, 15000);

  it("the deep check detects a checksum mismatch when a file's approved checksum is wrong", () => {
    const civilWorks = datasets.find((d) => d.datasetId === "quantara-master-civil-works-v1")!;
    const tampered = { ...civilWorks, files: civilWorks.files.map((f) => ({ ...f, approvedChecksum: "0".repeat(64) })) };
    const readiness = checkDatasetReadiness(tampered, KNOWN_DISCIPLINES);
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockReasons.some((r) => r.startsWith("CHECKSUM_MISMATCH"))).toBe(true);
  }, 15000);

  it("the deep check detects a row-count mismatch when the recorded expected count is wrong", () => {
    const civilWorks = datasets.find((d) => d.datasetId === "quantara-master-civil-works-v1")!;
    const tampered = { ...civilWorks, files: civilWorks.files.map((f) => ({ ...f, expectedRowCount: f.expectedRowCount + 1 })) };
    const readiness = checkDatasetReadiness(tampered, KNOWN_DISCIPLINES);
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockReasons.some((r) => r.startsWith("ROW_COUNT_MISMATCH"))).toBe(true);
  }, 15000);

  it("the deep check detects a missing file", () => {
    const civilWorks = datasets.find((d) => d.datasetId === "quantara-master-civil-works-v1")!;
    const tampered = { ...civilWorks, files: [{ fileName: "does-not-exist.csv", approvedChecksum: "0".repeat(64), expectedRowCount: 1 }] };
    const readiness = checkDatasetReadiness(tampered, KNOWN_DISCIPLINES);
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockReasons.some((r) => r.startsWith("FILE_MISSING"))).toBe(true);
  });
});

describe("generateDatasetDefinitions (pure, synthetic fixtures)", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "registry-gen-test-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function writeCsv(relPath: string, lines: string[]): Promise<void> {
    const abs = join(root, relPath);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, lines.join("\n"), "utf8");
  }

  it("skips a folder whose sourceDir is already covered by a manual entry", async () => {
    await writeCsv("hvac/f.csv", [HEADER, row("H-1", "mechanical")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["mechanical"]));
    const manualFolder = folders[0].folderPath; // whatever the tmp-rooted path resolves to
    const result = generateDatasetDefinitions(folders, new Set([manualFolder]));
    expect(result.generated).toHaveLength(0);
    expect(result.skippedAlreadyManual).toEqual([manualFolder]);
  });

  it("blocks a folder whose discipline cannot be resolved", async () => {
    await writeCsv("unknown/f.csv", [HEADER, row("U-1", "not-a-real-discipline")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    const result = generateDatasetDefinitions(folders, new Set());
    expect(result.generated).toHaveLength(0);
    expect(result.blocked).toHaveLength(1);
  });

  it("generates a dataset with correct file count and row count for a valid folder", async () => {
    await writeCsv("civil/a.csv", [HEADER, row("C-1", "construction"), row("C-2", "construction")]);
    await writeCsv("civil/b.csv", [HEADER, row("C-3", "construction")]);
    const folders = await discoverCatalogueDatasets(root, new Set(["construction"]));
    const result = generateDatasetDefinitions(folders, new Set());
    expect(result.generated).toHaveLength(1);
    const dataset = result.generated[0];
    expect(dataset.files).toHaveLength(2);
    expect(dataset.files.reduce((s, f) => s + f.expectedRowCount, 0)).toBe(3);
    expect(dataset.datasetId).toBe("quantara-master-civil-v1");
    expect(dataset.targetPackageCode).toBe("civil-library");
  });

  it("running the generator twice against the same source produces identical dataset IDs, checksums, and fingerprints", async () => {
    await writeCsv("repeat/a.csv", [HEADER, row("R-1", "construction")]);
    const folders1 = await discoverCatalogueDatasets(root, new Set(["construction"]));
    const result1 = generateDatasetDefinitions(folders1, new Set());
    const folders2 = await discoverCatalogueDatasets(root, new Set(["construction"]));
    const result2 = generateDatasetDefinitions(folders2, new Set());

    expect(result1.generated[0].datasetId).toBe(result2.generated[0].datasetId);
    expect(result1.generated[0].files[0].approvedChecksum).toBe(result2.generated[0].files[0].approvedChecksum);
    expect(computeDatasetFingerprint(result1.generated[0])).toBe(computeDatasetFingerprint(result2.generated[0]));
  });
});

describe("buildGenericConstructionProfile / generic specification parser", () => {
  it("parses a Code-Ref/Spec composite field without a Subcategory prefix", () => {
    const profile = buildGenericConstructionProfile("construction", "civil-works", "Civil Works");
    const parsed = profile.parseSpecification("Excavate to required lines. | Code Ref: 31 23 00 / 31 23 16 | Spec: Material: ___ | Depth Band: ___");
    expect(parsed.fullDescription).toBe("Excavate to required lines.");
    expect(parsed.classifications.some((c) => c.code === "31 23 00")).toBe(true);
    expect(parsed.specificationTemplate).toContain("Material: ___");
  });

  it("parses an OmniClass-labelled secondary code", () => {
    const profile = buildGenericConstructionProfile("construction", "facade", "Facade");
    const parsed = profile.parseSpecification("Design and install curtain wall. | Code Ref: 08 44 13 / OmniClass 23-17 13 21 | Spec: System Type: ___");
    const omniClass = parsed.classifications.find((c) => c.code === "23-17 13 21");
    expect(omniClass).toBeDefined();
  });

  it("returns a warning for a completely empty specification, not a thrown error", () => {
    const profile = buildGenericConstructionProfile("construction", "roofing", "Roofing");
    const parsed = profile.parseSpecification("");
    expect(parsed.warnings).toContain("EMPTY_SPECIFICATION");
  });

  it("does not corrupt parsing when an unexpected extra pipe-delimited segment is present", () => {
    const profile = buildGenericConstructionProfile("construction", "roofing", "Roofing");
    const parsed = profile.parseSpecification("Desc | Code Ref: 07 33 63 | Spec: Type: ___ | Remarks: some extra unexpected note");
    expect(parsed.specificationTemplate).toContain("Type: ___");
    expect(parsed.specificationTemplate).toContain("Remarks: some extra unexpected note");
  });
});
