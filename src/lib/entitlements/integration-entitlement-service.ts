import type { PlanType } from "@prisma/client";
import { getEffectiveEntitlements } from "./effective-entitlement-service";
import type { CurrentActor } from "@/lib/auth/current-actor";

/**
 * INTEGRATIONS-1A — centralized plan-tier -> integration-capability mapping
 * (spec: "Do not hardcode plan names throughout connector components").
 * Nothing in this phase actually enforces these limits yet (no connector can
 * connect), but the marketplace UI displays them, and every future connect/
 * sync route in 1B+ should call this instead of checking planType directly.
 * Reuses getEffectiveEntitlements so PLATFORM_OWNER gets unrestricted access
 * and can simulate a customer plan (spec: "PLATFORM_OWNER: full integration
 * testing access, can simulate customer plans"), exactly like every other
 * entitlement-gated feature in the app.
 */

export type IntegrationEntitlements = {
  source: "real" | "owner-override" | "simulation";
  planType: PlanType;
  maxActiveConnections: number | null;
  allowedProviderFamilies: string[] | "all";
  manualSync: boolean;
  scheduledSync: boolean;
  bulkExtraction: boolean;
  advancedModelData: boolean;
  desktopPlugin: boolean;
  teamConnections: boolean;
  apiWebhookAccess: boolean;
};

const TRIAL_ALLOWED_FAMILIES = ["microsoft", "google"];
const PRO_ALLOWED_FAMILIES = ["trimble", "procore", "bentley", "bluebeam", "microsoft", "google", "dropbox", "box", "archicad"];
const BUSINESS_ALLOWED_FAMILIES = ["autodesk", ...PRO_ALLOWED_FAMILIES];

function forPlan(planType: PlanType): Omit<IntegrationEntitlements, "source" | "planType"> {
  switch (planType) {
    case "TRIAL":
      return {
        maxActiveConnections: 1,
        allowedProviderFamilies: TRIAL_ALLOWED_FAMILIES,
        manualSync: true,
        scheduledSync: false,
        bulkExtraction: false,
        advancedModelData: false,
        desktopPlugin: false,
        teamConnections: false,
        apiWebhookAccess: false,
      };
    case "PRO":
      return {
        maxActiveConnections: 5,
        allowedProviderFamilies: PRO_ALLOWED_FAMILIES,
        manualSync: true,
        scheduledSync: false,
        bulkExtraction: false,
        advancedModelData: false,
        desktopPlugin: true,
        teamConnections: false,
        apiWebhookAccess: false,
      };
    case "BUSINESS":
      return {
        maxActiveConnections: 15,
        allowedProviderFamilies: BUSINESS_ALLOWED_FAMILIES,
        manualSync: true,
        scheduledSync: true,
        bulkExtraction: false,
        advancedModelData: true,
        desktopPlugin: true,
        teamConnections: true,
        apiWebhookAccess: false,
      };
    case "ENTERPRISE":
      return {
        maxActiveConnections: null,
        allowedProviderFamilies: "all",
        manualSync: true,
        scheduledSync: true,
        bulkExtraction: true,
        advancedModelData: true,
        desktopPlugin: true,
        teamConnections: true,
        apiWebhookAccess: true,
      };
    case "FREE":
    default:
      return {
        maxActiveConnections: 1,
        allowedProviderFamilies: ["google"],
        manualSync: true,
        scheduledSync: false,
        bulkExtraction: false,
        advancedModelData: false,
        desktopPlugin: false,
        teamConnections: false,
        apiWebhookAccess: false,
      };
  }
}

export async function getIntegrationEntitlements(actor: Pick<CurrentActor, "userId" | "companyId">): Promise<IntegrationEntitlements> {
  const effective = await getEffectiveEntitlements(actor);

  if (effective.source === "owner-override") {
    return {
      source: "owner-override",
      planType: effective.planType,
      maxActiveConnections: null,
      allowedProviderFamilies: "all",
      manualSync: true,
      scheduledSync: true,
      bulkExtraction: true,
      advancedModelData: true,
      desktopPlugin: true,
      teamConnections: true,
      apiWebhookAccess: true,
    };
  }

  return { source: effective.source, planType: effective.planType, ...forPlan(effective.planType) };
}
