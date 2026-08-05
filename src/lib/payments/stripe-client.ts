import Stripe from "stripe";

/**
 * STRIPE-1C — server-only Stripe client. Never import this module from a
 * "use client" component; the runtime guard below is defense-in-depth, not
 * the primary boundary (the primary boundary is that nothing in this file
 * is ever imported by client-side code — every caller is a route handler,
 * repository, or service).
 */
if (typeof window !== "undefined") {
  throw new Error("stripe-client.ts must never be imported into client-side code.");
}

/** Pinned to the version this installed SDK build was generated against (see the "stripe" package's apiVersion.d.ts). */
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-07-29.dahlia";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not set. Configure it in the deployment environment before using Stripe features.");
    this.name = "StripeNotConfiguredError";
  }
}

/**
 * Thrown for a key that is syntactically present but not a valid Stripe
 * test-mode secret key. Never includes the key value itself — only whether
 * it looked like a live key, a publishable key, or neither.
 */
export class StripeInvalidKeyError extends Error {
  readonly reason: "LIVE_MODE_NOT_ALLOWED" | "NOT_A_SECRET_KEY";

  constructor(reason: "LIVE_MODE_NOT_ALLOWED" | "NOT_A_SECRET_KEY") {
    super(
      reason === "LIVE_MODE_NOT_ALLOWED"
        ? "STRIPE_SECRET_KEY is a live-mode key. STRIPE-1C only supports Stripe test mode — refusing to use it."
        : "STRIPE_SECRET_KEY does not look like a Stripe secret key (expected it to start with sk_test_ or sk_live_).",
    );
    this.name = "StripeInvalidKeyError";
    this.reason = reason;
  }
}

/**
 * Test-mode secret keys start `sk_test_`; live-mode keys start `sk_live_`.
 * This is a format check only — it never inspects the key's contents beyond
 * this prefix, and the key itself is never logged or included in any error.
 */
export function classifyStripeSecretKey(key: string): "test" | "live" | "invalid" {
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "invalid";
}

/**
 * Reads STRIPE_SECRET_KEY and constructs a Stripe client. Throws
 * StripeNotConfiguredError if unset, StripeInvalidKeyError if the key is
 * malformed or is a live-mode key (STRIPE-1C is test-mode only — see
 * docs/stripe-commerce-audit.md and the STRIPE-1C task scope). Constructing
 * the client makes no network call; Stripe's SDK never contacts the API
 * until a resource method is actually called.
 *
 * `overrideClient` supports dependency injection for tests — pass a mocked
 * Stripe-shaped object instead of hitting the real SDK.
 */
export function getStripeClient(overrideClient?: Stripe): Stripe {
  if (overrideClient) return overrideClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();

  const classification = classifyStripeSecretKey(key);
  if (classification === "invalid") throw new StripeInvalidKeyError("NOT_A_SECRET_KEY");
  if (classification === "live") throw new StripeInvalidKeyError("LIVE_MODE_NOT_ALLOWED");

  return new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });
}

/** Safe, boolean-only configuration state — never returns the key itself. */
export function getStripeConfigurationState(): { configured: boolean; testMode: boolean; classification: "test" | "live" | "invalid" | "unset" } {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { configured: false, testMode: false, classification: "unset" };
  const classification = classifyStripeSecretKey(key);
  return { configured: classification === "test", testMode: classification === "test", classification };
}
