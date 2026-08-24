export type ConversionEventName =
  | "pricing_plan_selected"
  | "registration_started"
  | "registration_completed"
  | "email_verified"
  | "login_completed"
  | "first_project_created"
  | "first_boq_created"
  | "sales_lead_submitted";

type ConversionEventParameters = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

/**
 * Sends anonymous funnel milestones to the existing GTM data layer.
 * Google Consent Mode remains the collection gate: analytics storage is denied
 * until the visitor explicitly allows it, and no form values or account IDs are sent.
 */
export function trackConversionEvent(
  event: ConversionEventName,
  parameters: ConversionEventParameters = {},
): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event,
    ...Object.fromEntries(
      Object.entries(parameters).filter(([, value]) => value !== undefined),
    ),
  });
}
