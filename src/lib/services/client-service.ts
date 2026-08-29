import type { CurrentActor } from "@/lib/auth/current-actor";
import { hasCapability, requireCapability } from "@/lib/auth/rbac";
import {
  archiveClient as archiveClientRecord,
  countClientProjects,
  createClient as createClientRecord,
  getClient,
  listClients,
  updateClient as updateClientRecord,
  type ClientListFilters,
  type ClientWriteInput,
} from "@/lib/repositories/client-repository";

export async function listClientsForCompany(actor: CurrentActor, filters: ClientListFilters) {
  return listClients(actor.companyId, filters);
}

export async function getClientForCompany(actor: CurrentActor, clientId: string) {
  const client = await getClient(actor.companyId, clientId);
  const projectCount = await countClientProjects(actor.companyId, clientId);
  return { ...client, projectCount };
}

export async function createClientForCompany(actor: CurrentActor, input: ClientWriteInput) {
  if (
    !hasCapability(actor.role, "clients:manage")
    && !hasCapability(actor.role, "projects:create")
  ) {
    requireCapability(actor, "clients:manage");
  }
  return createClientRecord(actor.companyId, input);
}

export async function updateClientForCompany(
  actor: CurrentActor,
  clientId: string,
  input: Partial<ClientWriteInput>,
) {
  requireCapability(actor, "clients:manage");
  return updateClientRecord(actor.companyId, clientId, input);
}

export async function archiveClientForCompany(actor: CurrentActor, clientId: string) {
  requireCapability(actor, "clients:manage");
  return archiveClientRecord(actor.companyId, clientId);
}
