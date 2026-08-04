import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MasterClassificationSystem } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { computeChecksum } from "@/lib/files/file-security";
import { parseHvacSpecification } from "@/lib/imports/hvac-specification-parser";
import { parsePlumbingSpecification } from "@/lib/imports/plumbing-specification-parser";
import { PLUMBING_PROFILE } from "@/lib/services/plumbing-master-import-service";
import type { BulkImportProfile, ParsedSpecification } from "@/lib/services/master-catalogue-bulk-import-service";

/**
 * CATALOGUE-PROD-ACTIVATE — the server-side, code-controlled registry of
 * datasets the platform owner may activate in production. Replaces the
 * filename-only, browser-upload-driven registry from CATALOGUE-CLOSE: a
 * dataset here has a stable ID and version independent of any filename, an
 * approved checksum per file (verified against the actual file at read
 * time — a changed or missing file is rejected, not silently accepted),
 * and the same hierarchy/parser profile the generic bulk-import engine
 * already uses, so activating through this path produces byte-identical
 * results to the already-tested local CLI import.
 *
 * Only PLATFORM_OWNER may reach any function here (enforced by every
 * caller — this module itself does no authorization, matching the rest of
 * the master-catalogue service layer's convention of gating at the
 * service/route boundary).
 */

const HVAC_PROFILE: BulkImportProfile = {
  disciplineKey: "mechanical",
  hierarchyParentChain: [
    { code: "construction", name: "Construction", nodeType: "INDUSTRY" },
    { code: "construction.mechanical", name: "Mechanical", nodeType: "DISCIPLINE" },
    { code: "construction.mechanical.hvac", name: "HVAC", nodeType: "SYSTEM" },
  ],
  parseSpecification: (raw: string): ParsedSpecification => {
    const parsed = parseHvacSpecification(raw);
    const classifications: ParsedSpecification["classifications"] = [];
    if (parsed.masterFormatCode) classifications.push({ system: MasterClassificationSystem.MASTERFORMAT_2020, code: parsed.masterFormatCode, isPrimary: true });
    if (parsed.omniClassCode) classifications.push({ system: MasterClassificationSystem.OMNICLASS, code: parsed.omniClassCode, label: parsed.omniClassLabel });
    return {
      fullDescription: parsed.summary,
      specificationTemplate: parsed.specificationTemplate,
      subcategory: null,
      classifications,
      warnings: parsed.warnings,
    };
  },
};

export type DatasetFileManifestEntry = {
  fileName: string;
  /** Approved sha256 — computed once from the validated source and hardcoded here; verified against the live file on every read. */
  approvedChecksum: string;
  expectedRowCount: number;
};

export type DatasetDefinition = {
  datasetId: string;
  datasetVersion: string;
  label: string;
  disciplineKey: string;
  /** Directory relative to the repo root — never taken from user input. */
  sourceDir: string;
  files: DatasetFileManifestEntry[];
  profile: BulkImportProfile;
};

const DATASETS: DatasetDefinition[] = [
  {
    datasetId: "quantara-master-hvac-v1",
    datasetVersion: "1",
    label: "HVAC Master Catalogue",
    disciplineKey: "mechanical",
    sourceDir: "data-imports/hvac",
    files: [
      { fileName: "hvac-company-library-import.csv", approvedChecksum: "3f53af3f2617227bdf1634b3b41c022ece1253e7d015a4259edca80caf58007a", expectedRowCount: 707 },
      { fileName: "hvac-air-distribution-company-library-import.csv", approvedChecksum: "5637cd11dc85f13de2d5ff5e4eb4dcd7944402773333497bc02c73f9260900b5", expectedRowCount: 184 },
    ],
    profile: HVAC_PROFILE,
  },
  {
    datasetId: "quantara-master-plumbing-v1",
    datasetVersion: "1",
    label: "Plumbing Master Catalogue",
    disciplineKey: "plumbing",
    sourceDir: "data-imports/plumbing",
    files: [
      { fileName: "plumbing-common-plumbing-work-results-company-library-import.csv", approvedChecksum: "4eb85d2958740c470b874fb775b16aba6dd0cf05f7d77e653837ea4ba685e7b7", expectedRowCount: 61 },
      { fileName: "plumbing-drainage-specialties-company-library-import.csv", approvedChecksum: "d6caee0cdee0f2f7047e3eda4486437d459c84c2a77c293767fef0a8963201b3", expectedRowCount: 124 },
      { fileName: "plumbing-fixture-fittings-and-accessories-company-library-import.csv", approvedChecksum: "78e0c26f55ed64fa58f879861ceb90a44a65e6be7c1fb679f7cd34e6d6e31c44", expectedRowCount: 132 },
      { fileName: "plumbing-instrumentation-and-controls-company-library-import.csv", approvedChecksum: "6a24a7b714056c238e6df9dacc04a8193155072e60ca3834efc97229c569bbfb", expectedRowCount: 145 },
      { fileName: "plumbing-medical-and-laboratory-systems-company-library-import.csv", approvedChecksum: "3d56b665f06ee4080c867267d53151518dffc977cfdd78b3f49755f33d494f8f", expectedRowCount: 51 },
      { fileName: "plumbing-piping-systems-part1-company-library-import.csv", approvedChecksum: "ac0cf1d47a01c4cce2a8d8fa2c40ddda09bc5e73dd44b22403a24df722fe56ba", expectedRowCount: 3000 },
      { fileName: "plumbing-piping-systems-part2-company-library-import.csv", approvedChecksum: "b48ec774c4e1edd9dd7a143b840468790ee2ffc3f593b30b6e94a80d50503bd0", expectedRowCount: 3000 },
      { fileName: "plumbing-piping-systems-part3-company-library-import.csv", approvedChecksum: "9aee1875cea8156c4221789f09ea0c53d794b726de16bf419f07807b56fb6ebf", expectedRowCount: 3000 },
      { fileName: "plumbing-piping-systems-part4-company-library-import.csv", approvedChecksum: "19d176e2e75fe008f2772fb59e54f275a0fcc9305c49995b1cdc5828c23363b2", expectedRowCount: 1198 },
      { fileName: "plumbing-plumbing-equipment-company-library-import.csv", approvedChecksum: "50bb0bb405de5b428b0f9787d079f55bac6d8ea7f715a8f5fef981edf0bfcbfa", expectedRowCount: 280 },
      { fileName: "plumbing-plumbing-fixtures-company-library-import.csv", approvedChecksum: "a17a21ecf3856b0eb1a3e73a616f0df71c144c1cb19f9f0fa2883b0c95f7d12d", expectedRowCount: 320 },
      { fileName: "plumbing-pool-and-fountain-plumbing-company-library-import.csv", approvedChecksum: "fb0b736f8cc9874b118cf91425bff788792247d789e4530dee58e3c659c963eb", expectedRowCount: 84 },
      { fileName: "plumbing-valves-and-piping-specialties-company-library-import.csv", approvedChecksum: "03c9aa4df169418b33bc245dc0970b8aedf0ae52eff106c1bacc506f7b3b0e62", expectedRowCount: 1716 },
    ],
    profile: PLUMBING_PROFILE,
  },
];

export function listDatasetDefinitions(): DatasetDefinition[] {
  return DATASETS;
}

export function getDatasetDefinition(datasetId: string): DatasetDefinition | null {
  return DATASETS.find((d) => d.datasetId === datasetId) ?? null;
}

export function requireDatasetDefinition(datasetId: string): DatasetDefinition {
  const dataset = getDatasetDefinition(datasetId);
  if (!dataset) throw new AppError("UNKNOWN_DATASET", `No approved dataset registered for ID "${datasetId}".`, 404);
  return dataset;
}

/** Combined identity of a dataset's exact approved file set — changes if any file's content, the file list, or its order changes. */
export function computeDatasetSourceChecksum(dataset: DatasetDefinition): string {
  return computeChecksum(Buffer.from(dataset.files.map((f) => f.approvedChecksum).join("|"), "utf-8"));
}

export type LoadedDatasetFile = { fileName: string; csvText: string; actualChecksum: string };

/**
 * Reads every file in the dataset's manifest from the repository's own
 * data-imports/ directory (never a client-supplied path) and verifies each
 * one's checksum against the registry's approved value — an altered or
 * missing file throws rather than silently importing unapproved content.
 */
export function loadApprovedDatasetFiles(dataset: DatasetDefinition): LoadedDatasetFile[] {
  return dataset.files.map((manifestEntry) => {
    const fullPath = join(process.cwd(), dataset.sourceDir, manifestEntry.fileName);
    let buffer: Buffer;
    try {
      buffer = readFileSync(fullPath);
    } catch {
      throw new AppError("SOURCE_FILE_MISSING", `Approved source file "${manifestEntry.fileName}" for dataset "${dataset.datasetId}" was not found on the server.`, 500);
    }
    const actualChecksum = computeChecksum(buffer);
    if (actualChecksum !== manifestEntry.approvedChecksum) {
      throw new AppError(
        "SOURCE_FILE_CHECKSUM_MISMATCH",
        `Source file "${manifestEntry.fileName}" does not match its approved checksum. It may have been altered — register a new dataset version instead of importing an unapproved file.`,
        409,
      );
    }
    return { fileName: manifestEntry.fileName, csvText: buffer.toString("utf-8"), actualChecksum };
  });
}
