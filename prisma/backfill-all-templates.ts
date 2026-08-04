/**
 * One-off backfill: ensures all 7 standard document templates exist for
 * EVERY company in the database, not just the seeded dev company. Safe to
 * re-run — upserts by the same (companyId, code) uniqueness the app already
 * enforces, so it never duplicates and never touches a company's existing
 * customized templates beyond updating these 7 known codes.
 */
import { DocumentTemplateType, PrismaClient } from "@prisma/client";
import { DEFAULT_CONTENT_CONFIG, DEFAULT_STYLE_CONFIG } from "../src/lib/documents/template-config";

const prisma = new PrismaClient();

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

const templates = [
  {
    name: "Corporate Technical",
    code: "corporate-technical",
    type: DocumentTemplateType.CORPORATE_TECHNICAL,
    description: "Clean, formal BOQ document for construction, consultancy, and general technical submissions.",
    style: { direction: "ltr" as const, coverStyle: "light" as const, primaryColor: "#0B1D3A", accentColor: "#2563EB", fontFamily: "sans" as const },
    content: {},
  },
  {
    name: "Executive Premium",
    code: "executive-premium",
    type: DocumentTemplateType.EXECUTIVE_PREMIUM,
    description: "Premium proposal layout for luxury fit-out and executive client submissions.",
    style: { direction: "ltr" as const, coverStyle: "dark" as const, primaryColor: "#111827", accentColor: "#D4AF37", fontFamily: "sans" as const },
    content: { showExclusionsSection: false, columns: { ...DEFAULT_CONTENT_CONFIG.columns, notes: false } },
  },
  {
    name: "Furniture Catalogue",
    code: "furniture-catalogue",
    type: DocumentTemplateType.FURNITURE_CATALOGUE,
    description: "Catalogue-style layout for furniture packages: item, specification, quantity, and rate per piece.",
    style: { direction: "ltr" as const, coverStyle: "light" as const, primaryColor: "#1F2937", accentColor: "#B45309", fontFamily: "sans" as const },
    content: { columns: { ...DEFAULT_CONTENT_CONFIG.columns, brandModel: true } },
  },
  {
    name: "MEP Tender",
    code: "mep-tender",
    type: DocumentTemplateType.MEP_TENDER,
    description: "Dense technical tender format for MEP submissions, grouped by discipline and system.",
    style: { direction: "ltr" as const, coverStyle: "light" as const, primaryColor: "#0F172A", accentColor: "#0EA5E9", fontFamily: "sans" as const },
    content: { denseTechnicalTable: true },
  },
  {
    name: "Arabic Formal",
    code: "arabic-formal",
    type: DocumentTemplateType.ARABIC_FORMAL,
    description: "Right-to-left Arabic BOQ document with mirrored layout and Arabic-capable typography.",
    style: { direction: "rtl" as const, coverStyle: "dark" as const, primaryColor: "#0B1D3A", accentColor: "#2563EB", fontFamily: "arabic-naskh" as const },
    content: {},
  },
  {
    name: "Minimal Client Summary",
    code: "minimal-client-summary",
    type: DocumentTemplateType.CORPORATE_TECHNICAL,
    description: "No cover page, fewer columns — a fast, clean quote for a client reading on their phone.",
    style: { direction: "ltr" as const, coverStyle: "none" as const, primaryColor: "#0B1D3A", accentColor: "#2563EB", fontFamily: "sans" as const },
    content: {
      showCoverPage: false,
      showExclusionsSection: false,
      columns: { ...DEFAULT_CONTENT_CONFIG.columns, drawingReference: false, notes: false },
    },
  },
  {
    name: "Internal Cost Review",
    code: "internal-cost-review",
    type: DocumentTemplateType.CORPORATE_TECHNICAL,
    description: "Dense table with full cost and margin breakdown — for internal review only, never send to a client.",
    style: { direction: "ltr" as const, coverStyle: "light" as const, primaryColor: "#0F172A", accentColor: "#0EA5E9", fontFamily: "sans" as const },
    content: {
      denseTechnicalTable: true,
      showInternalCostFieldsToClient: true,
      columns: { ...DEFAULT_CONTENT_CONFIG.columns, brandModel: true },
    },
  },
];

async function main(): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true, legalName: true } });
  console.log(`Found ${companies.length} company/companies.`);

  for (const company of companies) {
    console.log(`\nCompany: ${company.legalName} (${company.id})`);
    for (const t of templates) {
      await prisma.documentTemplate.upsert({
        where: { companyId_code: { companyId: company.id, code: t.code } },
        update: {},
        create: {
          companyId: company.id,
          industryEngineId: null,
          name: t.name,
          code: t.code,
          type: t.type,
          description: t.description,
          styleConfigJson: json({ ...DEFAULT_STYLE_CONFIG, ...t.style }),
          contentConfigJson: json({ ...DEFAULT_CONTENT_CONFIG, ...t.content }),
        },
      });
      console.log(`  Upserted: ${t.name}`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\nDone.");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
