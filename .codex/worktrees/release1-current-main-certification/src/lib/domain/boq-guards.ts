export type LockProtectedBOQ = {
  id?: string;
  isLocked?: boolean | null;
  status?: string | null;
};

const READ_ONLY_STATUSES = new Set(["LOCKED", "ISSUED", "APPROVED"]);

export class LockedBOQError extends Error {
  readonly code = "BOQ_LOCKED";
  readonly statusCode = 409;

  constructor(readonly boqId?: string, readonly operation = "edit") {
    super(`BOQ${boqId ? ` ${boqId}` : ""} is locked and cannot be ${operation}ed.`);
    this.name = "LockedBOQError";
  }
}

export class BOQLockBlockedError extends Error {
  readonly code = "BOQ_LOCK_BLOCKED";
  readonly statusCode = 409;

  constructor(readonly unresolvedCriticalCount: number) {
    super(`BOQ cannot be locked while ${unresolvedCriticalCount} critical verification exception(s) remain unresolved.`);
    this.name = "BOQLockBlockedError";
  }
}

export function isBOQLocked(boq: LockProtectedBOQ): boolean {
  return Boolean(boq.isLocked) || READ_ONLY_STATUSES.has(boq.status?.toUpperCase() ?? "");
}

export function assertBOQEditable<T extends LockProtectedBOQ>(boq: T, operation = "edit"): T {
  if (isBOQLocked(boq)) {
    throw new LockedBOQError(boq.id, operation);
  }
  return boq;
}

export type VerificationLockState = {
  severity: string;
  resolved?: boolean | null;
};

export function countUnresolvedCriticalExceptions(exceptions: VerificationLockState[]): number {
  return exceptions.filter(
    (exception) => exception.severity.toUpperCase() === "CRITICAL" && exception.resolved !== true,
  ).length;
}

export function assertBOQCanBeLocked(exceptions: VerificationLockState[]): void {
  const unresolvedCriticalCount = countUnresolvedCriticalExceptions(exceptions);
  if (unresolvedCriticalCount > 0) {
    throw new BOQLockBlockedError(unresolvedCriticalCount);
  }
}
