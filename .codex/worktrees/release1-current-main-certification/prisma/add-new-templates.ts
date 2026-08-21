/**
 * One-off, fast alternative to the full `prisma db seed` run — inserts just
 * the two new document templates (Minimal Client Summary, Internal Cost
 * Review) for the existing dev company, without re-running the entire seed
 * (industries, projects, BOQs, catalogue, etc.), which is slow over a remote
 * database connection. Safe to re-run — upserts by the same
 * (companyId, code) uniqueness the app already enforces.
 */
import { DocumentTemplateType, PrismaClient } from "@prisma/client";
import { getDevelopmentCompanyId } from "../src/lib/tenancy/development-company";
import { DEFAULT_CONTENT_CONFIG, DEFAULT_STYLE_CONFIG } from "../src/lib/documents/template-config";

const prisma = new PrismaClient();

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function main(): Promise<void> {
  const companyId = getDevelopmentCompanyId();

  const templates = [
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

  for (const t of templates) {
    await prisma.documentTemplate.upsert({
      where: { companyId_code: { companyId, code: t.code } },
      update: {
        name: t.name,
        description: t.description,
        styleConfigJson: json({ ...DEFAULT_STYLE_CONFIG, ...t.style }),
        contentConfigJson: json({ ...DEFAULT_CONTENT_CONFIG, ...t.content }),
      },
      create: {
        companyId,
        industryEngineId: null,
        name: t.name,
        code: t.code,
        type: t.type,
        description: t.description,
        styleConfigJson: json({ ...DEFAULT_STYLE_CONFIG, ...t.style }),
        contentConfigJson: json({ ...DEFAULT_CONTENT_CONFIG, ...t.content }),
      },
    });
    console.log(`Upserted template: ${t.name} (${t.code})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Done.");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
