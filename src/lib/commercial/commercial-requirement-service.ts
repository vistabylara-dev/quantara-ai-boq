import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getBOQRecord } from "@/lib/repositories/boq-repository";
import { canGenerateDocument } from "@/lib/entitlements/entitlement-service";
import { companyHasPackageAccessForItem } from "@/lib/entitlements/package-entitlement-service";
import type { CommercialAccessDecision, CommercialOffer, CommercialRequirement } from "./commercial-types";

/**
 * CANVA-MODEL-1 — the single place "what does this BOQ need to unlock a
 * clean final export" is computed. Never trusts the browser: derives the
 * manifest entirely from real BOQItem provenance (sourceMasterItemId,
 * stamped at add-time regardless of entitlement — see
 * boq-item-source-service.ts) and the same entitlement functions already
 * used elsewhere (companyHasPackageAccessForItem, canGenerateDocument) —
 * never re-implements their logic.
 */

function toOffer(pkg: { key: string; name: string; monthlyPrice: number; currency: string }): CommercialOffer {
  return {
    productCode: pkg.key,
    priceCode: `${pkg.key}-monthly`,
    displayName: pkg.name,
    amountMinor: Math.round(pkg.monthlyPrice * 100),
    currency: pkg.currency,
    billingInterval: "MONTH",
    checkoutAvailable: pkg.monthlyPrice > 0,
    unavailableReason: pkg.monthlyPrice > 0 ? null : "Pricing not yet configured for this package.",
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
          offers: [toOffer({ key: pkg.key, name: pkg.name, monthlyPrice: Number(pkg.monthlyPrice), currency: pkg.currency })],
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
      offers: proPlan ? [toOffer({ key: proPlan.key, name: proPlan.name, monthlyPrice: Number(proPlan.monthlyPrice), currency: proPlan.currency })] : [],
    });
  }

  const status = requirements.length === 0 ? "ALLOW" : "COMMERCIAL_UNLOCK_REQUIRED";

  const fingerprintInput = [boqId, String(boqRecord.version), requirements.map((r) => `${r.type}:${r.key}:${r.usageCount ?? ""}`).sort().join(",")].join("|");
  const manifestFingerprint = createHash("sha256").update(fingerprintInput).digest("hex");

  return { status, manifestFingerprint, requirements };
}
