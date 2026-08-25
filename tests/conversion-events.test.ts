import { afterEach, describe, expect, it, vi } from "vitest";
import { trackConversionEvent, trackFirstConversionEvent } from "../src/lib/marketing/conversion-events";

describe("conversion events", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pushes anonymous funnel data to the existing GTM data layer", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { dataLayer });

    trackConversionEvent("pricing_plan_selected", {
      plan: "professional",
      billing_cycle: "annual",
      selected_plan_code: "professional_annual_aed_3990",
    });

    expect(dataLayer).toEqual([
      {
        event: "pricing_plan_selected",
        plan: "professional",
        billing_cycle: "annual",
        selected_plan_code: "professional_annual_aed_3990",
      },
    ]);
  });

  it("does nothing during server rendering", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackConversionEvent("registration_started")).not.toThrow();
  });

  it("drops personal, account and commercial identifiers at the data-layer boundary", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { dataLayer });

    trackConversionEvent("first_project_created", {
      industry: "fit-out",
      email: "owner@example.com",
      user_id: "user-secret",
      project_id: "project-secret",
      boq_id: "boq-secret",
      company: "Confidential Company",
      amount: 899,
    });

    expect(dataLayer).toEqual([
      { event: "first_project_created", industry: "fit-out" },
    ]);
    expect(JSON.stringify(dataLayer)).not.toMatch(
      /owner@example|user-secret|project-secret|boq-secret|Confidential|899/,
    );
  });

  it("uses an event-specific anonymous allowlist for every activation milestone", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { dataLayer });

    trackConversionEvent("email_verified", {
      selected_plan_code: "starter_monthly_aed_149",
      token: "verification-secret",
    });
    trackConversionEvent("first_boq_created", {
      source: "project_creation",
      item_count: 85,
    });
    trackConversionEvent("first_export_generated", {
      format: "pdf",
      source: "project_documents",
      document_id: "document-secret",
    });

    expect(dataLayer).toEqual([
      {
        event: "email_verified",
        selected_plan_code: "starter_monthly_aed_149",
      },
      { event: "first_boq_created", source: "project_creation" },
      {
        event: "first_export_generated",
        format: "pdf",
        source: "project_documents",
      },
    ]);
  });

  it("records a first-value event once without sending product identifiers", () => {
    const dataLayer: unknown[] = [];
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      dataLayer,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    expect(trackFirstConversionEvent("first_export_generated", { format: "pdf", source: "project_documents" })).toBe(true);
    expect(trackFirstConversionEvent("first_export_generated", { format: "docx", source: "tayqan_draft_boq" })).toBe(false);
    expect(dataLayer).toEqual([{ event: "first_export_generated", format: "pdf", source: "project_documents" }]);
  });
});
