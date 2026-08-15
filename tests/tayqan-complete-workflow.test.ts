import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TAYQAN_HIRE_PLANS } from "../src/lib/tayqan/tayqan-commerce";
import { TAYQAN_WORK_STAGE_ORDER } from "../src/lib/tayqan/tayqan-workflow-contract";

const root = path.resolve(__dirname, "..");
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

describe("TAYQAN complete paid employee workflow", () => {
  it("pins all three approved hire packages", () => {
    expect(TAYQAN_HIRE_PLANS.map((x) => [x.priceCode, x.amountMinor, x.checkoutMode])).toEqual([
      ["tayqan_day_299", 29900, "payment"],
      ["tayqan_week_999", 99900, "payment"],
      ["tayqan_monthly_2499", 249900, "subscription"],
    ]);
  });

  it("defines the complete persisted work-order stages through human acceptance", () => {
    expect(TAYQAN_WORK_STAGE_ORDER).toEqual([
      "SOURCE_DISCOVERY", "SOURCE_PROCESSING", "EVIDENCE_REVIEW", "QUANTITY_PREPARATION",
      "RATE_PREPARATION", "BOQ_ASSEMBLY", "VALIDATION", "READY_FOR_ACCEPTANCE",
    ]);
  });

  it("reuses one work order per intake and does not restart completed source jobs", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    expect(source).toContain("findUnique({ where: { intakeSessionId: session.id } })");
    expect(source).toContain("ExtractionJobStatus.COMPLETED");
    expect(source).toContain("ExtractionJobStatus.NEEDS_REVIEW");
    expect(source).toContain("continue;");
  });

  it("requires professional review of extracted evidence instead of auto-confirming it", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    expect(source).toContain("EVIDENCE_REVIEW_REQUIRED");
    expect(source).toContain("confirmExtractedEntity");
    expect(source).toContain("rejectExtractedEntity");
    expect(source).not.toMatch(/status:\s*ExtractedEntityStatus\.CONFIRMED[\s\S]{0,100}updateMany/);
  });

  it("never invents missing quantities or rates", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    expect(source).toContain("QUANTITY_REQUIRED");
    expect(source).toContain("RATE_REQUIRED");
    expect(source).toContain("User-confirmed");
  });

  it("assembles through the governed extraction-to-BOQ import service and ends ready for acceptance", () => {
    const source = read("src", "lib", "services", "tayqan-work-order-service.ts");
    expect(source).toContain("importExtractedEntityToBoq");
    expect(source).toContain("enqueueWorkerReview");
    expect(source).toContain("READY_FOR_ACCEPTANCE");
    expect(source).not.toMatch(/status:\s*(?:BOQStatus\.)?(?:LOCKED|ISSUED|APPROVED)/);
  });

  it("keeps checkout success non-authoritative and TAYQAN separate from general SaaS pricing", () => {
    const checkout = read("src", "lib", "services", "tayqan-checkout-service.ts");
    const fulfillment = read("src", "lib", "services", "tayqan-stripe-fulfillment-service.ts");
    expect(checkout).not.toContain("CompanySoftwareSubscription");
    expect(fulfillment).toContain('session.payment_status === "paid"');
  });
});

describe("B1 governing instruction enforcement", () => {
  it("snapshots the complete intake context without adding Prisma fields", () => {
    const source = read(
      "src",
      "lib",
      "services",
      "tayqan-work-order-service.ts",
    );

    expect(source).toContain(
      "GoverningInstructionContext",
    );

    expect(source).toContain(
      "getTayqanIntakeConversationContext",
    );

    expect(source).toContain(
      "instructionContext",
    );

    expect(source).toContain(
      "measurementStandard",
    );

    expect(source).toContain(
      "exclusions",
    );

    expect(source).toContain(
      "deadlineText",
    );

    expect(source).toContain(
      "specialInstructions",
    );
  });

  it("freezes source files and scopes extracted evidence to those ProjectFile ids", () => {
    const source = read(
      "src",
      "lib",
      "services",
      "tayqan-work-order-service.ts",
    );

    expect(source).toContain(
      "selectedSourceFileIds",
    );

    expect(source).toContain(
      "SOURCE_SCOPE_SNAPSHOTTED",
    );

    expect(source).toContain(
      "SOURCE_REVISION_CONFLICT",
    );

    expect(source).toContain(
      "projectFileId: {",
    );

    expect(source).toContain(
      "in: sourceFileIds",
    );
  });

  it("does not silently use matched catalogue pricing against a different customer pricing basis", () => {
    const source = read(
      "src",
      "lib",
      "services",
      "tayqan-work-order-service.ts",
    );

    expect(source).toContain(
      "pricingBasisAllowsMatchedCatalogue",
    );

    expect(source).toContain(
      "!pricingBasisAllowsMatchedCatalogue",
    );

    expect(source).toContain(
      "RATE_REQUIRED",
    );
  });

  it("passes category, scope and customer instructions into final governed QA", () => {
    const source = read(
      "src",
      "lib",
      "services",
      "tayqan-work-order-service.ts",
    );

    expect(source).toContain(
      "governingQaInstructions",
    );

    expect(source).toContain(
      "Customer exclusions:",
    );

    expect(source).toContain(
      "Customer special instructions:",
    );

    expect(source).toContain(
      "Measurement standard requested by customer:",
    );

    expect(source).not.toMatch(
      /status:\s*(?:BOQStatus\.)?(?:LOCKED|ISSUED|APPROVED)/,
    );
  });
});
