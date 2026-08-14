import { describe, expect, it } from "vitest";
import { PlatformRole } from "@prisma/client";
import { hasCapability } from "../src/lib/auth/rbac";
import { hasPlatformCapability } from "../src/lib/auth/platform-authorization";
import { refundApproveRequestSchema, refundRejectRequestSchema, refundRequestSchema } from "../src/lib/validation/commerce-schema";

describe("Refund authorization boundaries", () => {
  it("grants platform:refund to PLATFORM_OWNER only — not PLATFORM_ADMIN or PLATFORM_SUPPORT", () => {
    expect(hasPlatformCapability(PlatformRole.PLATFORM_OWNER, "platform:refund")).toBe(true);
    expect(hasPlatformCapability(PlatformRole.PLATFORM_ADMIN, "platform:refund")).toBe(false);
    expect(hasPlatformCapability(PlatformRole.PLATFORM_SUPPORT, "platform:refund")).toBe(false);
  });

  it("grants entitlements:manage (the customer refund-request gate) to COMPANY_OWNER and ADMINISTRATOR, not every role", () => {
    expect(hasCapability("COMPANY_OWNER", "entitlements:manage")).toBe(true);
    expect(hasCapability("ADMINISTRATOR", "entitlements:manage")).toBe(true);
    // A general member (e.g. an estimator) can view but never create a refund request —
    // the customer request route (POST /api/commerce/refunds/request) gates on exactly
    // this capability, matching the same billing-is-owner/admin-only precedent as checkout.
    expect(hasCapability("ESTIMATOR", "entitlements:manage")).toBe(false);
    expect(hasCapability("QUANTITY_SURVEYOR", "entitlements:manage")).toBe(false);
  });

  it("the customer refund-request schema never accepts a Stripe or provider ID, amount, or currency", () => {
    const parsed = refundRequestSchema.safeParse({
      reason: "Please refund me",
      // Every one of these must be silently rejected by .strict() — an attacker-supplied
      // provider ID or amount must never reach refund-request-service.ts.
      stripePaymentIntentId: "pi_attacker_supplied",
      stripeChargeId: "ch_attacker_supplied",
      amountMinor: 1,
      currency: "AED",
      companyId: "11111111-1111-1111-1111-111111111111",
    });
    expect(parsed.success).toBe(false);
  });

  it("the owner approve schema only ever accepts the two documented actions", () => {
    expect(refundApproveRequestSchema.safeParse({ action: "REFUND_ONLY" }).success).toBe(true);
    expect(refundApproveRequestSchema.safeParse({ action: "REFUND_AND_CANCEL" }).success).toBe(true);
    expect(refundApproveRequestSchema.safeParse({ action: "SOMETHING_ELSE" }).success).toBe(false);
    expect(refundApproveRequestSchema.safeParse({ action: "REFUND_ONLY", stripeRefundId: "re_attacker" }).success).toBe(false);
  });

  it("the owner reject schema accepts an optional reason and nothing else", () => {
    expect(refundRejectRequestSchema.safeParse({}).success).toBe(true);
    expect(refundRejectRequestSchema.safeParse({ reason: "Not eligible" }).success).toBe(true);
    expect(refundRejectRequestSchema.safeParse({ reason: "x", stripeRefundId: "re_attacker" }).success).toBe(false);
  });
});
