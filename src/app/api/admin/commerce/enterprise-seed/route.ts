import { PLATFORM_OWNER_ROLES, requirePlatformActor } from "@/lib/auth/platform-authorization";
import { prisma } from "@/lib/db/prisma";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { seedEnterpriseCommerceProducts } from "../../../../../../prisma/seed-data/commerce-products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Target-only production activation for the three Enterprise SaaS tiers.
 *
 * PLATFORM_OWNER only.
 *
 * seedEnterpriseCommerceProducts is idempotent and touches exactly:
 * - enterprise_core
 * - enterprise_scale
 * - enterprise_authority
 *
 * It does NOT approve prices and does NOT synchronize Stripe.
 * Newly-created/changed prices remain behind the existing commercial
 * review/approval gate.
 */
export async function POST() {
  try {
    await requirePlatformActor(PLATFORM_OWNER_ROLES);

    const report = await seedEnterpriseCommerceProducts(prisma);

    return apiSuccess(report);
  } catch (error) {
    return handleApiError(error);
  }
}
