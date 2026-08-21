import type { CompanyBranding } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

function toBrandingDTO(row: CompanyBranding) {
  return {
    id: row.id,
    companyId: row.companyId,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    documentHeaderColor: row.documentHeaderColor,
    tableHeaderColor: row.tableHeaderColor,
    coverStyle: row.coverStyle,
    logoPosition: row.logoPosition,
    preferredTemplateId: row.preferredTemplateId,
    emailSignatureHtml: row.emailSignatureHtml,
    footerText: row.footerText,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type BrandingDTO = ReturnType<typeof toBrandingDTO>;

const DEFAULT_BRANDING = {
  primaryColor: "#0F172A",
  secondaryColor: "#1E293B",
  accentColor: "#2563EB",
  documentHeaderColor: "#0F172A",
  tableHeaderColor: "#1E293B",
  coverStyle: "light",
  logoPosition: "top-left",
  emailSignatureHtml: "",
  footerText: "",
};

export async function getBranding(companyId: string): Promise<BrandingDTO> {
  const existing = await prisma.companyBranding.findUnique({ where: { companyId } });
  if (existing) return toBrandingDTO(existing);
  const created = await prisma.companyBranding.create({ data: { companyId, ...DEFAULT_BRANDING } });
  return toBrandingDTO(created);
}

export type BrandingUpdateInput = Partial<{
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  documentHeaderColor: string;
  tableHeaderColor: string;
  coverStyle: string;
  logoPosition: string;
  preferredTemplateId: string | null;
  emailSignatureHtml: string;
  footerText: string;
}>;

export async function upsertBranding(companyId: string, input: BrandingUpdateInput): Promise<BrandingDTO> {
  const row = await prisma.companyBranding.upsert({
    where: { companyId },
    update: input,
    create: { companyId, ...DEFAULT_BRANDING, ...input },
  });
  return toBrandingDTO(row);
}
