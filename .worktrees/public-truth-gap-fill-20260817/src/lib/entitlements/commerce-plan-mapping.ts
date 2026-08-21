import type { PrismaClient } from "@prisma/client";
import { PlanType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type SoftwarePlanClient = Pick<PrismaClient, "softwarePlan">;

/**
 * STRIPE-COMMERCIAL-1 — the single, explicit bridge between the commerce
 * catalogue (CommerceProduct/CommercePrice, AED-priced, Stripe-facing) and
 * the pre-existing entitlement backbone (SoftwarePlan/CompanySoftwareSubscription,
 * USD-priced, `canCreateProject` et al.).
 *
 * These are deliberately NOT the same identity. The existing "pro" SoftwarePlan
 * key (maxProjects: null, i.e. unlimited) and the commerce "starter" product
 * (maxActiveProjects: 3) are commercially different products that happen to
 * both be "an entry paid tier" — mapping starter -> pro would silently grant
 * unlimited projects to a customer who bought a 3-project plan. Every commerce
 * subscription tier therefore gets its own SoftwarePlan row (a distinct `key`,
 * namespaced `commerce_*` to avoid colliding with the legacy free/trial-pro/
 * pro/business/enterprise keys), seeded from this file's canonical specs so
 * the seed script and the webhook processor can never drift apart.
 *
 * Only the one limit entitlement-service.ts actually enforces today
 * (`maxProjects`, via `canCreateProject`) is carried over with real values.
 * `maxUsers`/`maxActiveBoqs`/`maxDocumentsPerMonth` have no runtime gate
 * anywhere in this codebase (same "recorded, not enforced" status as
 * EntitlementTemplate's bulk-export/API-access fields) — they are stored for
 * future enforcement and admin visibility, not claimed as active limits.
 */

export type CommerceLinkedPlanSpec = {
  softwarePlanKey: string;
  commerceProductCode: string;
  name: string;
  description: string;
  planType: PlanType;
  monthlyPriceAed: number;
  annualPriceAed: number;
  maxUsers: number | null;
  /** The one field with a real runtime gate (`canCreateProject`). */
  maxProjects: number | null;
};

export const COMMERCE_LINKED_SOFTWARE_PLANS: readonly CommerceLinkedPlanSpec[] = [
  {
    softwarePlanKey: "commerce_starter",
    commerceProductCode: "starter",
    name: "Starter",
    description: "Commerce-purchased Starter subscription (AED 149/mo or AED 1,490/yr). Synced from the starter CommerceProduct entitlement template.",
    planType: PlanType.PRO,
    monthlyPriceAed: 149,
    annualPriceAed: 1490,
    maxUsers: 3,
    maxProjects: 3,
  },
  {
    softwarePlanKey: "commerce_professional",
    commerceProductCode: "professional",
    name: "Professional",
    description: "Commerce-purchased Professional subscription (AED 399/mo or AED 3,990/yr). Synced from the professional CommerceProduct entitlement template.",
    planType: PlanType.PRO,
    monthlyPriceAed: 399,
    annualPriceAed: 3990,
    maxUsers: 10,
    maxProjects: 15,
  },
  {
    softwarePlanKey: "commerce_business",
    commerceProductCode: "business",
    name: "Business",
    description: "Commerce-purchased Business subscription (AED 899/mo or AED 8,990/yr). Synced from the business CommerceProduct entitlement template.",
    planType: PlanType.BUSINESS,
    monthlyPriceAed: 899,
    annualPriceAed: 8990,
    maxUsers: 30,
    maxProjects: null,
  },
] as const;

const SPEC_BY_PRODUCT_CODE = new Map(
  COMMERCE_LINKED_SOFTWARE_PLANS.map((spec) => [spec.commerceProductCode, spec]),
);

/**
 * Only the three direct-checkout SUBSCRIPTION tiers are covered — one-time
 * purchases (boq_single_export, ai_credits_pack_*, ...), QUOTATION_REQUIRED/
 * CONTACT_SALES add-ons, and industry-access products have no SoftwarePlan
 * equivalent and must never resolve here.
 */
export function findCommerceLinkedPlanSpec(commerceProductCode: string): CommerceLinkedPlanSpec | null {
  return SPEC_BY_PRODUCT_CODE.get(commerceProductCode) ?? null;
}

/**
 * Idempotent upsert of one commerce-linked SoftwarePlan row, keyed on the
 * spec's stable `softwarePlanKey`. Safe to call from the seed script and
 * defensively from the webhook processor (which cannot assume the seed has
 * run in every environment) — mirrors the upsert-by-key pattern already used
 * by seedSoftwarePlans/seedCommerceProducts.
 */
export async function ensureCommerceLinkedSoftwarePlan(
  spec: CommerceLinkedPlanSpec,
  client: SoftwarePlanClient = prisma,
) {
  return client.softwarePlan.upsert({
    where: { key: spec.softwarePlanKey },
    update: {
      name: spec.name,
      description: spec.description,
      planType: spec.planType,
      monthlyPrice: spec.monthlyPriceAed,
      annualPrice: spec.annualPriceAed,
      currency: "AED",
      maxUsers: spec.maxUsers,
      maxProjects: spec.maxProjects,
    },
    create: {
      key: spec.softwarePlanKey,
      name: spec.name,
      description: spec.description,
      planType: spec.planType,
      monthlyPrice: spec.monthlyPriceAed,
      annualPrice: spec.annualPriceAed,
      currency: "AED",
      maxUsers: spec.maxUsers,
      maxProjects: spec.maxProjects,
      maxActiveBoqs: null,
      maxDocumentsPerMonth: null,
    },
  });
}

export async function seedCommerceLinkedSoftwarePlans(client: SoftwarePlanClient = prisma): Promise<void> {
  for (const spec of COMMERCE_LINKED_SOFTWARE_PLANS) {
    await ensureCommerceLinkedSoftwarePlan(spec, client);
  }
}

/**
 * Resolves the SoftwarePlan a commerce product code maps to, creating it only
 * if missing. Returns null for a non-subscription/non-mapped product code.
 *
 * Reads first rather than always upserting: this is called from every
 * subscription-affecting webhook event inside the serialized reconciliation
 * transaction. Always upserting would silently revert any operator edit to
 * a commerce_* SoftwarePlan row (name, price, maxProjects, ...) on the very
 * next webhook delivery, and would take an unnecessary row write/lock on
 * every event.
 */
export async function resolveSoftwarePlanForCommerceProductCode(
  commerceProductCode: string,
  client: SoftwarePlanClient = prisma,
) {
  const spec = findCommerceLinkedPlanSpec(commerceProductCode);
  if (!spec) return null;
  const existing = await client.softwarePlan.findUnique({ where: { key: spec.softwarePlanKey } });
  if (existing) return existing;
  return ensureCommerceLinkedSoftwarePlan(spec, client);
}
