"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import { useTranslations } from "@/lib/i18n/locale-provider";

/**
 * REFUND-15 — customer-facing refund request UI. Unlike the rest of
 * /settings/subscription (frozen, hardcoded English — see the "FROZEN
 * SURFACES" note in dictionaries/en.ts), this new component is wired
 * through the real i18n system end to end, since it's new surface, not a
 * rewrite of the frozen page.
 *
 * Never shows "Refunded" until the request's own status says SUCCEEDED —
 * that status only ever changes server-side (owner approval + Stripe
 * confirmation, or the charge.refunded webhook reconciling an async
 * success), never optimistically here.
 *
 * REFUND-20 — the eligibility deadline shown here is always the server's
 * own calculation (GET /api/commerce/refunds/eligibility, itself derived
 * from Stripe Charge.created — see refund-request-service.ts). This
 * component never computes or trusts a client-side deadline.
 */

type RefundRequestStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

type RefundRequestRecord = {
  id: string;
  originalAmountMinor: number;
  currency: string;
  reason: string;
  status: RefundRequestStatus;
  rejectionReason: string | null;
  createdAt: string;
};

type RefundEligibility =
  | { eligible: true; deadline: string; successfulPaymentAt: string }
  | { eligible: false; deadline: string | null; reason: "NO_SUBSCRIPTION" | "NO_PAYMENT" | "ALREADY_REFUNDED" | "WINDOW_EXPIRED" | "ALREADY_REQUESTED" };

function formatMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function RefundRequestPanel({ planName, hasActiveSubscription }: { planName: string; hasActiveSubscription: boolean }) {
  const t = useTranslations();
  const [requests, setRequests] = useState<RefundRequestRecord[] | null>(null);
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [requestsResult, eligibilityResult] = await Promise.all([
        apiClient.get<RefundRequestRecord[]>("/api/commerce/refunds", signal),
        apiClient.get<RefundEligibility>("/api/commerce/refunds/eligibility", signal).then(
          (value) => value,
          () => null,
        ),
      ]);
      setRequests(requestsResult);
      setEligibility(eligibilityResult);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Non-fatal: the rest of the subscription page must still render.
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!hasActiveSubscription || requests === null) return null;

  const openRequest = requests.find((r) => r.status === "REQUESTED" || r.status === "APPROVED" || r.status === "PROCESSING");
  const mostRecent = requests[0] ?? null;

  const statusLabel = (status: RefundRequestStatus): string => {
    switch (status) {
      case "REQUESTED":
        return t("commercial.refundStatusRequested");
      case "APPROVED":
        return t("commercial.refundStatusApproved");
      case "REJECTED":
        return t("commercial.refundStatusRejected");
      case "PROCESSING":
        return t("commercial.refundStatusProcessing");
      case "SUCCEEDED":
        return t("commercial.refundStatusSucceeded");
      case "FAILED":
        return t("commercial.refundStatusFailed");
    }
  };

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/commerce/refunds/request", { reason: reason.trim() });
      setReason("");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const windowExpired = eligibility && !eligibility.eligible && eligibility.reason === "WINDOW_EXPIRED";
  // Only offer the form when the server says this exact payment is eligible
  // right now — never render an enabled button off a stale/optimistic guess.
  const canSubmitNewRequest = !openRequest && eligibility?.eligible === true;

  return (
    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-sm font-semibold text-white">{t("commercial.requestRefund")}</h3>

      {mostRecent && (
        <div className="mt-3 space-y-1 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
          <p>
            <span className="text-slate-500">{t("commercial.refundPlanLabel")}: </span>
            <span className="text-slate-200">{planName}</span>
          </p>
          <p>
            <span className="text-slate-500">{t("commercial.refundAmountLabel")}: </span>
            <span className="text-slate-200">{formatMoney(mostRecent.originalAmountMinor, mostRecent.currency)}</span>
          </p>
          <p>
            <span className="text-slate-500">{t("commercial.refundDateLabel")}: </span>
            <span className="text-slate-200">{formatDate(mostRecent.createdAt)}</span>
          </p>
          <p>
            <span className="text-slate-500">{t("commercial.refundStatusLabel")}: </span>
            <span className="text-slate-200">{statusLabel(mostRecent.status)}</span>
          </p>
          {mostRecent.status === "REJECTED" && mostRecent.rejectionReason && (
            <p className="text-rose-300">{mostRecent.rejectionReason}</p>
          )}
        </div>
      )}

      {openRequest ? (
        <p className="mt-3 rounded-2xl border border-amber-900 bg-amber-950/20 px-4 py-2 text-xs text-amber-300">
          {t("commercial.refundRequestedPendingReview")}
        </p>
      ) : windowExpired ? (
        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
          <p>{t("commercial.refundPeriodExpired")}</p>
          <p className="mt-1">{t("commercial.refundContactSupport")}</p>
        </div>
      ) : eligibility?.eligible ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">
            {t("commercial.refundAvailableUntil")}: <span className="text-slate-300">{formatDateTime(eligibility.deadline)}</span>
          </p>
          <label className="block text-xs text-slate-500" htmlFor="refund-reason">
            {t("commercial.refundReasonLabel")}
          </label>
          <textarea
            id="refund-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("commercial.refundReasonPlaceholder")}
            rows={3}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600"
          />
          <p className="text-xs text-slate-500">{t("commercial.refundWarning")}</p>
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !reason.trim() || !canSubmitNewRequest}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? t("commercial.refundSubmitting") : t("commercial.refundSubmit")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default RefundRequestPanel;
