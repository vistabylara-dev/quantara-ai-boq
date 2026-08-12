/**
 * CANVA-MODEL-1 — the generic domain contract every commercial-facing UI
 * component builds against. No Stripe types, no Stripe IDs, no commerce
 * internals — this is Claude's side of the boundary with Antigravity's
 * commerce/Stripe layer. A component importing from this file must never
 * import anything from src/lib/payments, src/lib/services/stripe-*,
 * src/app/api/webhooks/stripe, or src/app/api/commerce.
 */

export type CommercialRequirementType = "PLAN" | "PACKAGE" | "INTEGRATION";

export type CommercialOffer = {
  productCode: string;
  priceCode: string;
  displayName: string;
  amountMinor: number;
  currency: string;
  billingInterval: "MONTH" | "YEAR";
  checkoutAvailable: boolean;
  unavailableReason: string | null;
};

export type CommercialRequirement = {
  type: CommercialRequirementType;
  key: string;
  displayName: string;
  reason: string;
  fulfilled: boolean;
  usageCount?: number;
  boqItemIds?: string[];
  offers: CommercialOffer[];
};

export type CommercialAccessDecisionStatus = "ALLOW" | "COMMERCIAL_UNLOCK_REQUIRED";

export type CommercialAccessDecision = {
  status: CommercialAccessDecisionStatus;
  manifestFingerprint: string;
  requirements: CommercialRequirement[];
};

/**
 * Domain outcomes the test-only commercial simulator may inject — never a
 * Stripe implementation detail. See src/lib/commercial/test-commercial-adapter.ts.
 */
export type CommercialCheckoutOutcome =
  | "ALLOW"
  | "COMMERCIAL_UNLOCK_REQUIRED"
  | "CHECKOUT_REDIRECTED"
  | "CHECKOUT_CANCELLED"
  | "ENTITLEMENT_ACTIVATING"
  | "ACCESS_READY";

export type CheckoutHandoffResult = {
  checkoutUrl: string | null;
  unavailableReason: string | null;
};
