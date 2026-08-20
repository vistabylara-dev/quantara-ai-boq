import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { createDirectPrismaClient } from "../src/lib/db/direct-prisma-client";
import { seedCommerceProducts, type CommerceSeedReport } from "../prisma/seed-data/commerce-products";
import {
  approveLibraryPackagePrices,
  backfillLibraryPackagePricing,
  type LibraryPriceApprovalReport,
  type LibraryPricingBackfillReport,
} from "../prisma/seed-data/library-package-pricing";

/**
 * MARKETPLACE-FULL-STRIPE-LINK — a narrow, production-safe alternative to
 * `npm run seed`/`prisma/seed.ts`'s full main(). That entrypoint also seeds
 * a full demo tenant under the fixed DEVELOPMENT_COMPANY_ID (see
 * src/lib/tenancy/development-company.ts's "TEMPORARY PHASE 1 TENANCY
 * BRIDGE" comment) — safe for local dev, but not something to risk running
 * against a live database serving real customers if that demo company has
 * never been created there.
 *
 * This script runs ONLY the three pricing-pipeline calls, in the order
 * library-package-pricing.ts's own doc comment requires (backfill must run
 * before the seed, which derives CommercePrice.amountMinor from the
 * packages' now-real monthlyPrice/annualPrice; approval must run after, so
 * it can find the CommercePrice rows the seed just created by their exact
 * code). Every one of the three is independently idempotent and touches
 * only IndustryDataPackage/CommerceProduct/CommercePrice/EntitlementTemplate
 * rows by stable key/code — never a Company, Client, Project, or BOQ row,
 * never Stripe, never DEV_OWNER_*.
 */
export async function syncLibraryPackagePricing(prisma: PrismaClient): Promise<{
  backfill: LibraryPricingBackfillReport;
  commerce: CommerceSeedReport;
  approval: LibraryPriceApprovalReport;
}> {
  const backfill = await backfillLibraryPackagePricing(prisma);
  console.log(
    `Library package pricing backfill: updated [${backfill.updated.join(", ") || "none"}], unchanged [${backfill.unchanged.join(", ") || "none"}], missing [${backfill.missing.join(", ") || "none"}].`,
  );

  const commerce = await seedCommerceProducts(prisma);
  console.log(
    `Seeded commerce catalogue: products +${commerce.productsInserted}/~${commerce.productsUpdated}/=${commerce.productsUnchanged}, prices +${commerce.pricesInserted}/archived ${commerce.pricesArchived}/=${commerce.pricesUnchanged}, templates +${commerce.templatesInserted}/~${commerce.templatesUpdated}, industry products created [${commerce.industryProductsCreated.join(", ") || "none"}], industry products skipped: ${commerce.industryProductsSkipped.length}.`,
  );

  const approval = await approveLibraryPackagePrices(prisma);
  console.log(
    `Library package price approval: approved [${approval.approved.join(", ") || "none"}], already approved [${approval.alreadyApproved.join(", ") || "none"}], missing [${approval.missing.join(", ") || "none"}].`,
  );

  return { backfill, commerce, approval };
}

async function runCli(): Promise<void> {
  const database = createDirectPrismaClient();
  try {
    await syncLibraryPackagePricing(database);
  } catch (error) {
    console.error("Library package pricing sync: FAILED");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await database.$disconnect().catch(() => undefined);
  }
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  void runCli();
}
