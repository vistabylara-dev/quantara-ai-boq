/**
 * TEMPORARY PHASE 1 TENANCY BRIDGE.
 *
 * Authentication will eventually supply the current company ID. Until then,
 * every backend query must call this helper instead of duplicating a tenant ID.
 */
const DEVELOPMENT_COMPANY_ID = "00000000-0000-4000-8000-000000000001";

export function getDevelopmentCompanyId(): string {
  return DEVELOPMENT_COMPANY_ID;
}
