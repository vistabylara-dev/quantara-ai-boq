import { MasterClassificationSystem } from "@prisma/client";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { parsePlumbingSpecification } from "@/lib/imports/plumbing-specification-parser";
import { dryRunBulkImport, executeBulkImport, type BulkImportInput, type BulkImportProfile, type ParsedSpecification } from "@/lib/services/master-catalogue-bulk-import-service";

/** CATALOGUE-CLOSE — plumbing dataset profile for the generic bulk import engine. */
const PLUMBING_PROFILE: BulkImportProfile = {
  disciplineKey: "plumbing",
  hierarchyIndustryCode: "construction",
  hierarchyIndustryName: "Construction",
  hierarchyDisciplineCode: "construction.plumbing",
  hierarchyDisciplineName: "Plumbing",
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
