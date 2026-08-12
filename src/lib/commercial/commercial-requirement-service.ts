import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getBOQRecord } from "@/lib/repositories/boq-repository";
import { canGenerateDocument } from "@/lib/entitlements/entitlement-service";
import { companyHasPackageAccessForItem } from "@/lib/entitlements/package-entitlement-service";
import type { CommercialAccessDecision, CommercialOffer, CommercialRequirement } from "./commercial-types";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the "I can see exactly what I will receive"
 * preview watermark. Lives here (not in the preview-html route file) since
 * a Next.js route file may only export its HTTP method handlers plus a
 * small set of route-config values — any other named export fails the
 * generated route type check.
 */
export const PREVIEW_LOCKED_WATERMARK_TEXT = "QUANTARA PREVIEW — DRAFT — UNLOCK TO DOWNLOAD";

/**
 * CANVA-MODEL-1 — the single place "what does this BOQ need to unlock a
 * clean final export" is computed. Never trusts the browser: derives the
 * manifest entirely from real BOQItem provenance (sourceMasterItemId,
 * stamped at add-time regardless of entitlement — see
 * boq-item-source-service.ts) and the same entitlement functions already
 * used elsewhere (companyHasPackageAccessForItem, canGenerateDocument) —
 * never re-implements their logic.
 *
 * Offer prices come from the REAL CommerceProduct/CommercePrice catalog
 * (already seeded on main via prisma/seed-data/commerce-products.ts), never
 * invented from IndustryDataPackage.monthlyPrice — the commerce/Stripe
 * checkout route (POST /api/commerce/checkout, owned by another layer and
 * not yet merged to this branch) only accepts a trusted CommercePrice.code,
 * so an offer whose priceCode doesn't correspond to a real row would 400 at
 * checkout time. checkoutAvailable mirrors that route's own real eligibility
 * facts (active, approved, non-indicative, positive, MONTH/YEAR price) —
 * everything this layer can know without touching Stripe provider-mapping
 * internals, which remain out of scope here.
 */

async function packageOffer(pkg: { id: string; key: string; name: string }): Promise<CommercialOffer> {
  const product = await prisma.commerceProduct.findFirst({
    where: { industryPackageId: pkg.id },
    include: {
      prices: {
        where: { isActive: true, isFromPrice: false, billingInterval: { in: ["MONTH", "YEAR"] } },
        orderBy: { billingInterval: "asc" }, // MONTH before YEAR — prefer the monthly price when both exist
      },
    },
  });
  const price = product?.prices[0];
  if (!product || !price) {
    return {
      productCode: pkg.key,
      priceCode: "",
      displayName: pkg.name,
      amountMinor: 0,
      currency: "AED",
      billingInterval: "MONTH",
      checkoutAvailable: false,
      unavailableReason: "Pricing not yet configured for this package.",
    };
  }
  return {
    productCode: product.code,
    priceCode: price.code,
    displayName: product.name,
    amountMinor: price.amountMinor,
    currency: price.currency,
    billingInterval: price.billingInterval as "MONTH" | "YEAR",
    checkoutAvailable: price.amountMinor > 0 && price.reviewStatus === "APPROVED",
    unavailableReason: price.amountMinor > 0 && price.reviewStatus === "APPROVED"
      ? null
      : "This package isn't available for direct checkout yet. Contact us to unlock it.",
  };
}

/**
 * Unlike packages, SoftwarePlan has no CommerceProduct foreign key today —
 * there is no real, reliable way to derive a valid CommercePrice.code for a
 * plan upgrade. Showing a real price with no real checkout path would be
 * worse than showing none: the honest state is "not available for direct
 * checkout yet," same as an unconfigured package.
 */
function planOffer(plan: { key: string; name: string }): CommercialOffer {
  return {
    productCode: plan.key,
    priceCode: "",
    displayName: plan.name,
    amountMinor: 0,
    currency: "AED",
    billingInterval: "MONTH",
    checkoutAvailable: false,
    unavailableReason: "Plan upgrades aren't available for direct checkout yet. Contact us to upgrade.",
  };
}

export async function resolveBoqCommercialRequirements(companyId: string, boqId: string): Promise<CommercialAccessDecision> {
  const boqRecord = await getBOQRecord(companyId, boqId);

  const items = await prisma.bOQItem.findMany({
    where: { companyId, section: { boqId } },
    select: { id: true, sourceMasterItemId: true },
  });
  const sourcedMasterItemIds = [...new Set(items.filter((i) => i.sourceMasterItemId).map((i) => i.sourceMasterItemId!))];

  const premiumMasterItems = sourcedMasterItemIds.length > 0
    ? await prisma.masterItem.findMany({ where: { id: { in: sourcedMasterItemIds }, isPremium: true }, select: { id: true } })
    : [];
  const premiumItemIds = premiumMasterItems.map((i) => i.id);

  const requirements: CommercialRequirement[] = [];

  if (premiumItemIds.length > 0) {
    const memberships = await prisma.industryDataPackageItem.findMany({
      where: { masterItemId: { in: premiumItemIds } },
      select: { masterItemId: true, packageId: true },
    });
    const packageIdsByItem = new Map<string, string[]>();
    for (const m of memberships) {
      const list = packageIdsByItem.get(m.masterItemId) ?? [];
      list.push(m.packageId);
      packageIdsByItem.set(m.masterItemId, list);
    }

    // Deterministic resolution, not full minimum-set-cover: for each
    // currently-unsatisfied premium item, attribute it to its lowest-id
    // associated package. Explicit package membership in this catalogue is
    // almost always one-to-one (never inferred from discipline), so this
    // rarely double-lists real coverage; never charges for a second
    // equivalent package if any one owned/eligible package already
    // satisfies an item (that check — companyHasPackageAccessForItem —
    // happens first, below, and is unaffected by this attribution choice).
    const unsatisfiedByPackage = new Map<string, { itemId: string; boqItemIds: string[] }[]>();
    for (const itemId of premiumItemIds) {
      const hasAccess = await companyHasPackageAccessForItem(companyId, itemId);
      if (hasAccess) continue;
      const boqItemIdsForThisItem = items.filter((i) => i.sourceMasterItemId === itemId).map((i) => i.id);
      const candidatePackageIds = [...(packageIdsByItem.get(itemId) ?? [])].sort();
      const targetPackageId = candidatePackageIds[0];
      if (!targetPackageId) {
        // A Premium item with no package membership at all can never be
        // satisfied by any purchase — fail closed with a blocking,
        // non-purchasable requirement instead of silently allowing export.
        requirements.push({
          type: "PACKAGE",
          key: `unconfigured-${itemId}`,
          displayName: "Unconfigured premium item",
          reason: "This BOQ contains a premium item that isn't part of any purchasable package yet. Contact support to resolve this before exporting.",
          fulfilled: false,
          usageCount: 1,
          boqItemIds: boqItemIdsForThisItem,
          offers: [],
        });
        continue;
      }
      const list = unsatisfiedByPackage.get(targetPackageId) ?? [];
      list.push({ itemId, boqItemIds: boqItemIdsForThisItem });
      unsatisfiedByPackage.set(targetPackageId, list);
    }

    if (unsatisfiedByPackage.size > 0) {
      const packages = await prisma.industryDataPackage.findMany({ where: { id: { in: [...unsatisfiedByPackage.keys()] } } });
      for (const pkg of packages) {
        const entries = unsatisfiedByPackage.get(pkg.id) ?? [];
        requirements.push({
          type: "PACKAGE",
          key: pkg.key,
          displayName: pkg.name,
          reason: `Your BOQ uses ${entries.length} item${entries.length === 1 ? "" : "s"} from this package.`,
          fulfilled: false,
          usageCount: entries.length,
          boqItemIds: entries.flatMap((e) => e.boqItemIds),
          offers: [await packageOffer(pkg)],
        });
      }
    }
  }

  const exportCheck = await canGenerateDocument(companyId, false);
  if (!exportCheck.allowed) {
    const proPlan = await prisma.softwarePlan.findFirst({ where: { planType: "PRO", isActive: true } });
    requirements.push({
      type: "PLAN",
      key: proPlan?.key ?? "professional",
      displayName: proPlan?.name ?? "Professional Plan",
      reason: exportCheck.reason ?? "Your trial's final export limit has been reached.",
      fulfilled: false,
      offers: proPlan ? [planOffer(proPlan)] : [],
    });
  }

  const status = requirements.length === 0 ? "ALLOW" : "COMMERCIAL_UNLOCK_REQUIRED";

  const fingerprintInput = [boqId, String(boqRecord.version), requirements.map((r) => `${r.type}:${r.key}:${r.usageCount ?? ""}`).sort().join(",")].join("|");
  const manifestFingerprint = createHash("sha256").update(fingerprintInput).digest("hex");

  return { status, manifestFingerprint, requirements };
}
