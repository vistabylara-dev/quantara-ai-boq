import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { seedCommerceProducts } from "../../../../../../prisma/seed-data/commerce-products";
import {
  approveLibraryPackagePrices,
  backfillLibraryPackagePricing,
} from "../../../../../../prisma/seed-data/library-package-pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * MARKETPLACE-FULL-STRIPE-LINK — owner-only, idempotent production-safe
 * entrypoint for the same three-step pricing pipeline as
 * scripts/sync-library-package-pricing.ts (backfillLibraryPackagePricing ->
 * seedCommerceProducts -> approveLibraryPackagePrices, in that exact order —
 * see the ordering note already in library-package-pricing.ts). Runs inside
 * this deployment using its real runtime DATABASE_URL, which no external
 * process (including this agent) can read directly — the same break-glass
 * pattern already established for production data operations in this repo
 * (see the STRIPE-1B commerce-catalogue migration apply route this mission
 * was modeled on). GET so it's reachable by pasting the URL in a browser
 * while signed in as the platform owner.
 *
 * Never touches Stripe (seedCommerceProducts is DB-only), never touches a
 * demo/tenancy-bridge table (unlike prisma/seed.ts's full main(), this only
 * ever writes to IndustryDataPackage/CommerceProduct/CommercePrice/
 * EntitlementTemplate rows by exact key/code), and is safe to call more than
 * once — a second call reports "unchanged"/"already approved" and changes
 * nothing.
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    const backfill = await backfillLibraryPackagePricing(prisma);
    const commerce = await seedCommerceProducts(prisma);
    const approval = await approveLibraryPackagePrices(prisma);

    return apiSuccess({ backfill, commerce, approval });
  } catch (error) {
    return handleApiError(error);
  }
}
