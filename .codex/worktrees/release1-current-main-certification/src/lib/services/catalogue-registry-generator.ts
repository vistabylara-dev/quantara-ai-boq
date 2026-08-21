import type { DiscoveredFolder } from "@/lib/services/catalogue-discovery-service";
import { parseGenericCodeRefSpecification, toParsedSpecification } from "@/lib/imports/generic-code-ref-specification-parser";
import type { BulkImportProfile } from "@/lib/services/master-catalogue-bulk-import-service";
import type { DatasetDefinition, DatasetFileManifestEntry } from "@/lib/services/catalogue-dataset-registry";

/**
 * CATALOGUE-ACTIVATE-2 — a controlled, deterministic code generator, not a
 * runtime dependency. Its job is to turn a discovery result into
 * DatasetDefinition entries; the output is meant to be reviewed and pasted
 * into catalogue-dataset-registry.ts's static DATASETS array, exactly like
 * the hand-written HVAC/Plumbing entries — never evaluated live at request
 * time. This preserves the existing safety model (a dataset's approved
 * checksums are a committed constant, verified against the live file on
 * every read; a changed file is rejected, not silently re-approved) rather
 * than replacing it with something that would silently absorb a source
 * file edit into a new "approved" state without review.
 *
 * Re-run this (see scripts usage in tests) whenever data-imports/ changes
 * and the registry needs to be regenerated — always diff the output before
 * committing it.
 */

/** Folder discipline-column value -> real MasterDiscipline.key, for values that don't already match verbatim. */
export const DISCIPLINE_ALIASES: Record<string, string> = {
  hvac: "mechanical",
};

const FOLDER_LABELS: Record<string, string> = {
  "architectural-finishes": "Architectural Finishes",
  "bim-digital-deliverables": "BIM & Digital Deliverables",
  "civil-works": "Civil Works",
  closeout: "Closeout",
  "doors-and-windows": "Doors and Windows",
  facade: "Facade",
  "general-requirements": "General Requirements",
  landscaping: "Landscaping",
  roofing: "Roofing",
  "site-infrastructure": "Site Infrastructure",
  structural: "Structural",
  "temporary-works": "Temporary Works",
  "uae-authority-regulatory": "UAE Authority & Regulatory",
};

export const GENERIC_SCHEMA_PROFILE_ID = "company-library-catalogue-v1";
export const HVAC_SCHEMA_PROFILE_ID = "hvac-specification-v1";
export const PLUMBING_SCHEMA_PROFILE_ID = "plumbing-specification-v1";

function folderNameFromPath(folderPath: string): string {
  return folderPath.split("/").pop() ?? folderPath;
}

/**
 * One shared parseSpecification implementation for every generic
 * (non-HVAC, non-Plumbing) dataset — see generic-code-ref-specification-parser.ts
 * for why this is safe to share: all 13 folders were verified (one sample
 * row each) to use the same "{description} | Code Ref: ... | Spec: ..."
 * composite shape. Only the hierarchy chain differs per folder.
 */
export function buildGenericConstructionProfile(disciplineKey: string, folderSlug: string, systemLabel: string): BulkImportProfile {
  return {
    disciplineKey,
    hierarchyParentChain: [
      { code: "construction", name: "Construction", nodeType: "INDUSTRY" },
      { code: `construction.${disciplineKey}`, name: disciplineKey === "construction" ? "Construction" : systemLabel, nodeType: "DISCIPLINE" },
      { code: `construction.${disciplineKey}.${folderSlug}`, name: systemLabel, nodeType: "SYSTEM" },
    ],
    parseSpecification: (raw: string) => toParsedSpecification(parseGenericCodeRefSpecification(raw)),
  };
}

export type GeneratedDatasetResult = {
  generated: DatasetDefinition[];
  skippedAlreadyManual: string[];
  blocked: { folder: string; reason: string }[];
};

/**
 * Pure function: discovery result + the set of source folders already
 * covered by a hand-written manual entry (HVAC, Plumbing) in, produces new
 * DatasetDefinition entries for everything else. Never touches the
 * filesystem or database itself — folders must already be classified by
 * discoverCatalogueDatasets().
 */
export function generateDatasetDefinitions(folders: DiscoveredFolder[], manualSourceDirs: Set<string>): GeneratedDatasetResult {
  const generated: DatasetDefinition[] = [];
  const skippedAlreadyManual: string[] = [];
  const blocked: { folder: string; reason: string }[] = [];

  for (const folder of folders) {
    if (manualSourceDirs.has(folder.folderPath)) {
      skippedAlreadyManual.push(folder.folderPath);
      continue;
    }

    const folderName = folderNameFromPath(folder.folderPath);
    const rawDiscipline = folder.candidateDisciplineCode;
    if (!rawDiscipline) {
      blocked.push({ folder: folder.folderPath, reason: folder.warnings.join("; ") || "no resolvable discipline" });
      continue;
    }

    const label = FOLDER_LABELS[folderName] ?? folderName;
    const files: DatasetFileManifestEntry[] = [...folder.files]
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
      .map((f) => ({ fileName: f.fileName, approvedChecksum: f.checksum, expectedRowCount: f.rowCount }));

    const dataset: DatasetDefinition = {
      datasetId: `quantara-master-${folderName}-v1`,
      datasetVersion: "1",
      label: `${label} Master Catalogue`,
      disciplineKey: rawDiscipline,
      sourceDir: folder.folderPath,
      files,
      profile: buildGenericConstructionProfile(rawDiscipline, folderName, label),
      industryCode: "CONSTRUCTION",
      targetPackageCode: `${folderName}-library`,
      schemaProfileId: GENERIC_SCHEMA_PROFILE_ID,
      active: true,
      approved: folder.confidence === "AUTO_VALIDATED",
      registrationSource: "DISCOVERY_VERIFIED",
      validationStatus: folder.confidence === "AUTO_VALIDATED" ? "VALIDATED" : folder.confidence === "VALIDATED_WITH_WARNINGS" ? "VALIDATED_WITH_WARNINGS" : "NEEDS_REVIEW",
      notes: folder.warnings.length > 0 ? [...folder.warnings] : undefined,
    };

    generated.push(dataset);
  }

  return { generated, skippedAlreadyManual, blocked };
}
