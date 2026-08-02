export type TenantOwnedRecord = {
  companyId: string;
};

export class InvalidTenantScopeError extends Error {
  readonly code = "INVALID_TENANT_SCOPE";
  readonly statusCode = 400;

  constructor() {
    super("A valid companyId is required for this operation.");
    this.name = "InvalidTenantScopeError";
  }
}

export class TenantAccessError extends Error {
  readonly code = "FORBIDDEN_COMPANY_ACCESS";
  readonly statusCode = 403;

  constructor() {
    super("The requested record does not belong to the active company.");
    this.name = "TenantAccessError";
  }
}

export function requireCompanyId(companyId: string): string {
  const normalized = companyId.trim();
  if (!normalized) {
    throw new InvalidTenantScopeError();
  }
  return normalized;
}

export function tenantScope<T extends Record<string, unknown>>(
  companyId: string,
  where?: T,
): T & { companyId: string } {
  return {
    ...(where ?? ({} as T)),
    companyId: requireCompanyId(companyId),
  };
}

export const tenantWhere = tenantScope;

export function tenantCreateData<T extends Record<string, unknown>>(
  companyId: string,
  data: T,
): T & { companyId: string } {
  return {
    ...data,
    companyId: requireCompanyId(companyId),
  };
}

export function isTenantRecord(record: TenantOwnedRecord, companyId: string): boolean {
  return record.companyId === requireCompanyId(companyId);
}

export function assertTenantAccess<T extends TenantOwnedRecord>(record: T, companyId: string): T {
  if (!isTenantRecord(record, companyId)) {
    throw new TenantAccessError();
  }
  return record;
}

export function filterByTenant<T extends TenantOwnedRecord>(records: T[], companyId: string): T[] {
  const tenantId = requireCompanyId(companyId);
  return records.filter((record) => record.companyId === tenantId);
}
