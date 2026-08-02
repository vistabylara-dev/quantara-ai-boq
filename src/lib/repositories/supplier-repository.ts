import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export type SupplierWriteInput = {
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  taxRegistrationNumber?: string | null;
  defaultCurrency?: string;
  paymentTerms?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
};

export type SupplierListFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
};

export async function listSuppliers(companyId: string, filters: SupplierListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where: Prisma.SupplierWhereInput = {
    companyId,
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { legalName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { contactPerson: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getSupplier(companyId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) throw new NotFoundError("Supplier not found.");
  return supplier;
}

export async function findSupplierByName(companyId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return prisma.supplier.findFirst({ where: { companyId, name: { equals: trimmed, mode: "insensitive" } } });
}

export async function countSupplierCatalogueItems(companyId: string, supplierId: string): Promise<number> {
  return prisma.rateCatalogueItem.count({ where: { companyId, supplierId } });
}

export async function createSupplier(companyId: string, input: SupplierWriteInput) {
  const duplicate = await findSupplierByName(companyId, input.name);
  if (duplicate) {
    throw new ConflictError("SUPPLIER_ALREADY_EXISTS", "A supplier with this name already exists.");
  }

  const supplier = await prisma.supplier.create({ data: { companyId, ...input } });
  await createAuditLog(companyId, {
    entityType: "Supplier",
    entityId: supplier.id,
    action: "SUPPLIER_CREATED",
    payload: { name: supplier.name },
  });
  return supplier;
}

export async function updateSupplier(companyId: string, supplierId: string, input: Partial<SupplierWriteInput>) {
  await getSupplier(companyId, supplierId);
  const supplier = await prisma.supplier.update({
    where: { id: supplierId, companyId },
    data: input,
  });
  await createAuditLog(companyId, {
    entityType: "Supplier",
    entityId: supplier.id,
    action: "SUPPLIER_UPDATED",
    payload: { name: supplier.name },
  });
  return supplier;
}

export async function deactivateSupplier(companyId: string, supplierId: string) {
  await getSupplier(companyId, supplierId);
  const supplier = await prisma.supplier.update({
    where: { id: supplierId, companyId },
    data: { isActive: false },
  });
  await createAuditLog(companyId, {
    entityType: "Supplier",
    entityId: supplier.id,
    action: "SUPPLIER_DEACTIVATED",
    payload: { name: supplier.name },
  });
  return supplier;
}
