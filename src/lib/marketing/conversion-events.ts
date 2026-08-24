export type ConversionEventName =
  | "pricing_plan_selected"
  | "registration_started"
  | "registration_completed"
  | "email_verified"
  | "login_completed"
  | "first_project_created"
  | "first_boq_created"
  | "first_export_generated"
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

/**
 * Records a first-value milestone once per browser without attaching account,
 * project, BOQ or document identifiers to analytics. If browser storage is
 * unavailable, the event is still emitted so privacy settings never break the
 * product workflow.
 */
export function trackFirstConversionEvent(
  event: ConversionEventName,
  parameters: ConversionEventParameters = {},
): boolean {
  if (typeof window === "undefined") return false;

  const storageKey = `quantara:conversion:first:${event}`;
  try {
    if (window.localStorage?.getItem(storageKey) === "1") return false;
  } catch {
    // Storage can be unavailable in strict privacy modes; analytics remains best-effort.
  }

  trackConversionEvent(event, parameters);

  try {
    window.localStorage?.setItem(storageKey, "1");
  } catch {
    // Never let analytics persistence interfere with a successful export.
  }
  return true;
}
