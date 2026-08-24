export type BOQFinalizationReason =
  | "BOQ_LOCKED"
  | "VERIFICATION_REQUIRED"
  | "VERIFICATION_STALE"
  | "UNRESOLVED_CRITICAL_EXCEPTIONS"
  | "ESTIMATE_INTEGRITY_REQUIRED";

export type BOQFinalizationGate = {
  lockEligible: boolean;
  lockReason: BOQFinalizationReason | null;
  freshlyVerified: boolean;
  unresolvedCritical: number;
  unconfirmedItemCount: number;
};

type FinalizationItem = {
  status?: string | null;
  quantityConfirmed: boolean;
  rateConfirmed: boolean;
};

export function evaluateBOQFinalizationGate(input: {
  isLocked: boolean;
  version: number;
  verifiedVersion: number | null;
  verifiedAt: Date | string | null;
  unresolvedCritical: number;
  items?: FinalizationItem[];
}): BOQFinalizationGate {
  const freshlyVerified = input.verifiedAt !== null && input.verifiedVersion === input.version;
  const unconfirmedItemCount = (input.items ?? []).filter(
    (item) => item.status?.toUpperCase() !== "REJECTED" && (!item.quantityConfirmed || !item.rateConfirmed),
  ).length;
  const lockReason: BOQFinalizationReason | null = input.isLocked
    ? "BOQ_LOCKED"
    : input.verifiedAt === null || input.verifiedVersion === null
      ? "VERIFICATION_REQUIRED"
      : !freshlyVerified
        ? "VERIFICATION_STALE"
        : input.unresolvedCritical > 0
          ? "UNRESOLVED_CRITICAL_EXCEPTIONS"
          : unconfirmedItemCount > 0
            ? "ESTIMATE_INTEGRITY_REQUIRED"
            : null;

  return { lockEligible: lockReason === null, lockReason, freshlyVerified, unresolvedCritical: input.unresolvedCritical, unconfirmedItemCount };
}
