import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export type ClientWriteInput = {
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export async function listClients(companyId: string) {
  return prisma.client.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export async function getClient(companyId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) throw new NotFoundError("Client not found.");
  return client;
}

export async function createClient(companyId: string, input: ClientWriteInput) {
  return prisma.client.create({ data: { companyId, ...input } });
}

export async function updateClient(companyId: string, clientId: string, input: Partial<ClientWriteInput>) {
  await getClient(companyId, clientId);
  const data: Prisma.ClientUpdateInput = { ...input };
  return prisma.client.update({ where: { id: clientId, companyId }, data });
}
