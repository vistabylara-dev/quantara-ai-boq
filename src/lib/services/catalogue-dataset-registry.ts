import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MasterClassificationSystem } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { computeChecksum } from "@/lib/files/file-security";
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
      { fileName: "interior-fitout-architectural-finishes-part10of15-company-library-import.csv", approvedChecksum: "dfba0963028aed6ef2b4ee304b7ab66efdf90d6e25c521486c4e4bdfb4ece68f", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part11of15-company-library-import.csv", approvedChecksum: "95f093262ebd8b37a7def4304574d9f15e31f6fc9895e62f6de321335f816687", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part12of15-company-library-import.csv", approvedChecksum: "3752a593e43a975afdf9f2876efe208f59094e44c3eb505fac047eb634869c56", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part13of15-company-library-import.csv", approvedChecksum: "03a67bdf7e2a3d43b96544c736b5daf70c1ed6b9ad9e7c9aa11e50c3b39b1239", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part14of15-company-library-import.csv", approvedChecksum: "a2e2ca7f2d1e2a603135badca615e3796654aee7f2fa1b7eeae36a4c93802790", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part15of15-company-library-import.csv", approvedChecksum: "a1e3c4c66ceea0b448e10d0b8270980e9e794040a6571148d6819b800d9cd6b8", expectedRowCount: 3176 },
      { fileName: "interior-fitout-architectural-finishes-part1of15-company-library-import.csv", approvedChecksum: "dbbb0714d2a0b257eb3493cd635327f1f71f95e9f18b53e11d4f6f14b9e62a6a", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part2of15-company-library-import.csv", approvedChecksum: "5e38d3f8b9975730ae586db08f1a372f52f79aa6e77c606c2e4f86850bf1d952", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part3of15-company-library-import.csv", approvedChecksum: "7650032ecd1c0375a36694683c701c46dba287882bbbca35e826cd9a1a1f6ab0", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part4of15-company-library-import.csv", approvedChecksum: "c7380a97d4a2fe4da946ba9ee9c3f8a6640ba3932e7d6faae855b6c24071d79f", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part5of15-company-library-import.csv", approvedChecksum: "81dd97bbfdb5b28782439b94c65783c004e6ff2f9cdb80eebe3e9447437c563c", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part6of15-company-library-import.csv", approvedChecksum: "e494149c7fb1505d4db01ebbfe7d0d176a86f77dd050b835bd9e8527474548d1", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part7of15-company-library-import.csv", approvedChecksum: "478c7b460aeb81f118f3a0ba25563b84dec49a3a20b3d895e7940edc93696e58", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part8of15-company-library-import.csv", approvedChecksum: "e1c2642a5c00b5474fd5663a0f36ff3e6d1463a20e63f1c538fb3b8095b9480a", expectedRowCount: 5500 },
      { fileName: "interior-fitout-architectural-finishes-part9of15-company-library-import.csv", approvedChecksum: "5778f0755c954b2335a86f325766e6777a84b55d810e66cda2c675829b81f781", expectedRowCount: 5500 },
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
      { fileName: "construction-bim-and-digital-deliverables-company-library-import.csv", approvedChecksum: "d2b3a4e2e3af8ccb4c0fa4693d8bdb141b9264c1d1be548191e7626aa94cb0af", expectedRowCount: 4718 },
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
      { fileName: "construction-civil-works-company-library-import.csv", approvedChecksum: "a0a723eb2a2217f354ac55752707eb2ef68ace05108e735a7cfabb814bb61d0d", expectedRowCount: 3675 },
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
      { fileName: "construction-closeout-part1of2-company-library-import.csv", approvedChecksum: "4cad5c93e3cc48faca7bea5b43720c8d5ab79b5c9abc78d8cf951c1ad2dda77a", expectedRowCount: 4775 },
      { fileName: "construction-closeout-part2of2-company-library-import.csv", approvedChecksum: "e0cc39fc8d7fc5a79a58029f4c2ef24688e2a847c9f09ecd786d4bc147ed417f", expectedRowCount: 4677 },
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
      { fileName: "construction-doors-and-windows-part1of3-company-library-import.csv", approvedChecksum: "eac3d77330b81833283c5074f4bb2a00d61dfa1dc5eb7276e3068fb867b9e8ba", expectedRowCount: 4288 },
      { fileName: "construction-doors-and-windows-part2of3-company-library-import.csv", approvedChecksum: "5d5d3cc75b5dd24a8fa5f8f214cbc4bc7aa0816095a5b8f1e65ccfa12507817a", expectedRowCount: 4288 },
      { fileName: "construction-doors-and-windows-part3of3-company-library-import.csv", approvedChecksum: "d614551a945fb483873df85956d453418462f83de8835f47ccc3b513efa6471d", expectedRowCount: 2991 },
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
      { fileName: "construction-facade-part1of5-company-library-import.csv", approvedChecksum: "73d3586c7eae3667a8bfe289cc9549fe058f2ebb529d07ce25248a063267e791", expectedRowCount: 3721 },
      { fileName: "construction-facade-part2of5-company-library-import.csv", approvedChecksum: "6c433787d661944668523ba3d52923bbf3149088d376252754fa2ec072dcad3b", expectedRowCount: 3721 },
      { fileName: "construction-facade-part3of5-company-library-import.csv", approvedChecksum: "b815e15951f724a99e0cf00dd654a3a3094adf5796e21d97d43c9cbe1ceefafd", expectedRowCount: 3721 },
      { fileName: "construction-facade-part4of5-company-library-import.csv", approvedChecksum: "4fb592b8ee38cdd7b0f8605d4aa91a0d3670997918dddea99056a5ae94702ed3", expectedRowCount: 3721 },
      { fileName: "construction-facade-part5of5-company-library-import.csv", approvedChecksum: "1147ccdabea5d49c81a50ac64d82d26a6591cd4c50ee9511c7cae10d533e1138", expectedRowCount: 902 },
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
      { fileName: "construction-general-requirements-preliminaries-company-library-import.csv", approvedChecksum: "57a715f437046c925cf403964f24f560a07775092f2182cb0a40266f57f173d4", expectedRowCount: 4065 },
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
      { fileName: "landscaping-company-library-import.csv", approvedChecksum: "1833a636c4575cbb1f027439c096afab8ade2dad5200e5bf84293401894113a7", expectedRowCount: 2867 },
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
      { fileName: "construction-roofing-company-library-import.csv", approvedChecksum: "7aa16165b29580bc14ee538b0f80856cecd049fe9d19489d76a196e20664b8fa", expectedRowCount: 4162 },
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
      { fileName: "construction-site-infrastructure-company-library-import.csv", approvedChecksum: "7a6d6c98e9dfd82e8129540d5df2c76f655ceec73b0575dcba6dd15eb5c8f8f9", expectedRowCount: 4345 },
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
      { fileName: "construction-structural-works-part1of2-company-library-import.csv", approvedChecksum: "e7d1bd972956bf5986cb1329be45df6d6838c3a0d94eba33817e087a0f0ba3bc", expectedRowCount: 5500 },
      { fileName: "construction-structural-works-part2of2-company-library-import.csv", approvedChecksum: "42c6c7a531ecd184c59736d8e493ccc0e6af11f45b6986a4ff8f9af4e944c477", expectedRowCount: 3547 },
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
      { fileName: "construction-temporary-works-part1of2-company-library-import.csv", approvedChecksum: "8498d1b31604dcf7e7b804aebb5081ec49fa0db47433e1d88aaf1c9116d0cd35", expectedRowCount: 4907 },
      { fileName: "construction-temporary-works-part2of2-company-library-import.csv", approvedChecksum: "3e5e238964925351fa24e4919173fb9ff98d5e233c22581cfdae5172b89096d2", expectedRowCount: 3047 },
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
      { fileName: "construction-uae-authority-and-regulatory-part1of3-company-library-import.csv", approvedChecksum: "8bb997af18f6c096f3be87facddcb2251c4b097d28f254a3cc62cc26878cc4b3", expectedRowCount: 3997 },
      { fileName: "construction-uae-authority-and-regulatory-part2of3-company-library-import.csv", approvedChecksum: "bb4a73e1c94314135bbc5ea6fa9554e1b6758c3673781eaca6f13cf799d7cd96", expectedRowCount: 3997 },
      { fileName: "construction-uae-authority-and-regulatory-part3of3-company-library-import.csv", approvedChecksum: "4104362cc937902c225700b0e1662e1caeb10352ba9bdaba6f01a7956369e13a", expectedRowCount: 3687 },
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
      { fileName: "hvac-company-library-import.csv", approvedChecksum: "3f53af3f2617227bdf1634b3b41c022ece1253e7d015a4259edca80caf58007a", expectedRowCount: 707 },
      { fileName: "hvac-air-distribution-company-library-import.csv", approvedChecksum: "5637cd11dc85f13de2d5ff5e4eb4dcd7944402773333497bc02c73f9260900b5", expectedRowCount: 184 },
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
    const actualChecksum = computeChecksum(buffer);
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
