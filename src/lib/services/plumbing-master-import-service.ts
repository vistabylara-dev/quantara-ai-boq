import { MasterClassificationSystem } from "@prisma/client";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { parsePlumbingSpecification } from "@/lib/imports/plumbing-specification-parser";
import { dryRunBulkImport, executeBulkImport, type BulkImportInput, type BulkImportProfile, type ParsedSpecification } from "@/lib/services/master-catalogue-bulk-import-service";

/**
 * CATALOGUE-CLOSE — plumbing dataset profile for the generic bulk import
 * engine. Exported so CATALOGUE-PROD-ACTIVATE's dataset registry can reuse
 * this exact profile (same hierarchy codes, same parser) for the resumable
 * production job path, instead of redefining it and risking drift between
 * the two.
 */
export const PLUMBING_PROFILE: BulkImportProfile = {
  disciplineKey: "plumbing",
  hierarchyParentChain: [
    { code: "construction", name: "Construction", nodeType: "INDUSTRY" },
    { code: "construction.plumbing", name: "Plumbing", nodeType: "DISCIPLINE" },
  ],
  parseSpecification: (raw: string): ParsedSpecification => {
    const parsed = parsePlumbingSpecification(raw);
    const classifications: ParsedSpecification["classifications"] = [];
    if (parsed.masterFormatCode) classifications.push({ system: MasterClassificationSystem.MASTERFORMAT_2020, code: parsed.masterFormatCode, isPrimary: true });
    if (parsed.omniClassCode) classifications.push({ system: MasterClassificationSystem.OMNICLASS, code: parsed.omniClassCode });
    return {
      fullDescription: parsed.summary,
      specificationTemplate: parsed.specificationTemplate,
      subcategory: parsed.subcategory || null,
      classifications,
      warnings: parsed.warnings,
    };
  },
};

export async function dryRunPlumbingImport(owner: PlatformActor, input: BulkImportInput) {
  return dryRunBulkImport(owner, PLUMBING_PROFILE, input);
}

export async function executePlumbingImport(owner: PlatformActor, input: BulkImportInput) {
  return executeBulkImport(owner, PLUMBING_PROFILE, input);
}
