import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { requirePlatformCapability } from "@/lib/auth/platform-authorization";
import {
  getCommercePriceById,
  setCommercePriceReviewStatus,
  toCommercePriceDTO,
  type SetPriceReviewStatusInput,
} from "@/lib/repositories/commerce-product-repository";
import type { PlatformRequestMetadata } from "@/lib/repositories/platform-admin-repository";

function requestMetadataJson(metadata: PlatformRequestMetadata) {
  return {
    method: metadata.method,
    path: metadata.path,
    ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
  };
}

export type SetPriceReviewInput = {
  reviewStatus: SetPriceReviewStatusInput["reviewStatus"];
  reviewNote?: string;
};

/**
 * STRIPE-1C — the only way a CommercePrice's commercial review status
 * changes. Requires platform:operate (owner or admin; support is
 * read-only), always writes a PlatformAuditLog entry with actor + timestamp
 * + before/after status + the optional note, and never touches amount/
 * currency/interval — this is a governance gate, not a pricing edit.
 */
export async function setCommercePriceReview(
  actor: PlatformActor,
  priceId: string,
  input: SetPriceReviewInput,
  requestMetadata: PlatformRequestMetadata,
) {
  requirePlatformCapability(actor, "platform:operate");
  const before = await getCommercePriceById(priceId);

  const updated = await setCommercePriceReviewStatus(priceId, {
    reviewStatus: input.reviewStatus,
    reviewedByUserId: actor.userId,
    reviewNote: input.reviewNote ?? null,
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorPlatformRole: actor.platformRole,
      action: "commerce_price.set_review_status",
      targetType: "CommercePrice",
      targetId: updated.id,
      requestMetadataJson: requestMetadataJson(requestMetadata),
      beforeJson: { reviewStatus: before.reviewStatus },
      afterJson: {
        reviewStatus: updated.reviewStatus,
        reviewNote: updated.reviewNote,
        reviewedByUserId: updated.reviewedByUserId,
      },
    },
  });

  return toCommercePriceDTO(updated);
}
