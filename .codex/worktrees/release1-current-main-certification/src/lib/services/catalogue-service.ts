import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  createCatalogueItem as createCatalogueItemRecord,
  deactivateCatalogueItem as deactivateCatalogueItemRecord,
  getCatalogueItemById,
  getPriceHistory,
  listCatalogueItems,
  updateCatalogueItem as updateCatalogueItemRecord,
  type CatalogueItemWriteInput,
  type CatalogueListFilters,
} from "@/lib/repositories/rate-catalogue-repository";

export async function listCatalogueItemsForCompany(actor: CurrentActor, filters: CatalogueListFilters) {
  return listCatalogueItems(actor.companyId, filters);
}

export async function getCatalogueItemForCompany(actor: CurrentActor, itemId: string) {
  return getCatalogueItemById(actor.companyId, itemId);
}

export async function getCatalogueItemHistoryForCompany(actor: CurrentActor, itemId: string) {
  return getPriceHistory(actor.companyId, itemId);
}

export async function createCatalogueItemForCompany(actor: CurrentActor, input: CatalogueItemWriteInput) {
  requireCapability(actor, "catalogue:manage");
  return createCatalogueItemRecord(actor.companyId, input);
}

export async function updateCatalogueItemForCompany(
  actor: CurrentActor,
  itemId: string,
  input: Partial<CatalogueItemWriteInput>,
) {
  requireCapability(actor, "catalogue:manage");
  return updateCatalogueItemRecord(actor.companyId, itemId, input, actor.userId);
}

export async function deactivateCatalogueItemForCompany(actor: CurrentActor, itemId: string) {
  requireCapability(actor, "catalogue:manage");
  return deactivateCatalogueItemRecord(actor.companyId, itemId);
}
