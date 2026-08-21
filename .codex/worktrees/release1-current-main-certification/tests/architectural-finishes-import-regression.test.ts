import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGenericCodeRefSpecification } from "../src/lib/imports/generic-code-ref-specification-parser";
import { parseRows } from "../src/lib/services/master-catalogue-bulk-import-service";
import { requireDatasetDefinition } from "../src/lib/services/catalogue-dataset-registry";

const PART_3_FILE_NAME =
  "interior-fitout-architectural-finishes-part3of15-company-library-import.csv";
const PART_3_PATH = `data-imports/architectural-finishes/${PART_3_FILE_NAME}`;
const FAILED_BATCH_CURSOR = 46_800;
const FAILED_BATCH_SIZE = 200;

function loadPart3Rows() {
  return parseRows(readFileSync(PART_3_PATH, "utf8"));
}

function failedBatchLocalStart(): number {
  const dataset = requireDatasetDefinition("quantara-master-architectural-finishes-v1");
  const part3Index = dataset.files.findIndex((file) => file.fileName === PART_3_FILE_NAME);
  if (part3Index < 0) throw new Error("Architectural Finishes part 3 is missing from the registry");
  const part3GlobalStart = dataset.files
    .slice(0, part3Index)
    .reduce((total, file) => total + file.expectedRowCount, 0);
  return FAILED_BATCH_CURSOR - part3GlobalStart;
}

describe("Architectural Finishes production boundary regression", () => {
  it("loads and parses all 200 real rows at cursor 46,800 without warnings or exceptions", () => {
    const dataset = requireDatasetDefinition("quantara-master-architectural-finishes-v1");
    const { rows, malformed } = loadPart3Rows();
    const batchLocalStart = failedBatchLocalStart();
    const batch = rows.slice(
      batchLocalStart,
      batchLocalStart + FAILED_BATCH_SIZE,
    );

    expect(malformed).toHaveLength(0);
    expect(batchLocalStart).toBe(5_124);
    expect(batch).toHaveLength(200);
    expect(batch[0]).toMatchObject({ rowNumber: 5_125, itemCode: "ARCHFIN-16125" });
    expect(batch.at(-1)).toMatchObject({ rowNumber: 5_324, itemCode: "ARCHFIN-16324" });

    for (const row of batch) {
      expect(() => dataset.profile.parseSpecification(row.specification)).not.toThrow();
      const parsed = dataset.profile.parseSpecification(row.specification);
      expect(parsed.warnings, row.itemCode).toEqual([]);
      expect(parsed.classifications, row.itemCode).toEqual([
        expect.objectContaining({ code: "09 63 00", isPrimary: true }),
      ]);
    }
  });

  it("preserves the established parse result for the first real boundary row", () => {
    const dataset = requireDatasetDefinition("quantara-master-architectural-finishes-v1");
    const { rows } = loadPart3Rows();
    const row = rows[failedBatchLocalStart()];
    const parsed = dataset.profile.parseSpecification(row.specification);

    expect(parsed.fullDescription).toBe(
      "Supply and install natural stone floor finish complete with substrate preparation, approved fixing system, joints, trims, accessories, protection and making good, suitable for external sheltered area.",
    );
    expect(parsed.specificationTemplate).toContain("Thickness: 18 mm");
    expect(parsed.specificationTemplate).toContain("Finish: Satin");
    expect(parsed.classifications).toEqual([
      expect.objectContaining({ code: "09 63 00", isPrimary: true }),
    ]);
  });

  it("returns a governed warning for an unsupported code reference instead of throwing", () => {
    const parsed = parseGenericCodeRefSpecification(
      "Supply and install a reviewed finish. | Code Ref: CONSULTANT-SCHEDULE-A7 | Spec: Material/Type: ___",
    );

    expect(parsed.warnings).toContain("CODE_REF_UNEXPECTED_FORMAT");
    expect(parsed.masterFormatCode).toBe("CONSULTANT-SCHEDULE-A7");
    expect(parsed.specificationTemplate).toBe("Material/Type: ___");
  });

  it("rejects a structurally malformed row through the existing controlled row outcome", () => {
    const csv = [
      "itemCode,discipline,category,description,specification,quantity,unit,supplier,cost,margin,sellingRate,manufacturer,brand,model",
      'ARCHFIN-BAD-1,interior-fit-out,Stone,Missing unit,"Desc | Code Ref: 09 63 00 | Spec: Type: ___",,,,,,,,,',
    ].join("\n");

    const parsed = parseRows(csv);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.malformed).toEqual([
      expect.objectContaining({
        itemCode: "ARCHFIN-BAD-1",
        outcome: "rejected",
        reason: expect.stringMatching(/unit/i),
      }),
    ]);
  });
});
