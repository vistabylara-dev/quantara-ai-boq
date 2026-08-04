import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { PermissionDeniedError } from "@/lib/errors/app-error";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import {
  createCertification,
  createManufacturer,
  createProductModel,
  createProductSeries,
  getManufacturer,
  listManufacturers,
  listProductModelsForSeries,
  listProductSeriesForManufacturer,
  setProductModelVerificationState,
} from "@/lib/repositories/manufacturer-repository";

/**
 * MASTER-SCALE-1A — owner-only manufacturer/series/model/certification
 * management. No manufacturer or certification data is seeded anywhere in
 * this phase; these tables are genuinely empty until a real, permitted
 * dataset is imported by a future phase.
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Manufacturer administration is restricted to the platform owner.");
  }
}

export async function listManufacturersAdmin(owner: PlatformActor, filters: { search?: string; page?: number; pageSize?: number }) {
  requireOwner(owner);
  return listManufacturers(filters);
}

export async function createManufacturerAsOwner(owner: PlatformActor, input: { legalName: string; brandNames?: string[]; country?: string; website?: string; regionsServed?: string[] }) {
  requireOwner(owner);
  const manufacturer = await createManufacturer(input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MANUFACTURER_CREATED",
    targetType: "Manufacturer",
    targetId: manufacturer.id,
    metadata: { legalName: input.legalName },
  });
  return manufacturer;
}

export async function createProductSeriesAsOwner(owner: PlatformActor, input: { manufacturerId: string; seriesName: string; hierarchyNodeId?: string }) {
  requireOwner(owner);
  await getManufacturer(input.manufacturerId);
  const series = await createProductSeries(input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "PRODUCT_SERIES_CREATED",
    targetType: "ProductSeries",
    targetId: series.id,
    metadata: { manufacturerId: input.manufacturerId, seriesName: input.seriesName },
  });
  return series;
}

export async function listSeriesForManufacturerAsOwner(owner: PlatformActor, manufacturerId: string) {
  requireOwner(owner);
  await getManufacturer(manufacturerId);
  return listProductSeriesForManufacturer(manufacturerId);
}

export async function createProductModelAsOwner(owner: PlatformActor, input: { modelCode: string; productSeriesId: string; masterItemVersionId?: string; region?: "UAE" | "GCC" | "INTERNATIONAL" | "COUNTRY_SPECIFIC"; source?: string }) {
  requireOwner(owner);
  const model = await createProductModel(input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "PRODUCT_MODEL_CREATED",
    targetType: "ProductModel",
    targetId: model.id,
    metadata: { modelCode: input.modelCode, productSeriesId: input.productSeriesId },
  });
  return model;
}

export async function listModelsForSeriesAsOwner(owner: PlatformActor, productSeriesId: string) {
  requireOwner(owner);
  return listProductModelsForSeries(productSeriesId);
}

export async function setProductModelVerificationStateAsOwner(owner: PlatformActor, productModelId: string, verificationState: "UNVERIFIED" | "VERIFIED" | "NEEDS_REVIEW") {
  requireOwner(owner);
  const updated = await setProductModelVerificationState(productModelId, verificationState);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "PRODUCT_MODEL_VERIFICATION_SET",
    targetType: "ProductModel",
    targetId: productModelId,
    metadata: { verificationState },
  });
  return updated;
}

export async function createCertificationAsOwner(owner: PlatformActor, input: {
  productModelId?: string;
  masterItemId?: string;
  certificationType: string;
  authority: string;
  certificateNumber?: string;
  region?: "UAE" | "GCC" | "INTERNATIONAL" | "COUNTRY_SPECIFIC";
  issueDate?: string;
  expiryDate?: string;
  sourceDocumentReference: string;
}) {
  requireOwner(owner);
  const certification = await createCertification(input);
  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "PRODUCT_CERTIFICATION_CREATED",
    targetType: "ProductCertification",
    targetId: certification.id,
    metadata: { certificationType: input.certificationType, authority: input.authority },
  });
  return certification;
}
