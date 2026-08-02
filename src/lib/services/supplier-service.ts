import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  countSupplierCatalogueItems,
  createSupplier as createSupplierRecord,
  deactivateSupplier as deactivateSupplierRecord,
  getSupplier,
  listSuppliers,
  updateSupplier as updateSupplierRecord,
  type SupplierListFilters,
  type SupplierWriteInput,
} from "@/lib/repositories/supplier-repository";

export async function listSuppliersForCompany(actor: CurrentActor, filters: SupplierListFilters) {
  return listSuppliers(actor.companyId, filters);
}

export async function getSupplierForCompany(actor: CurrentActor, supplierId: string) {
  const supplier = await getSupplier(actor.companyId, supplierId);
  const catalogueItemCount = await countSupplierCatalogueItems(actor.companyId, supplierId);
  return { ...supplier, catalogueItemCount };
}

export async function createSupplierForCompany(actor: CurrentActor, input: SupplierWriteInput) {
  requireCapability(actor, "suppliers:manage");
  return createSupplierRecord(actor.companyId, input);
}

export async function updateSupplierForCompany(
  actor: CurrentActor,
  supplierId: string,
  input: Partial<SupplierWriteInput>,
) {
  requireCapability(actor, "suppliers:manage");
  return updateSupplierRecord(actor.companyId, supplierId, input);
}

export async function deactivateSupplierForCompany(actor: CurrentActor, supplierId: string) {
  requireCapability(actor, "suppliers:deactivate");
  return deactivateSupplierRecord(actor.companyId, supplierId);
}
