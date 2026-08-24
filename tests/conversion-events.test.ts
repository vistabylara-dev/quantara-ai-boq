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
