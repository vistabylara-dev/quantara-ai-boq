import type { EntitlementTemplateDTO } from "@/lib/repositories/commerce-product-repository";

/**
 * Truthful enforcement status for every EntitlementTemplate field, keyed by
 * DTO field name. This is a fact about what the *application code* currently
 * checks, not about the data — so it lives here as a static map, not as a
 * database column. STRIPE-1A found several of these fields (documented below)
 * have zero enforcing call sites; the admin UI must say so plainly rather
 * than implying a purchase would already gate behavior.
 *
 * Update this map only when you add or remove a real enforcement call site
 * elsewhere in the codebase — never to make a field "look" enforced.
 */
export type EntitlementEnforcementStatus = "enforced" | "not_enforced";

export const ENTITLEMENT_FIELD_ENFORCEMENT: Record<keyof Omit<EntitlementTemplateDTO, "id" | "productId">, {
  status: EntitlementEnforcementStatus;
  note: string;
}> = {
  maxUsers: {
    status: "not_enforced",
    note: "No commerce purchase currently grants this template to a company; company user-seat limits are not wired to CommerceProduct purchases yet.",
  },
  maxWorkspaces: {
    status: "not_enforced",
    note: "Not wired to any purchase or workspace-creation check yet.",
  },
  maxActiveProjects: {
    status: "not_enforced",
    note: "Not wired to any purchase or project-creation check yet.",
  },
  maxBoqGenerationsPerMonth: {
    status: "not_enforced",
    note: "The existing CompanyTrialUsage/SoftwarePlan paths enforce their own separate limits; this template is not yet consulted.",
  },
  maxTechnicalReportsPerMonth: {
    status: "not_enforced",
    note: "Not wired to document-generation limits yet.",
  },
  maxWatermarkFreeExportsPerMonth: {
    status: "not_enforced",
    note: "Not wired to the existing watermark-removal trial logic yet.",
  },
  permittedExportFormats: {
    status: "not_enforced",
    note: "Not consulted by any export route yet.",
  },
  removesWatermark: {
    status: "not_enforced",
    note: "The existing TrialPremiumItemUnlock/watermark logic does not read from EntitlementTemplate.",
  },
  allowsCompanyBranding: {
    status: "not_enforced",
    note: "Not consulted by document generation yet.",
  },
  allowsApiAccess: {
    status: "not_enforced",
    note: "assertFeatureAccess(\"api-access\") exists in the codebase but has zero call sites (confirmed by the STRIPE-1A audit) — this field records a commercial grant only.",
  },
  allowsWhiteLabel: {
    status: "not_enforced",
    note: "Not consulted anywhere yet.",
  },
  industryPackageKeys: {
    status: "not_enforced",
    note: "Real IndustryDataPackage access is still granted only through CompanyPackageSubscription, not through a CommerceProduct purchase.",
  },
  aiCreditsGranted: {
    status: "not_enforced",
    note: "No AI-credit ledger exists yet (explicitly out of scope for STRIPE-1B).",
  },
  downloadLimit: {
    status: "not_enforced",
    note: "No download-metering system consults this field yet.",
  },
  entitlementDurationDays: {
    status: "not_enforced",
    note: "No purchase-fulfilment flow exists yet to start an entitlement window.",
  },
};

/** True only once at least one purchasable field in this codebase actually enforces against the template. */
export const COMMERCE_ENTITLEMENTS_ARE_LIVE = Object.values(ENTITLEMENT_FIELD_ENFORCEMENT).some(
  (entry) => entry.status === "enforced",
);

export function describeEntitlementTemplate(template: EntitlementTemplateDTO) {
  return {
    ...template,
    enforcement: Object.fromEntries(
      (Object.keys(ENTITLEMENT_FIELD_ENFORCEMENT) as Array<keyof typeof ENTITLEMENT_FIELD_ENFORCEMENT>).map((field) => [
        field,
        ENTITLEMENT_FIELD_ENFORCEMENT[field],
      ]),
    ),
    isLive: COMMERCE_ENTITLEMENTS_ARE_LIVE,
  };
}
