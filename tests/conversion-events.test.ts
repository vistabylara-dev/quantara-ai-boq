import { afterEach, describe, expect, it, vi } from "vitest";
import { trackConversionEvent } from "../src/lib/marketing/conversion-events";

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
});
