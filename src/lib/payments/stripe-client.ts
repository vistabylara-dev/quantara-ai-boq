import Stripe from "stripe";

/**
 * Server-only Stripe client.
 *
 * Safety model:
 * - Existing catalogue/product synchronization stays TEST-ONLY.
 * - Customer commerce may use live mode only through
 *   getStripeCommercialClient().
 * - A live key requires STRIPE_MODE=live explicitly.
 * - A test key cannot run while STRIPE_MODE=live.
 * - Secrets are never included in errors or logs.
 */
if (typeof window !== "undefined") {
  throw new Error("stripe-client.ts must never be imported into client-side code.");
}

const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-07-29.dahlia";

export type StripeKeyClassification = "test" | "live" | "invalid";
export type StripeConfiguredMode = "test" | "live" | "invalid";

export type StripeClientOptions = {
  /**
   * Defaults to false so all existing callers remain test-only.
   * Only customer-facing commercial payment flows should set this true.
   */
  allowLive?: boolean;
};

export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      "STRIPE_SECRET_KEY is not set. Configure it in the deployment environment before using Stripe features.",
    );
    this.name = "StripeNotConfiguredError";
  }
}

export class StripeInvalidKeyError extends Error {
  readonly reason:
    | "LIVE_MODE_NOT_ALLOWED"
    | "NOT_A_SECRET_KEY"
    | "MODE_KEY_MISMATCH"
    | "INVALID_MODE";

  constructor(
    reason:
      | "LIVE_MODE_NOT_ALLOWED"
      | "NOT_A_SECRET_KEY"
      | "MODE_KEY_MISMATCH"
      | "INVALID_MODE",
  ) {
    const messages = {
      LIVE_MODE_NOT_ALLOWED:
        "This Stripe operation is restricted to test mode. Live Stripe access is not allowed from this code path.",
      NOT_A_SECRET_KEY:
        "STRIPE_SECRET_KEY does not look like a Stripe secret key.",
      MODE_KEY_MISMATCH:
        "STRIPE_MODE does not match the configured Stripe secret-key environment.",
      INVALID_MODE:
        "STRIPE_MODE must be either test or live.",
    } as const;

    super(messages[reason]);
    this.name = "StripeInvalidKeyError";
    this.reason = reason;
  }
}

export function classifyStripeSecretKey(key: string): StripeKeyClassification {
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "invalid";
}

export function getConfiguredStripeMode(): StripeConfiguredMode {
  const raw = process.env.STRIPE_MODE?.trim().toLowerCase();

  // Backward-compatible safe default for existing test-only Stripe tooling.
  if (!raw || raw === "test") return "test";
  if (raw === "live") return "live";

  return "invalid";
}

/**
 * Base Stripe client.
 *
 * IMPORTANT:
 * Existing callers get test-only behavior because allowLive defaults false.
 * Live customer payment flows must explicitly opt in AND STRIPE_MODE must
 * equal "live".
 */
export function getStripeClient(
  overrideClient?: Stripe,
  options: StripeClientOptions = {},
): Stripe {
  if (overrideClient) return overrideClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();

  const classification = classifyStripeSecretKey(key);
  const configuredMode = getConfiguredStripeMode();

  if (configuredMode === "invalid") {
    throw new StripeInvalidKeyError("INVALID_MODE");
  }

  if (classification === "invalid") {
    throw new StripeInvalidKeyError("NOT_A_SECRET_KEY");
  }

  if (classification === "live") {
    if (!options.allowLive) {
      throw new StripeInvalidKeyError("LIVE_MODE_NOT_ALLOWED");
    }

    if (configuredMode !== "live") {
      throw new StripeInvalidKeyError("MODE_KEY_MISMATCH");
    }
  }

  if (classification === "test" && configuredMode !== "test") {
    throw new StripeInvalidKeyError("MODE_KEY_MISMATCH");
  }

  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
}

/**
 * Customer-facing Stripe commerce client.
 *
 * Unlike getStripeClient(), this entry point permits live Stripe only when:
 *   STRIPE_SECRET_KEY starts with sk_live_
 *   AND
 *   STRIPE_MODE=live
 *
 * Existing admin catalogue synchronization does not use this function and
 * therefore remains test-only.
 */
export function getStripeCommercialClient(overrideClient?: Stripe): Stripe {
  return getStripeClient(overrideClient, { allowLive: true });
}

export function getStripeConfigurationState(
  options: StripeClientOptions = {},
): {
  configured: boolean;
  testMode: boolean;
  liveMode: boolean;
  classification: StripeKeyClassification | "unset";
  configuredMode: StripeConfiguredMode;
} {
  const key = process.env.STRIPE_SECRET_KEY;
  const configuredMode = getConfiguredStripeMode();

  if (!key) {
    return {
      configured: false,
      testMode: false,
      liveMode: false,
      classification: "unset",
      configuredMode,
    };
  }

  const classification = classifyStripeSecretKey(key);

  if (classification === "invalid" || configuredMode === "invalid") {
    return {
      configured: false,
      testMode: false,
      liveMode: false,
      classification,
      configuredMode,
    };
  }

  const testConfigured =
    classification === "test" && configuredMode === "test";

  const liveConfigured =
    classification === "live" &&
    configuredMode === "live" &&
    options.allowLive === true;

  return {
    configured: testConfigured || liveConfigured,
    testMode: testConfigured,
    liveMode: liveConfigured,
    classification,
    configuredMode,
  };
}

/**
 * Safe status helper for customer-facing commerce.
 * Returns no API key or secret material.
 */
export function getStripeCommercialConfigurationState() {
  return getStripeConfigurationState({ allowLive: true });
}