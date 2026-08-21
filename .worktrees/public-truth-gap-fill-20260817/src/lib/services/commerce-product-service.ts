import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requirePlatformCapability } from "@/lib/auth/platform-authorization";
import {
  getCommerceProduct,
  listCommerceProducts,
  toCommerceProductDTO,
  toPublicCommerceProductDTO,
  updateCommerceProductState,
  type CommerceProductListFilters,
  type SetProductStateInput,
} from "@/lib/repositories/commerce-product-repository";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";

function requestMetadataJson(metadata: PlatformRequestMetadata) {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

/**
 * Public catalogue read — used by the (future) pricing page and the public
 * products API. Always filters to active+public regardless of what the
 * caller passes, so a mistake upstream can never leak a draft/private
 * product through this path.
 */
export async function listPublicCommerceProducts(filters: Omit<CommerceProductListFilters, "activeOnly" | "publicOnly"> = {}) {
  const rows = await listCommerceProducts({ ...filters, activeOnly: true, publicOnly: true });
  return rows.map(toPublicCommerceProductDTO);
}

/** Platform-owner/admin/support read — full detail including inactive/private products. */
export async function listAdminCommerceProducts(actor: PlatformActor, filters: CommerceProductListFilters = {}) {
  requirePlatformCapability(actor, "platform:read");
  const rows = await listCommerceProducts(filters);
  return rows.map(toCommerceProductDTO);
}

export async function getAdminCommerceProduct(actor: PlatformActor, productId: string) {
  requirePlatformCapability(actor, "platform:read");
  const row = await getCommerceProduct(productId);
  return toCommerceProductDTO(row);
}

/**
 * Activate/deactivate, publish/unpublish, reorder — the only mutation
 * surface exposed in STRIPE-1B. Requires platform:operate (owner or admin;
 * support is read-only), and records a PlatformAuditLog entry with a
 * before/after snapshot of the fields that actually changed.
 */
export async function updateAdminCommerceProductState(
  actor: PlatformActor,
  productId: string,
  input: SetProductStateInput,
  requestMetadata: PlatformRequestMetadata,
) {
  requirePlatformCapability(actor, "platform:operate");
  const before = await getCommerceProduct(productId);
  const updated = await updateCommerceProductState(productId, input);

  const changed =
    before.isActive !== updated.isActive ||
    before.isPublic !== updated.isPublic ||
    before.sortOrder !== updated.sortOrder;

  if (changed) {
    await prisma.platformAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorPlatformRole: actor.platformRole,
        action: "commerce_product.update_state",
        targetType: "CommerceProduct",
        targetId: updated.id,
        requestMetadataJson: requestMetadataJson(requestMetadata),
        beforeJson: { isActive: before.isActive, isPublic: before.isPublic, sortOrder: before.sortOrder },
        afterJson: { isActive: updated.isActive, isPublic: updated.isPublic, sortOrder: updated.sortOrder },
      },
    });
  }

  return toCommerceProductDTO(updated);
}
