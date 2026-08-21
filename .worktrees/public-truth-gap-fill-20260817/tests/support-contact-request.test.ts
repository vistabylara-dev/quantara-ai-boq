import { describe, expect, it } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import {
  buildSalesInquiryWrite,
  contactRequestSchema,
  salesContactRequestSchema,
  supportContactRequestSchema,
} from "@/lib/support/contact-request";

const validSupportRequest = {
  kind: "SUPPORT" as const,
  requestType: "FEATURE" as const,
  title: "Add a review comparison",
  description: "Let reviewers compare the current BOQ with its previous revision.",
  goal: "Approve changed quantities without leaving the review screen.",
  email: "reviewer@example.com",
  company: "Example QS",
  consent: true as const,
  context: {
    currentRoute: "/projects/project-123/boq",
    surface: "SAAS" as const,
    locale: "en" as const,
  },
  website: "" as const,
};

const validSalesRequest = {
  kind: "SALES" as const,
  fullName: "Amina Rahman",
  businessEmail: "amina@example.com",
  companyName: "Example Contracting",
  country: "United Arab Emirates",
  role: "Commercial Manager",
  companyType: "Main contractor",
  constructionDiscipline: "General construction",
  monthlyVolume: "20 BOQs",
  currentBoqProcess: "Reviewed spreadsheets",
  requiredInputs: "Text PDFs and XLSX",
  requiredOutputs: "Reviewed BOQ documents",
  numberOfUsers: "12",
  preferredContactMethod: "Email" as const,
  message: "We need to discuss onboarding and recurring subscription eligibility.",
  consent: true as const,
  website: "" as const,
};

const actor: CurrentActor = {
  userId: "server-user-123",
  companyId: "server-company-456",
  role: "COMPANY_OWNER",
  fullName: "Noura Al Mansoori",
  email: "noura@example.com",
};

describe("contact request schemas", () => {
  it("accepts only the exact support and sales request shapes", () => {
    expect(supportContactRequestSchema.parse(validSupportRequest)).toEqual(validSupportRequest);
    expect(salesContactRequestSchema.parse(validSalesRequest)).toEqual(validSalesRequest);
    expect(contactRequestSchema.parse(validSupportRequest).kind).toBe("SUPPORT");
    expect(contactRequestSchema.parse(validSalesRequest).kind).toBe("SALES");

    expect(
      supportContactRequestSchema.safeParse({ ...validSupportRequest, unexpected: "field" }).success,
    ).toBe(false);
    expect(
      salesContactRequestSchema.safeParse({ ...validSalesRequest, unexpected: "field" }).success,
    ).toBe(false);
    expect(
      contactRequestSchema.safeParse({ ...validSalesRequest, context: validSupportRequest.context }).success,
    ).toBe(false);
  });

  it("enforces trimmed required values, field bounds, email validity, consent and the honeypot", () => {
    const rejectedSupportOverrides: Array<Record<string, unknown>> = [
      { title: "   " },
      { title: "x".repeat(161) },
      { description: "x".repeat(4_001) },
      { goal: "x".repeat(2_001) },
      { email: "not-an-email" },
      { email: `${"x".repeat(245)}@example.com` },
      { company: "x".repeat(256) },
      { consent: false },
      { website: "bot-filled" },
      { requestType: "SECURITY" },
    ];

    for (const override of rejectedSupportOverrides) {
      expect(
        supportContactRequestSchema.safeParse({ ...validSupportRequest, ...override }).success,
        JSON.stringify(override),
      ).toBe(false);
    }

    expect(
      supportContactRequestSchema.safeParse({
        ...validSupportRequest,
        title: "x".repeat(160),
        description: "x".repeat(4_000),
        goal: "x".repeat(2_000),
        company: "x".repeat(255),
      }).success,
    ).toBe(true);

    expect(salesContactRequestSchema.safeParse({ ...validSalesRequest, fullName: " " }).success).toBe(false);
    expect(salesContactRequestSchema.safeParse({ ...validSalesRequest, consent: false }).success).toBe(false);
    expect(salesContactRequestSchema.safeParse({ ...validSalesRequest, website: "spam" }).success).toBe(false);

    const boundedSalesFields: Array<readonly [keyof typeof validSalesRequest, number]> = [
      ["fullName", 160],
      ["businessEmail", 254],
      ["companyName", 255],
      ["country", 120],
      ["role", 160],
      ["companyType", 160],
      ["constructionDiscipline", 160],
      ["monthlyVolume", 120],
      ["currentBoqProcess", 1_000],
      ["requiredInputs", 1_000],
      ["requiredOutputs", 1_000],
      ["numberOfUsers", 120],
      ["message", 4_000],
    ];
    for (const [field, maximum] of boundedSalesFields) {
      const tooLong = field === "businessEmail"
        ? `${"x".repeat(maximum + 1 - "@example.com".length)}@example.com`
        : "x".repeat(maximum + 1);
      expect(
        salesContactRequestSchema.safeParse({ ...validSalesRequest, [field]: tooLong }).success,
        field,
      ).toBe(false);
    }
    expect(
      salesContactRequestSchema.safeParse({
        ...validSalesRequest,
        preferredContactMethod: "Signal",
      }).success,
    ).toBe(false);
  });

  it("accepts pathname-only context and rejects query strings, fragments and unsafe route forms", () => {
    const unsafeRoutes = [
      "dashboard",
      "//attacker.example/path",
      "/dashboard?token=secret",
      "/dashboard#private",
      "/dashboard\nnext",
      `/${"x".repeat(512)}`,
    ];

    for (const currentRoute of unsafeRoutes) {
      expect(
        supportContactRequestSchema.safeParse({
          ...validSupportRequest,
          context: { ...validSupportRequest.context, currentRoute },
        }).success,
        currentRoute,
      ).toBe(false);
    }

    expect(
      supportContactRequestSchema.safeParse({
        ...validSupportRequest,
        context: { ...validSupportRequest.context, currentRoute: "/" },
      }).success,
    ).toBe(true);
  });

  it("rejects client-supplied identifiers, timestamps, tokens, cookies and project context", () => {
    const forbiddenTopLevelFields = [
      "userId",
      "companyId",
      "submittedAt",
      "token",
      "cookie",
      "projectId",
      "boqId",
      "fileId",
      "rateId",
    ];

    for (const field of forbiddenTopLevelFields) {
      expect(
        supportContactRequestSchema.safeParse({ ...validSupportRequest, [field]: "client-value" }).success,
        field,
      ).toBe(false);
    }

    for (const field of forbiddenTopLevelFields) {
      expect(
        supportContactRequestSchema.safeParse({
          ...validSupportRequest,
          context: { ...validSupportRequest.context, [field]: "client-value" },
        }).success,
        `context.${field}`,
      ).toBe(false);
    }

    expect(
      supportContactRequestSchema.safeParse({
        ...validSupportRequest,
        context: { ...validSupportRequest.context, locale: "fr" },
      }).success,
    ).toBe(false);
    expect(
      supportContactRequestSchema.safeParse({
        ...validSupportRequest,
        context: { ...validSupportRequest.context, surface: "ADMIN" },
      }).success,
    ).toBe(false);
  });
});

describe("support request persistence mapping", () => {
  it("maps the safe allowlist and adds actor IDs and timestamp only from server arguments", () => {
    const parsed = supportContactRequestSchema.parse(validSupportRequest);
    const submittedAt = new Date("2026-08-13T04:05:06.000Z");
    const write = buildSalesInquiryWrite(parsed, actor, submittedAt);
    const details = JSON.parse(write.integrationRequirements ?? "null") as Record<string, unknown>;

    expect(write).toMatchObject({
      firstName: "Noura",
      lastName: "Al Mansoori",
      workEmail: validSupportRequest.email,
      companySize: validSupportRequest.company,
      useCase: `[FEATURE] ${validSupportRequest.title}`,
      preferredContactMethod: "Email",
      consent: true,
      deliveryStatus: "stored",
    });
    expect(Object.keys(details).sort()).toEqual(["company", "context", "description", "goal", "kind"]);
    expect(details).toEqual({
      kind: "SUPPORT",
      description: validSupportRequest.description,
      goal: validSupportRequest.goal,
      company: validSupportRequest.company,
      context: {
        currentRoute: validSupportRequest.context.currentRoute,
        surface: validSupportRequest.context.surface,
        locale: validSupportRequest.context.locale,
        submittedAt: submittedAt.toISOString(),
        userId: actor.userId,
        companyId: actor.companyId,
      },
    });
  });

  it("uses null server actor IDs for a public request and never invents client identity", () => {
    const parsed = supportContactRequestSchema.parse({
      ...validSupportRequest,
      context: { currentRoute: "/", surface: "PUBLIC", locale: "ar" },
      company: "",
    });
    const submittedAt = new Date("2026-08-13T05:00:00.000Z");
    const write = buildSalesInquiryWrite(parsed, null, submittedAt);
    const details = JSON.parse(write.integrationRequirements ?? "null") as {
      context: Record<string, unknown>;
    };

    expect(write.firstName).toBe("Support");
    expect(write.lastName).toBe("Requester");
    expect(write.companySize).toBe("Not provided");
    expect(details.context).toEqual({
      currentRoute: "/",
      surface: "PUBLIC",
      locale: "ar",
      submittedAt: submittedAt.toISOString(),
      userId: null,
      companyId: null,
    });
  });

  it("keeps the legacy sales mapping bounded to the validated sales request", () => {
    const parsed = salesContactRequestSchema.parse(validSalesRequest);
    const write = buildSalesInquiryWrite(parsed, actor);
    const details = JSON.parse(write.integrationRequirements ?? "null");

    expect(write.firstName).toBe("Amina");
    expect(write.lastName).toBe("Rahman");
    expect(write.workEmail).toBe(validSalesRequest.businessEmail);
    expect(details).toEqual({
      kind: "SALES",
      companyName: validSalesRequest.companyName,
      country: validSalesRequest.country,
      role: validSalesRequest.role,
      message: validSalesRequest.message,
    });
    expect(JSON.stringify(details)).not.toContain(actor.userId);
    expect(JSON.stringify(details)).not.toContain(actor.companyId);
  });
});
