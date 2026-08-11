import { afterEach, describe, expect, it } from "vitest";
import {
  getStripeCommercialClient,
  getStripeCommercialConfigurationState,
  StripeInvalidKeyError,
  StripeNotConfiguredError,
} from "../src/lib/payments/stripe-client";

/**
 * STRIPE-COMMERCIAL-1 — the commercial (potentially live-capable) Stripe
 * client accessor. The base getStripeClient()'s test/live gating is already
 * covered by tests/stripe-sync-service.test.ts's "stripe-client
 * configuration" describe block (26/26 passing) — this file covers only the
 * additional behavior specific to getStripeCommercialClient(): that it is
 * the ONE path allowed to use a live key, and only when both the key and
 * STRIPE_MODE agree it's live.
 */
describe("getStripeCommercialClient", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalMode = process.env.STRIPE_MODE;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalMode === undefined) delete process.env.STRIPE_MODE;
    else process.env.STRIPE_MODE = originalMode;
  });

  it("accepts a live key when STRIPE_MODE=live", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_commercial_fixture_12345";
    process.env.STRIPE_MODE = "live";
    expect(() => getStripeCommercialClient()).not.toThrow();
  });

  it("rejects a live key when STRIPE_MODE is unset (defaults to test)", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_commercial_fixture_12345";
    delete process.env.STRIPE_MODE;
    try {
      getStripeCommercialClient();
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeInvalidKeyError);
      expect((error as StripeInvalidKeyError).reason).toBe("MODE_KEY_MISMATCH");
      expect((error as Error).message).not.toContain("sk_live_commercial_fixture_12345");
    }
  });

  it("rejects a live key when STRIPE_MODE=test", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_commercial_fixture_12345";
    process.env.STRIPE_MODE = "test";
    try {
      getStripeCommercialClient();
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeInvalidKeyError);
      expect((error as StripeInvalidKeyError).reason).toBe("MODE_KEY_MISMATCH");
    }
  });

  it("rejects a test key when STRIPE_MODE=live", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_commercial_fixture_12345";
    process.env.STRIPE_MODE = "live";
    try {
      getStripeCommercialClient();
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeInvalidKeyError);
      expect((error as StripeInvalidKeyError).reason).toBe("MODE_KEY_MISMATCH");
    }
  });

  it("accepts a test key when STRIPE_MODE=test (commercial client still works in test mode)", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_commercial_fixture_12345";
    process.env.STRIPE_MODE = "test";
    expect(() => getStripeCommercialClient()).not.toThrow();
  });

  it("rejects STRIPE_MODE values other than test/live", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_commercial_fixture_12345";
    process.env.STRIPE_MODE = "production";
    try {
      getStripeCommercialClient();
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeInvalidKeyError);
      expect((error as StripeInvalidKeyError).reason).toBe("INVALID_MODE");
    }
  });

  it("throws StripeNotConfiguredError with no key material in the message when unset", () => {
    delete process.env.STRIPE_SECRET_KEY;
    try {
      getStripeCommercialClient();
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StripeNotConfiguredError);
      expect((error as Error).message).not.toMatch(/sk_/);
    }
  });

  it("getStripeCommercialConfigurationState never returns key material and reports liveMode only when both key and mode agree", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_commercial_fixture_67890";
    process.env.STRIPE_MODE = "live";
    const state = getStripeCommercialConfigurationState();
    expect(state.liveMode).toBe(true);
    expect(JSON.stringify(state)).not.toContain("sk_live_commercial_fixture_67890");

    process.env.STRIPE_MODE = "test";
    expect(getStripeCommercialConfigurationState().liveMode).toBe(false);

    process.env.STRIPE_SECRET_KEY = "sk_test_commercial_fixture_67890";
    process.env.STRIPE_MODE = "live";
    expect(getStripeCommercialConfigurationState().liveMode).toBe(false);
  });
});
