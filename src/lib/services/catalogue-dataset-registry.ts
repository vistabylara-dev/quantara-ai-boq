import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MasterClassificationSystem } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { computeChecksum } from "@/lib/files/file-security";
import { computeCatalogueCsvChecksum } from "@/lib/services/catalogue-csv-checksum";
import { parseCsv } from "@/lib/imports/csv-parser";
import { parseHvacSpecification } from "@/lib/imports/hvac-specification-parser";
import { parsePlumbingSpecification } from "@/lib/imports/plumbing-specification-parser";
import { PLUMBING_PROFILE } from "@/lib/services/plumbing-master-import-service";
import type { BulkImportProfile, ParsedSpecification } from "@/lib/services/master-catalogue-bulk-import-service";
import { buildGenericConstructionProfile } from "@/lib/services/catalogue-registry-generator";

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
  categoryHint?: string;
};

export type DatasetRegistrationSource = "MANUAL" | "DISCOVERY_VERIFIED" | "OWNER_APPROVED";
export type DatasetValidationStatus = "VALIDATED" | "VALIDATED_WITH_WARNINGS" | "NEEDS_REVIEW";

export type DatasetDefinition = {
  datasetId: string;
  datasetVersion: string;
  label: string;
  disciplineKey: string;
  /** Directory relative to the repo root — never taken from user input. */
  sourceDir: string;
  files: DatasetFileManifestEntry[];
  profile: BulkImportProfile;
  /** CATALOGUE-ACTIVATE-2 — always "CONSTRUCTION" today; every discovered dataset sits under one umbrella industry, distinguished by disciplineKey/targetPackageCode below it. */
  industryCode: string;
  /** Commercial package this dataset's published items are assigned to once imported — see industry-package-service (not built by this phase). */
  targetPackageCode: string;
  /** Label identifying which parseSpecification implementation this dataset uses — informational only; the real behavior lives in `profile`. */
  schemaProfileId: string;
  active: boolean;
  approved: boolean;
  registrationSource: DatasetRegistrationSource;
  validationStatus: DatasetValidationStatus;
  /** discipline column value -> real MasterDiscipline.key, only present when the source data's own label differs from the authoritative key (e.g. "hvac" -> "mechanical"). */
  disciplineAliases?: Record<string, string>;
  notes?: string[];
};

/**
 * CATALOGUE-ACTIVATE-2 — output of catalogue-registry-generator.ts's
 * generateDatasetDefinitions(), run against a real discovery pass and
 * pasted here as a reviewed, committed constant — the same checksum-pinned
 * safety model as the hand-written HVAC/Plumbing entries below, not a
 * live runtime dependency. Regenerate (see tests/catalogue-registry-generator.test.ts
 * for the exact invocation) and diff before ever changing this block by
 * hand. All 13 entries share the generic Code-Ref/Spec parsing profile
 * (buildGenericConstructionProfile) — see generic-code-ref-specification-parser.ts
 * for why that's safe to share across every non-HVAC, non-Plumbing dataset.
 */
const GENERATED_DATASETS: DatasetDefinition[] = [
  {
    datasetId: "quantara-master-architectural-finishes-v1",
    datasetVersion: "1",
    label: "Architectural Finishes Master Catalogue",
    disciplineKey: "interior-fit-out",
    sourceDir: "data-imports/architectural-finishes",
    files: [
      { fileName: "interior-fitout-architectural-finishes-part10of15-company-library-import.csv", approvedChecksum: "8cee56b7997873158b654bb0583c5e165954993ffbb1d7a06bcd7842ab7d9b13", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part11of15-company-library-import.csv", approvedChecksum: "814ca27451763fd0b810bc65969ca72a4a6c744246948d0aaf142f512381faeb", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part12of15-company-library-import.csv", approvedChecksum: "baf74834ae0366ccdd30463adbce4f6c4f8948dbf957a8b51eb2071b886cd375", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part13of15-company-library-import.csv", approvedChecksum: "6da39ca18a33aabcec06b16e4a289fc3f3c7e1f87b565a4452eff0d49944efc6", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part14of15-company-library-import.csv", approvedChecksum: "1d2dbdd88198d908f0784982b33aa06c7c32ad2f24daf5cd1ca78fe9c8212421", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part15of15-company-library-import.csv", approvedChecksum: "2362a4da5237769161b9146fd5b703d65b036aa3bd80c2690d0e42c59b388472", expectedRowCount: 3176 },
      { fileName: "interior-fitout-architectural-finishes-part1of15-company-library-import.csv", approvedChecksum: "b4ed459daba1ecce7721ee375da862a465c7996a96df58269c572677870d0e91", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part2of15-company-library-import.csv", approvedChecksum: "d00a3b1af483e16b00b35791da47a23ab2da046b0aa6b6b398f9bcfb14a4b80b", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part3of15-company-library-import.csv", approvedChecksum: "ee4016b2ff6462e29f0c7a6de87a1311895096718916b0945a16072e24be6d3a", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part4of15-company-library-import.csv", approvedChecksum: "4dc7f5ce10517b40954a954a790a8b64dbbc9f0f96d9eb5d126b4730283a2c76", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part5of15-company-library-import.csv", approvedChecksum: "687e17764a0fe2be0552a5b6b9c9acdb7c45c0d0962486ad5e6cfd9f3ef0bc03", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part6of15-company-library-import.csv", approvedChecksum: "e911e76b6e4fd74128fb944c6c8ef0ea7e56cb6a7d799757f53429a827d13fab", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part7of15-company-library-import.csv", approvedChecksum: "762610617713ba8c01b86adcdccc69828032e6241895c71a12e52afd9b05b1d9", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part8of15-company-library-import.csv", approvedChecksum: "4eb2ef8079465a08589cffdcc4bb0a15fee2e8ccb875d6ff00c5d94a3f28ba87", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part9of15-company-library-import.csv", approvedChecksum: "3b3e0368790515bafd840fbe4698185238f90e4f4314da73315b609698f47f52", expectedRowCount: 5500 },
    ],
    profile: buildGenericConstructionProfile("interior-fit-out", "architectural-finishes", "Architectural Finishes"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "architectural-finishes-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-bim-digital-deliverables-v1",
    datasetVersion: "1",
    label: "BIM & Digital Deliverables Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/bim-digital-deliverables",
    files: [
      { fileName: "construction-bim-and-digital-deliverables-company-library-import.csv", approvedChecksum: "4293e7a9bec5cce467319d940d2c4ad41a47545046e1ecec39cc29439b354460", expectedRowCount: 4718 },
    ],
    profile: buildGenericConstructionProfile("construction", "bim-digital-deliverables", "BIM & Digital Deliverables"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "bim-digital-deliverables-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-civil-works-v1",
    datasetVersion: "1",
    label: "Civil Works Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/civil-works",
    files: [
      { fileName: "construction-civil-works-company-library-import.csv", approvedChecksum: "a08a1d6eeeae14fbca46cceb7f9b1bfb6a85448012ec4d0d14c27addc7f4b43c", expectedRowCount: 3675 },
    ],
    profile: buildGenericConstructionProfile("construction", "civil-works", "Civil Works"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "civil-works-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-closeout-v1",
    datasetVersion: "1",
    label: "Closeout Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/closeout",
    files: [
      { fileName: "construction-closeout-part1of2-company-library-import.csv", approvedChecksum: "6d227b991a0c10cad3e806c40df32ee58ebcd944b5205839c99294e5bffdb53e", expectedRowCount: 4775 },
      { fileName: "construction-closeout-part2of2-company-library-import.csv", approvedChecksum: "9ac13a16e7397425b033223e5f6344ba1763ec1f23ea7d7249477962b4a8a6d4", expectedRowCount: 4677 },
    ],
    profile: buildGenericConstructionProfile("construction", "closeout", "Closeout"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "closeout-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-doors-and-windows-v1",
    datasetVersion: "1",
    label: "Doors and Windows Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/doors-and-windows",
    files: [
      { fileName: "construction-doors-and-windows-part1of3-company-library-import.csv", approvedChecksum: "ab2ee276c6c10d34eea0d86bd5592cf877e099cd0f9d2641c384389b0942e943", expectedRowCount: 4288 },
      { fileName: "construction-doors-and-windows-part2of3-company-library-import.csv", approvedChecksum: "8af2f60390b006b73b9fb7fb40822952a4d9814b95a50482349a62d4a05a0237", expectedRowCount: 4288 },
      { fileName: "construction-doors-and-windows-part3of3-company-library-import.csv", approvedChecksum: "f8e7affa67f16741f928d2cd5f9ad7bc771612a01fb2c212cf8a2f046bb5ad17", expectedRowCount: 2991 },
    ],
    profile: buildGenericConstructionProfile("construction", "doors-and-windows", "Doors and Windows"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "doors-and-windows-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-facade-v1",
    datasetVersion: "1",
    label: "Facade Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/facade",
    files: [
      { fileName: "construction-facade-part1of5-company-library-import.csv", approvedChecksum: "fec1cbbf88a65d68258a025e2a6bb9d32c543314022f93bddb7536b99bb3b3e2", expectedRowCount: 3721 },
      { fileName: "construction-facade-part2of5-company-library-import.csv", approvedChecksum: "9d045d78834b50d20fb34ea3fb450afa98f841fb04f335aa085a8f7261d1db0a", expectedRowCount: 3721 },
      { fileName: "construction-facade-part3of5-company-library-import.csv", approvedChecksum: "2fe340c83711dfafa3c329b4357d765ef39ae055d91063e60af7dce95e75edf7", expectedRowCount: 3721 },
      { fileName: "construction-facade-part4of5-company-library-import.csv", approvedChecksum: "ea294af609698c649f1234b0f7bb2f5766f53dc5af34822bda5fa1b8e1ffe68d", expectedRowCount: 3721 },
      { fileName: "construction-facade-part5of5-company-library-import.csv", approvedChecksum: "d8fd6bb7e5dea34f72f46cd99858a37af9abbe1960ff51ec57b8b1d87c8ebd32", expectedRowCount: 902 },
    ],
    profile: buildGenericConstructionProfile("construction", "facade", "Facade"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "facade-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-general-requirements-v1",
    datasetVersion: "1",
    label: "General Requirements Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/general-requirements",
    files: [
      { fileName: "construction-general-requirements-preliminaries-company-library-import.csv", approvedChecksum: "3a403f86345161da0322a2e97385901e5cb4a2b7c5f4b001126522e5cf88fa47", expectedRowCount: 4065 },
    ],
    profile: buildGenericConstructionProfile("construction", "general-requirements", "General Requirements"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "general-requirements-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-landscaping-v1",
    datasetVersion: "1",
    label: "Landscaping Master Catalogue",
    disciplineKey: "landscaping",
    sourceDir: "data-imports/landscaping",
    files: [
      { fileName: "landscaping-company-library-import.csv", approvedChecksum: "71cb9021e32656163a16140fe94b36286da016eecd5cb10299c176ff091bf23f", expectedRowCount: 2867 },
    ],
    profile: buildGenericConstructionProfile("landscaping", "landscaping", "Landscaping"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "landscaping-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-roofing-v1",
    datasetVersion: "1",
    label: "Roofing Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/roofing",
    files: [
      { fileName: "construction-roofing-company-library-import.csv", approvedChecksum: "53fc8095ec77c3c256ea818226525c5a8c80a443f2c64343bc466e7b57051795", expectedRowCount: 4162 },
    ],
    profile: buildGenericConstructionProfile("construction", "roofing", "Roofing"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "roofing-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-site-infrastructure-v1",
    datasetVersion: "1",
    label: "Site Infrastructure Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/site-infrastructure",
    files: [
      { fileName: "construction-site-infrastructure-company-library-import.csv", approvedChecksum: "87538363fa80713bfcad7ca1b2715ed1c0d2aa62a3ee4d7643afcf908f7baf40", expectedRowCount: 4345 },
    ],
    profile: buildGenericConstructionProfile("construction", "site-infrastructure", "Site Infrastructure"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "site-infrastructure-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-structural-v1",
    datasetVersion: "1",
    label: "Structural Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/structural",
    files: [
      { fileName: "construction-structural-works-part1of2-company-library-import.csv", approvedChecksum: "29a877acb8b8803ddd91623be9346af2698a6621721991de4e0565f26825a04c", expectedRowCount: 5500 },
      { fileName: "construction-structural-works-part2of2-company-library-import.csv", approvedChecksum: "9265ebe2a507a65881cef233d26fd73008d2d69c6087754301e3c9992a50637c", expectedRowCount: 3547 },
    ],
    profile: buildGenericConstructionProfile("construction", "structural", "Structural"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "structural-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-temporary-works-v1",
    datasetVersion: "1",
    label: "Temporary Works Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/temporary-works",
    files: [
      { fileName: "construction-temporary-works-part1of2-company-library-import.csv", approvedChecksum: "12104e7d3098a6be41404dafb4247e8d8aba88510d3446aba193a75806e06d43", expectedRowCount: 4907 },
      { fileName: "construction-temporary-works-part2of2-company-library-import.csv", approvedChecksum: "75a0c13dc8bfe51ca1318792902e5a4e06799df8dc21c751b9adcd2b2893e56c", expectedRowCount: 3047 },
    ],
    profile: buildGenericConstructionProfile("construction", "temporary-works", "Temporary Works"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "temporary-works-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
  {
    datasetId: "quantara-master-uae-authority-regulatory-v1",
    datasetVersion: "1",
    label: "UAE Authority & Regulatory Master Catalogue",
    disciplineKey: "construction",
    sourceDir: "data-imports/uae-authority-regulatory",
    files: [
      { fileName: "construction-uae-authority-and-regulatory-part1of3-company-library-import.csv", approvedChecksum: "29b89053f30e727f3423ff377a0fd1af9ff5ff0c8851373db98dd057ba8c38ce", expectedRowCount: 3997 },
      { fileName: "construction-uae-authority-and-regulatory-part2of3-company-library-import.csv", approvedChecksum: "7e73ee3e00bbbb71e2745cf53662aba3ab7747cc06e41e849523776f9c57795e", expectedRowCount: 3997 },
      { fileName: "construction-uae-authority-and-regulatory-part3of3-company-library-import.csv", approvedChecksum: "c37ace9b711a8493e242e116f5adfa4f2e36aba6cb6d034f3b0eaae8b5a59063", expectedRowCount: 3687 },
    ],
    profile: buildGenericConstructionProfile("construction", "uae-authority-regulatory", "UAE Authority & Regulatory"),
    industryCode: "CONSTRUCTION",
    targetPackageCode: "uae-authority-regulatory-library",
    schemaProfileId: "company-library-catalogue-v1",
    active: true,
    approved: true,
    registrationSource: "DISCOVERY_VERIFIED",
    validationStatus: "VALIDATED",
  },
];

const DATASETS: DatasetDefinition[] = [
  {
    datasetId: "quantara-master-hvac-v1",
    datasetVersion: "1",
    label: "HVAC Master Catalogue",
    disciplineKey: "mechanical",
    sourceDir: "data-imports/hvac",
    files: [
      { fileName: "hvac-company-library-import.csv", approvedChecksum: "fbb9d85cd46b5eaf19142464e79fa0611ecf564cafdb0c2fe0dd5da8d11baf64", expectedRowCount: 707 },
      { fileName: "hvac-air-distribution-company-library-import.csv", approvedChecksum: "3e2ec5f1e7693ff5e91e25cf3c417df8e6cd1a696bc9e86d927e6b7f64461433", expectedRowCount: 184 },
    ],
    profile: HVAC_PROFILE,
    industryCode: "CONSTRUCTION",
    targetPackageCode: "hvac-library",
    schemaProfileId: "hvac-specification-v1",
    active: true,
    approved: true,
    registrationSource: "MANUAL",
    validationStatus: "VALIDATED",
    // The CSV's own `discipline` column says "hvac"; the real MasterDiscipline key is
    // "mechanical" — see CATALOGUE-ACTIVATE-2's discovery report. Recorded here so an
    // automated re-classification pass never needs to rediscover this by hand.
    disciplineAliases: { hvac: "mechanical" },
  },
  {
    datasetId: "quantara-master-plumbing-v1",
    datasetVersion: "1",
    label: "Plumbing Master Catalogue",
    disciplineKey: "plumbing",
    sourceDir: "data-imports/plumbing",
    files: [
      { fileName: "plumbing-common-plumbing-work-results-company-library-import.csv", approvedChecksum: "04ebac7beef67f47a6ce8863d7fbe61aa5f840a4c5efbf90d3821d8a6797301a", expectedRowCount: 61 },
      { fileName: "plumbing-drainage-specialties-company-library-import.csv", approvedChecksum: "84f79387f3ed98514c3c42d872b2ce9d2330ed5bbfdcf51392c26915a9e92be2", expectedRowCount: 124 },
      { fileName: "plumbing-fixture-fittings-and-accessories-company-library-import.csv", approvedChecksum: "390941d4a78791486e570213e7423537fbd40ca9de05042d165d2d0e93ee99f7", expectedRowCount: 132 },
      { fileName: "plumbing-instrumentation-and-controls-company-library-import.csv", approvedChecksum: "49592fbb722fe450e0ce7175ca2480ad594ebb73f2e9eecb77dda332ccee49f3", expectedRowCount: 145 },
      { fileName: "plumbing-medical-and-laboratory-systems-company-library-import.csv", approvedChecksum: "e9d1fb538e665ae899ba2c832c08e0ab32274c952f3726b688a684c6874a1d05", expectedRowCount: 51 },
      { fileName: "plumbing-piping-systems-part1-company-library-import.csv", approvedChecksum: "3b6f459ce8f2d6622fd67bdbf925c576fc9f23b1eb07820afb504eea633ddc8f", expectedRowCount: 3000 },
      { fileName: "plumbing-piping-systems-part2-company-library-import.csv", approvedChecksum: "3b2acd8fd446584087b7f8043d24cfd613a7b7725ebbd82fe7493c1d09d468f1", expectedRowCount: 3000 },
      { fileName: "plumbing-piping-systems-part3-company-library-import.csv", approvedChecksum: "48e3b7b64af97484573c7fa46e6e5d0db08d3e9bc523cc39b83ad1c03e8cbc8f", expectedRowCount: 3000 },
      { fileName: "plumbing-piping-systems-part4-company-library-import.csv", approvedChecksum: "61829ffe69793666ad7941f1182a61458712eee7ac4e666d1260e7b53b7dd7a0", expectedRowCount: 1198 },
      { fileName: "plumbing-plumbing-equipment-company-library-import.csv", approvedChecksum: "e674a9b073fee5cde49d46d645b0b88d23d3447b8c9ecc9a2ecf6530c18501ea", expectedRowCount: 280 },
      { fileName: "plumbing-plumbing-fixtures-company-library-import.csv", approvedChecksum: "de552631a3aec56fb57be42d6b233615c81db68d848c58fb18864078c2588838", expectedRowCount: 320 },
      { fileName: "plumbing-pool-and-fountain-plumbing-company-library-import.csv", approvedChecksum: "d3d237293325a47a148c24c33b2173f998def068faab48438e266b58c1321cc8", expectedRowCount: 84 },
      { fileName: "plumbing-valves-and-piping-specialties-company-library-import.csv", approvedChecksum: "ab602f12a3e6a4cf02b93b2feb2cc8911cc0bad947a2a50262083e8b3012b5c2", expectedRowCount: 1716 },
    ],
    profile: PLUMBING_PROFILE,
    industryCode: "CONSTRUCTION",
    targetPackageCode: "plumbing-library",
    schemaProfileId: "plumbing-specification-v1",
    active: true,
    approved: true,
    registrationSource: "MANUAL",
    validationStatus: "VALIDATED",
  },
  ...GENERATED_DATASETS,
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
    const actualChecksum = computeCatalogueCsvChecksum(buffer);
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

/**
 * CATALOGUE-ACTIVATE-2 — a stricter identity than computeDatasetSourceChecksum
 * above (which only covers file checksums): also folds in the dataset ID,
 * version, discipline mapping and package mapping, so a mapping change
 * changes the fingerprint even when no file byte changes. File order is
 * normalized (sorted by fileName) so filesystem discovery order never
 * affects the result.
 */
export function computeDatasetFingerprint(dataset: DatasetDefinition): string {
  const sortedFiles = [...dataset.files].sort((a, b) => a.fileName.localeCompare(b.fileName));
  const parts = [
    dataset.datasetId,
    dataset.datasetVersion,
    dataset.disciplineKey,
    dataset.targetPackageCode,
    dataset.schemaProfileId,
    ...sortedFiles.map((f) => `${f.fileName}:${f.approvedChecksum}:${f.expectedRowCount}`),
  ];
  return computeChecksum(Buffer.from(parts.join("|"), "utf-8"));
}

export type FileOwnershipViolation = { fileName: string; datasetIds: string[] };

/** Every active CSV must belong to exactly one active dataset — a file referenced by more than one active dataset is a registry authoring error, not a runtime possibility to silently tolerate. */
export function validateFileOwnership(datasets: DatasetDefinition[]): FileOwnershipViolation[] {
  const owners = new Map<string, Set<string>>();
  for (const dataset of datasets) {
    if (!dataset.active) continue;
    for (const file of dataset.files) {
      const key = `${dataset.sourceDir}/${file.fileName}`;
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key)!.add(dataset.datasetId);
    }
  }
  const violations: FileOwnershipViolation[] = [];
  for (const [fileName, datasetIds] of owners) {
    if (datasetIds.size > 1) violations.push({ fileName, datasetIds: Array.from(datasetIds) });
  }
  return violations;
}

export type DatasetReadinessStatus = "READY" | "READY_WITH_WARNINGS" | "BLOCKED";
export type DatasetReadiness = {
  datasetId: string;
  status: DatasetReadinessStatus;
  blockReasons: string[];
  warnings: string[];
};

function checkDatasetMetadataReadiness(dataset: DatasetDefinition, knownDisciplineKeys: Set<string>): { blockReasons: string[]; warnings: string[] } {
  const blockReasons: string[] = [];
  const warnings: string[] = [...(dataset.notes ?? [])];

  if (!dataset.approved) blockReasons.push("DATASET_NOT_APPROVED");
  if (!dataset.active) blockReasons.push("DATASET_NOT_ACTIVE");

  const effectiveDisciplineKey = dataset.disciplineAliases?.[dataset.disciplineKey] ?? dataset.disciplineKey;
  if (!knownDisciplineKeys.has(effectiveDisciplineKey)) {
    blockReasons.push(`DISCIPLINE_MISSING:${effectiveDisciplineKey}`);
  }

  if (!dataset.targetPackageCode) blockReasons.push("PACKAGE_MAPPING_MISSING");
  if (!dataset.schemaProfileId) blockReasons.push("SCHEMA_PROFILE_MISSING");

  if (dataset.validationStatus === "NEEDS_REVIEW") blockReasons.push("NEEDS_OWNER_REVIEW");
  else if (dataset.validationStatus === "VALIDATED_WITH_WARNINGS") warnings.push("VALIDATED_WITH_WARNINGS");

  return { blockReasons, warnings };
}

/**
 * Fast readiness check — registry metadata and a live MasterDiscipline
 * lookup only, no file I/O. This is what powers the admin dataset-list
 * endpoint, which must stay cheap regardless of how many datasets or how
 * large their source files are — see checkDatasetReadiness below for the
 * full, file-verifying version.
 */
export function checkDatasetReadinessFast(dataset: DatasetDefinition, knownDisciplineKeys: Set<string>): DatasetReadiness {
  const { blockReasons, warnings } = checkDatasetMetadataReadiness(dataset, knownDisciplineKeys);
  const status: DatasetReadinessStatus = blockReasons.length > 0 ? "BLOCKED" : warnings.length > 0 ? "READY_WITH_WARNINGS" : "READY";
  return { datasetId: dataset.datasetId, status, blockReasons, warnings };
}

/**
 * Full read-only readiness check — everything checkDatasetReadinessFast
 * checks, plus re-reading every file off disk to verify it still exists,
 * still matches its approved checksum, and still has the expected row
 * count. This is real I/O across every file in the dataset (up to several
 * MB each) — call it per-dataset, on demand, never automatically for every
 * dataset in a listing response. Never creates an import job/batch row —
 * that only happens in the next phase's real dry-run.
 */
export function checkDatasetReadiness(dataset: DatasetDefinition, knownDisciplineKeys: Set<string>): DatasetReadiness {
  const { blockReasons, warnings } = checkDatasetMetadataReadiness(dataset, knownDisciplineKeys);

  for (const manifestEntry of dataset.files) {
    const fullPath = join(process.cwd(), dataset.sourceDir, manifestEntry.fileName);
    let buffer: Buffer;
    try {
      buffer = readFileSync(fullPath);
    } catch {
      blockReasons.push(`FILE_MISSING:${manifestEntry.fileName}`);
      continue;
    }
    const actualChecksum = computeCatalogueCsvChecksum(buffer);
    if (actualChecksum !== manifestEntry.approvedChecksum) {
      blockReasons.push(`CHECKSUM_MISMATCH:${manifestEntry.fileName}`);
      continue; // a changed file makes a row-count comparison meaningless — already blocked above
    }
    // Files here are all small enough (<4MB) that a full in-memory parse for a row-count
    // check is reasonable for this on-demand, per-dataset action — the real per-row
    // streaming pass happens at actual dry-run/execute time, not here.
    const rows = parseCsv(buffer.toString("utf-8"));
    const actualRowCount = Math.max(0, rows.length - 1); // minus header
    if (actualRowCount !== manifestEntry.expectedRowCount) {
      blockReasons.push(`ROW_COUNT_MISMATCH:${manifestEntry.fileName}`);
    }
  }

  if (dataset.validationStatus === "NEEDS_REVIEW") blockReasons.push("NEEDS_OWNER_REVIEW");
  else if (dataset.validationStatus === "VALIDATED_WITH_WARNINGS") warnings.push("VALIDATED_WITH_WARNINGS");

  const status: DatasetReadinessStatus = blockReasons.length > 0 ? "BLOCKED" : warnings.length > 0 ? "READY_WITH_WARNINGS" : "READY";
  return { datasetId: dataset.datasetId, status, blockReasons, warnings };
}
