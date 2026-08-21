import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CommerceProductRecord } from "../src/lib/repositories/commerce-product-repository";
import { classifyLiveCheckoutEligibility } from "../src/lib/services/stripe-live-sync-service";
import {
  deriveTayqanIntakeConversationContext,
  deriveTayqanQuestion,
  type TayqanProjectSnapshot,
} from "../src/lib/services/tayqan-hire-service";
import { TAYQAN_HIRE_PLANS } from "../src/lib/tayqan/tayqan-commerce";

const REPO = process.cwd();

function read(...parts: string[]) {
  return fs.readFileSync(path.join(REPO, ...parts), "utf8");
}

function product(
  code: string,
  type: "ONE_TIME" | "SUBSCRIPTION",
  interval: "ONE_TIME" | "MONTH",
): CommerceProductRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    code,
    type,
    name: code,
    shortDescription: "",
    description: "",
    purchaseMode: "DIRECT",
    isActive: true,
    isPublic: true,
    sortOrder: 1,
    industryPackageId: null,
    metadataJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    entitlementTemplate: null,
    prices: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        productId: "00000000-0000-4000-8000-000000000001",
        code: `${code}_price`,
        amountMinor: 100,
        currency: "AED",
        billingInterval: interval,
        isFromPrice: false,
        isActive: true,
        validFrom: new Date(),
        validUntil: null,
        reviewStatus: "APPROVED",
        reviewedByUserId: null,
        reviewedAt: new Date(),
        reviewNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  } as unknown as CommerceProductRecord;
}

const BASE_SESSION = {
  boqId: null,
  desiredDeliverable: null,
  measurementStandard: null,
  includeRates: null,
  pricingBasis: null,
  exclusions: null,
  deadlineText: null,
  specialInstructions: null,
  authoritativeSourcePolicy: null,
} as Parameters<typeof deriveTayqanQuestion>[1];

const BASE_CONTEXT = {
  projectCategory: "BUILDING",
  categoryScope: "FULL_BUILDING",
} as const;

const BASE_SNAPSHOT: TayqanProjectSnapshot = {
  project: {
    id: "00000000-0000-4000-8000-000000000010",
    slug: "project-1",
    name: "Project 1",
    reference: "P-1",
    description: null,
    location: null,
  },
  boqs: [],
  files: [],
  ambiguousDrawingGroups: [],
  extractedEntityCount: 0,
  confirmedEntityCount: 0,
};

describe("TAYQAN-HIRE-1 approved commercial contract", () => {
  it("pins the exact Day / Week / Monthly launch prices and checkout modes", () => {
    expect(TAYQAN_HIRE_PLANS).toEqual([
      expect.objectContaining({
        plan: "DAY",
        productCode: "tayqan_day",
        priceCode: "tayqan_day_299",
        amountMinor: 29900,
        checkoutMode: "payment",
        durationHours: 24,
      }),
      expect.objectContaining({
        plan: "WEEK",
        productCode: "tayqan_week",
        priceCode: "tayqan_week_999",
        amountMinor: 99900,
        checkoutMode: "payment",
        durationHours: 168,
      }),
      expect.objectContaining({
        plan: "MONTHLY",
        productCode: "tayqan_monthly",
        priceCode: "tayqan_monthly_2499",
        amountMinor: 249900,
        checkoutMode: "subscription",
      }),
    ]);
  });

  it("permits only the dedicated TAYQAN one-time products through live sync, not unrelated one-time catalogue products", () => {
    const tayqanDay = product("tayqan_day", "ONE_TIME", "ONE_TIME");
    const unrelated = product("boq_single_export", "ONE_TIME", "ONE_TIME");
    expect(classifyLiveCheckoutEligibility(tayqanDay, tayqanDay.prices[0]).eligible).toBe(true);
    expect(classifyLiveCheckoutEligibility(unrelated, unrelated.prices[0])).toMatchObject({
      eligible: false,
      reason: "PRODUCT_NOT_SUBSCRIPTION",
    });
  });

  it("does not route TAYQAN checkout through the general software-subscription checkout endpoint", () => {
    const source = read("src", "lib", "services", "tayqan-checkout-service.ts");
    expect(source).not.toContain("assertNoExistingNonFinalSubscription");
    expect(source).not.toContain("CompanySoftwareSubscription");
    expect(source).toContain('mode: plan.checkoutMode');
  });

  it("does not trust a browser checkout=success flag to grant access", () => {
    const ui = read("src", "components", "tayqan", "tayqan-hire-experience.tsx");
    expect(ui).toContain('checkoutState === "success"');
    expect(ui).toContain('t("tayqan.hire.confirmingPayment")');
    expect(ui).not.toMatch(/checkoutState\s*===\s*"success"[\s\S]{0,400}setState\([^)]*entitlement/i);

    const service = read("src", "lib", "services", "tayqan-stripe-fulfillment-service.ts");
    expect(service).toContain("applyTayqanCheckoutSession");
    expect(service).toContain('session.payment_status === "paid"');
  });
});

describe("TAYQAN-HIRE-1 intake question engine", () => {
  it("asks the project category before the assignment brief", () => {
    expect(
      deriveTayqanQuestion(
        BASE_SNAPSHOT,
        BASE_SESSION,
      )?.key,
    ).toBe("project_category");
  });

  it("asks a category-specific scope before the desired deliverable", () => {
    const question =
      deriveTayqanQuestion(
        BASE_SNAPSHOT,
        BASE_SESSION,
        {
          projectCategory: "MEP_SERVICES",
          categoryScope: null,
        },
      );

    expect(question?.key).toBe(
      "category_scope",
    );

    expect(
      question?.options?.map(
        (option) => option.value,
      ),
    ).toEqual([
      "FULL_MEP",
      "HVAC",
      "ELECTRICAL_ELV",
      "PLUMBING_FIRE",
    ]);
  });

  it("asks the desired deliverable after category and scope are known", () => {
    expect(
      deriveTayqanQuestion(
        BASE_SNAPSHOT,
        BASE_SESSION,
        BASE_CONTEXT,
      )?.key,
    ).toBe("desired_deliverable");
  });

  it("persists category answers in the existing intake conversation instead of adding schema fields", () => {
    expect(
      deriveTayqanIntakeConversationContext([
        {
          message: "MEP_SERVICES",
          structuredDataJson: {
            kind: "ANSWER",
            questionKey: "project_category",
          },
        },
        {
          message: "FULL_MEP",
          structuredDataJson: {
            kind: "ANSWER",
            questionKey: "category_scope",
          },
        },
      ]),
    ).toEqual({
      projectCategory: "MEP_SERVICES",
      categoryScope: "FULL_MEP",
    });
  });

  it("asks for project sources before technical questions when full BOQ work has no files", () => {
    const session = {
      ...BASE_SESSION,
      desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
    };
    expect(deriveTayqanQuestion(BASE_SNAPSHOT, session, BASE_CONTEXT)?.key).toBe("upload_sources");
  });

  it("surfaces real drawing revision ambiguity before asking generic measurement questions", () => {
    const snapshot: TayqanProjectSnapshot = {
      ...BASE_SNAPSHOT,
      files: [
        {
          id: "a",
          originalName: "A-104.pdf",
          extension: ".pdf",
          classification: "ARCHITECTURAL_PLAN",
          status: "CLASSIFIED",
          drawingNumber: "A-104",
          drawingTitle: null,
          revisionNumber: "B",
          measurementUnit: null,
        },
        {
          id: "b",
          originalName: "A-104-C.pdf",
          extension: ".pdf",
          classification: "ARCHITECTURAL_PLAN",
          status: "CLASSIFIED",
          drawingNumber: "A-104",
          drawingTitle: null,
          revisionNumber: "C",
          measurementUnit: null,
        },
      ],
      ambiguousDrawingGroups: [
        { drawingNumber: "A-104", revisions: ["B", "C"], fileIds: ["a", "b"] },
      ],
    };
    const session = {
      ...BASE_SESSION,
      desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
    };
    expect(deriveTayqanQuestion(snapshot, session, BASE_CONTEXT)?.key).toBe("authoritative_sources");
  });

  it("does not re-ask fields already answered", () => {
    const snapshot: TayqanProjectSnapshot = {
      ...BASE_SNAPSHOT,
      files: [
        {
          id: "a",
          originalName: "schedule.xlsx",
          extension: ".xlsx",
          classification: "MATERIAL_SCHEDULE",
          status: "CLASSIFIED",
          drawingNumber: null,
          drawingTitle: null,
          revisionNumber: null,
          measurementUnit: null,
        },
      ],
    };
    const session = {
      ...BASE_SESSION,
      desiredDeliverable: "COMPLETE_BOQ_FROM_SOURCES",
      measurementStandard: "NRM",
      includeRates: false,
      exclusions: "None",
      deadlineText: "No fixed deadline",
      specialInstructions: "None",
      authoritativeSourcePolicy: "USE_LATEST_REVISION",
    };
    expect(deriveTayqanQuestion(snapshot, session, BASE_CONTEXT)).toBeNull();
  });
});

describe("TAYQAN-HIRE-1 worker gate", () => {
  it("protects the existing worker review POST with paid TAYQAN intake authorization", () => {
    const route = read("src", "app", "api", "boqs", "[boqId]", "worker", "review", "route.ts");
    expect(route).toContain("assertPaidTayqanReviewAccess");
    expect(route).toContain("markPaidTayqanReviewStarted");
  });

  it("keeps the existing REVIEW_EXISTING_BOQ worker implementation rather than replacing it with a fake autonomous engine", () => {
    const runner = read("src", "lib", "services", "worker-runner-service.ts");
    expect(runner).toContain("reviewExistingBOQ");
    expect(runner).toContain("WorkerAssignmentType.REVIEW_EXISTING_BOQ");
  });
});

describe("TAYQAN-HIRE-1 voice intake integration", () => {
  it("reuses Quantara transcription and converges on the existing intake answer path", () => {
    const ui = read(
      "src",
      "components",
      "tayqan",
      "tayqan-hire-experience.tsx",
    );

    expect(ui).toContain(
      "/voice/transcribe",
    );

    expect(ui).toContain(
      "@/components/voice/voice-command-button",
    );

    expect(ui).toContain(
      "resolveTayqanVoiceChoice",
    );

    expect(ui).toContain(
      "await submitAnswer(",
    );

    expect(ui).toContain(
      "setAnswer(transcript)",
    );

    expect(ui).not.toContain(
      "/voice/propose",
    );

    expect(ui).not.toContain(
      "/voice/apply",
    );
  });
});

describe("TAYQAN Commerce catalogue and Marketplace", () => {
  it("defines TAYQAN as ordinary CommerceProduct entries in the authoritative commerce seed", () => {
    const seed = read(
      "prisma",
      "seed-data",
      "commerce-products.ts",
    );

    expect(seed).toContain('code: "tayqan_day"');
    expect(seed).toContain('code: "tayqan_day_299"');
    expect(seed).toContain("amountMinor: 29900");

    expect(seed).toContain('code: "tayqan_week"');
    expect(seed).toContain('code: "tayqan_week_999"');
    expect(seed).toContain("amountMinor: 99900");

    expect(seed).toContain('code: "tayqan_monthly"');
    expect(seed).toContain('code: "tayqan_monthly_2499"');
    expect(seed).toContain("amountMinor: 249900");

    expect(seed).toContain('billingInterval: "ONE_TIME"');
    expect(seed).toContain('billingInterval: "MONTH"');
  });

  it("shows TAYQAN in Marketplace from the public CommerceProduct API instead of inventing a Stripe product path", () => {
    const marketplace = read(
      "src",
      "app",
      "marketplace",
      "page.tsx",
    );

    expect(marketplace).toContain(
      '"/api/commerce/products"',
    );

    expect(marketplace).toContain(
      "TAYQAN_PRODUCT_CODES",
    );

    expect(marketplace).toContain(
      '"tayqan_day"',
    );

    expect(marketplace).toContain(
      '"tayqan_week"',
    );

    expect(marketplace).toContain(
      '"tayqan_monthly"',
    );

    expect(marketplace).toContain(
      'href="/projects?tayqan=assign"',
    );

    expect(marketplace).toContain(
      "Up to 2 distinct projects per 24-hour hire",
    );

    expect(marketplace).not.toContain(
      "stripe.products.create",
    );

    expect(marketplace).not.toContain(
      "stripe.prices.create",
    );
  });

  it("shows explicit TAYQAN project assignment, admin-free access, and Day quota state in the UI", () => {
    const projects = read(
      "src",
      "app",
      "projects",
      "page.tsx",
    );

    const hireUi = read(
      "src",
      "components",
      "tayqan",
      "tayqan-hire-experience.tsx",
    );

    expect(projects).toContain(
      "tayqanAssignmentMode",
    );

    expect(projects).toContain(
      `href={\`/projects/\${project.id}/tayqan\`}`,
    );

    expect(projects).toContain(
      '"tayqan.assignProjectCta"',
    );

    expect(hireUi).toContain(
      'state.accessMode ===',
    );

    expect(hireUi).toContain(
      '"INTERNAL_ADMIN"',
    );

    expect(hireUi).toContain(
      "state.projectQuota",
    );

    expect(hireUi).toContain(
      '"tayqan.hire.projectUsage"',
    );

    expect(hireUi).toContain(
      '"tayqan.hire.projectLimitReachedTitle"',
    );

    expect(hireUi).toContain(
      "plan.maxDistinctProjects",
    );
  });
});
