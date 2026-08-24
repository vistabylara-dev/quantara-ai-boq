import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { createAuditLog } from "@/lib/repositories/audit-repository";

export type ClientWriteInput = {
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxRegistrationNumber?: string | null;
  notes?: string | null;
};

export type ClientListFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
};

export type ClientListResult = {
  items: Awaited<ReturnType<typeof prisma.client.findMany>>;
  total: number;
  page: number;
  pageSize: number;
};

function normalizeEmail(email?: string | null): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function listClients(companyId: string, filters: ClientListFilters = {}): Promise<ClientListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where: Prisma.ClientWhereInput = {
    companyId,
    ...(filters.includeArchived ? {} : { isArchived: false }),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { companyName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.client.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getClient(companyId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) throw new NotFoundError("Client not found.");
  return client;
}

export async function findClientByEmail(companyId: string, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return prisma.client.findFirst({ where: { companyId, email: { equals: normalized, mode: "insensitive" } } });
}

async function findLikelyDuplicate(companyId: string, input: ClientWriteInput) {
  const normalizedEmail = normalizeEmail(input.email);
  if (normalizedEmail) {
    return prisma.client.findFirst({ where: { companyId, email: { equals: normalizedEmail, mode: "insensitive" } } });
  }
  if (input.companyName && input.phone) {
    return prisma.client.findFirst({
      where: { companyId, companyName: { equals: input.companyName, mode: "insensitive" }, phone: input.phone },
    });
  }
  return null;
}

export async function createClient(companyId: string, input: ClientWriteInput) {
  const duplicate = await findLikelyDuplicate(companyId, input);
  if (duplicate) {
    throw new ConflictError("CLIENT_ALREADY_EXISTS", "A client matching this email already exists.");
  }

  const client = await prisma.client.create({
    data: { companyId, ...input, email: normalizeEmail(input.email) },
  });
  await createAuditLog(companyId, {
    entityType: "Client",
    entityId: client.id,
    action: "CLIENT_CREATED",
    payload: { name: client.name, email: client.email },
  });
  return client;
}

export async function updateClient(companyId: string, clientId: string, input: Partial<ClientWriteInput>) {
  await getClient(companyId, clientId);
  const data: Prisma.ClientUpdateInput = {
    ...input,
    ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
  };
  const client = await prisma.client.update({ where: { id: clientId, companyId }, data });
  await createAuditLog(companyId, {
    entityType: "Client",
    entityId: client.id,
    action: "CLIENT_UPDATED",
    payload: { name: client.name },
  });
  return client;
}

export async function countClientProjects(companyId: string, clientId: string): Promise<number> {
  return prisma.project.count({ where: { companyId, clientId } });
}

export async function archiveClient(companyId: string, clientId: string) {
  await getClient(companyId, clientId);
  const client = await prisma.client.update({
    where: { id: clientId, companyId },
    data: { isArchived: true, archivedAt: new Date() },
  });
  await createAuditLog(companyId, {
    entityType: "Client",
    entityId: client.id,
    action: "CLIENT_ARCHIVED",
    payload: { name: client.name },
  });
  return client;
}
