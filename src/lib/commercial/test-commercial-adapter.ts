import type { CommercialAccessDecision, CommercialCheckoutOutcome } from "./commercial-types";

/**
 * CANVA-MODEL-1 — E2E-only commercial simulator. Lets the Canva-journey
 * acceptance test drive every domain outcome (COMMERCIAL_UNLOCK_REQUIRED,
 * CHECKOUT_REDIRECTED, CHECKOUT_CANCELLED, ENTITLEMENT_ACTIVATING,
 * ACCESS_READY, ALLOW) without a real Stripe checkout or webhook — it never
 * contains any Stripe implementation, only a request-header override.
 *
 * FAIL-CLOSED GUARANTEE: activating this requires a secret value that is
 * never set outside test/dev config (QUANTARA_TEST_COMMERCIAL_SECRET is not
 * in .env.example and is never set in the real Vercel production
 * environment). Even if a client sent every override header, the
 * server-side comparison target is `undefined` in production, so
 * `header === undefined` can only match if the attacker also sends no
 * header — which is the normal, real, non-simulated path anyway. This is
 * checked FIRST, before NODE_ENV, so there are two independent reasons this
 * can never activate in the deployed app: the secret doesn't exist there,
 * and NODE_ENV is "production" there.
 */

const TEST_OUTCOME_HEADER = "x-quantara-test-commercial-outcome";
const TEST_SECRET_HEADER = "x-quantara-test-commercial-secret";

const VALID_OUTCOMES: CommercialCheckoutOutcome[] = [
  "ALLOW",
  "COMMERCIAL_UNLOCK_REQUIRED",
  "CHECKOUT_REDIRECTED",
  "CHECKOUT_CANCELLED",
  "ENTITLEMENT_ACTIVATING",
  "ACCESS_READY",
];

export function isTestCommercialSimulatorRequest(headers: Headers): CommercialCheckoutOutcome | null {
  const configuredSecret = process.env.QUANTARA_TEST_COMMERCIAL_SECRET;
  if (!configuredSecret) return null; // Guarantee #1 — never set in production.
  if (process.env.NODE_ENV === "production") return null; // Guarantee #2 — belt and suspenders.

  const providedSecret = headers.get(TEST_SECRET_HEADER);
  if (!providedSecret || providedSecret !== configuredSecret) return null;

  const outcome = headers.get(TEST_OUTCOME_HEADER);
  if (!outcome || !VALID_OUTCOMES.includes(outcome as CommercialCheckoutOutcome)) return null;

  return outcome as CommercialCheckoutOutcome;
}

/** Builds a deterministic fake CommercialAccessDecision for the simulator's COMMERCIAL_UNLOCK_REQUIRED outcome — fixture prices only, never read from real commerce data. */
export function buildSimulatedUnlockDecision(): CommercialAccessDecision {
  return {
    status: "COMMERCIAL_UNLOCK_REQUIRED",
    manifestFingerprint: "test-simulator-fixed-fingerprint",
    requirements: [
      {
        type: "PACKAGE",
        key: "test-architectural-finishes",
        displayName: "Architectural Finishes Package",
        reason: "Your BOQ uses 1 item from this package.",
        fulfilled: false,
        usageCount: 1,
        boqItemIds: [],
        offers: [
          {
            productCode: "test-architectural-finishes",
            priceCode: "test-architectural-finishes-monthly",
            displayName: "Architectural Finishes Package",
            amountMinor: 29900,
            currency: "AED",
            billingInterval: "MONTH",
            checkoutAvailable: true,
            unavailableReason: null,
          },
        ],
      },
    ],
  };
}

export function buildSimulatedAllowDecision(): CommercialAccessDecision {
  return { status: "ALLOW", manifestFingerprint: "test-simulator-fixed-fingerprint-allow", requirements: [] };
}
