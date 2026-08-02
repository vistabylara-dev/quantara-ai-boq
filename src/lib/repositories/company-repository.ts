import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

type DbClient = typeof prisma | Prisma.TransactionClient;

export type CompanyUpdateData = {
  legalName?: string;
  tradeName?: string;
  email?: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  taxRegistrationNumber?: string | null;
  defaultCurrency?: string;
  vatRate?: string | number | import("@prisma/client").Prisma.Decimal;
  defaultLanguage?: string;
};

export type CreateCompanyInput = {
  legalName: string;
  tradeName: string;
  email: string;
};

export function createCompany(data: CreateCompanyInput, db: DbClient = prisma) {
  return db.company.create({
    data: {
      legalName: data.legalName,
      tradeName: data.tradeName,
      email: data.email,
    },
  });
}

export async function getCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new NotFoundError("The development company workspace was not found.");
  }
  return company;
}

export async function updateCompany(companyId: string, data: CompanyUpdateData) {
  await getCompany(companyId);
  return prisma.company.update({ where: { id: companyId }, data });
}
