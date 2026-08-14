"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

/**
 * REFUND-16 — owner-only refund review/execution UI. Every monetary action
 * (approve+refund, approve+refund+cancel) requires an explicit confirmation
 * dialog before firing — never a bare click. Reject is the only action that
 * doesn't touch Stripe.
 */

type RefundRequestStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

type RefundRequestRow = {
  id: string;
  companyId: string;
  externalSubscriptionId: string;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string;
  stripeChargeId: string | null;
  stripeRefundId: string | null;
  originalAmountMinor: number;
  requestedAmountMinor: number;
  currency: string;
  reason: string;
  status: RefundRequestStatus;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  successfulPaymentAt: string;
  isException: boolean;
  exceptionCategory: "DUPLICATE_CHARGE" | "INCORRECT_BILLING" | "PROVIDER_ERROR" | "LEGAL_REMEDY" | null;
  company: { id: string; legalName: string };
  requestedByUser: { id: string; fullName: string; email: string };
};

const EXCEPTION_CATEGORIES = ["DUPLICATE_CHARGE", "INCORRECT_BILLING", "PROVIDER_ERROR", "LEGAL_REMEDY"] as const;

function formatMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function AdminRefundCentre() {
  const [rows, setRows] = useState<RefundRequestRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});
  const [exceptionCompanyId, setExceptionCompanyId] = useState("");
  const [exceptionCategory, setExceptionCategory] = useState<(typeof EXCEPTION_CATEGORIES)[number]>("DUPLICATE_CHARGE");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionBusy, setExceptionBusy] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [exceptionSuccess, setExceptionSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiClient.get<RefundRequestRow[]>("/api/admin/commerce/refunds");
      setRows(result);
    } catch (error) {
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = useCallback(
    async (id: string, action: "REFUND_ONLY" | "REFUND_AND_CANCEL") => {
      const confirmed = window.confirm(
        action === "REFUND_ONLY"
          ? "Approve and execute this refund now? This creates a real Stripe refund and cannot be undone from here."
          : "Approve, refund, AND cancel this subscription now? This creates a real Stripe refund and cancels the subscription — cannot be undone from here.",
      );
      if (!confirmed) return;

      setBusyId(id);
      setActionError(null);
      try {
        await apiClient.post(`/api/admin/commerce/refunds/${id}/approve`, { action });
        await load();
      } catch (error) {
        setActionError(getApiErrorMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const reject = useCallback(
    async (id: string) => {
      const confirmed = window.confirm("Reject this refund request? No Stripe action will be taken.");
      if (!confirmed) return;

      setBusyId(id);
      setActionError(null);
      try {
        await apiClient.post(`/api/admin/commerce/refunds/${id}/reject`, { reason: rejectReasonById[id]?.trim() || undefined });
        await load();
      } catch (error) {
        setActionError(getApiErrorMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    [load, rejectReasonById],
  );

  const createException = useCallback(async () => {
    if (!exceptionCompanyId.trim() || !exceptionReason.trim()) return;
    const confirmed = window.confirm(
      "Create an exception refund request for this company, bypassing the normal 7-day window? This does NOT refund anything yet — it still requires a separate approval below.",
    );
    if (!confirmed) return;

    setExceptionBusy(true);
    setExceptionError(null);
    setExceptionSuccess(null);
    try {
      await apiClient.post("/api/admin/commerce/refunds/exception", {
        companyId: exceptionCompanyId.trim(),
        category: exceptionCategory,
        reason: exceptionReason.trim(),
      });
      setExceptionCompanyId("");
      setExceptionReason("");
      setExceptionSuccess("Exception request created — still pending approval below.");
      await load();
    } catch (error) {
      setExceptionError(getApiErrorMessage(error));
    } finally {
      setExceptionBusy(false);
    }
  }, [exceptionCompanyId, exceptionCategory, exceptionReason, load]);

  if (loadError) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Refunds unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading refund requests…</p>
      </div>
    );
  }

  const pending = rows.filter((row) => row.status === "REQUESTED");
  const resolved = rows.filter((row) => row.status !== "REQUESTED");

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Commerce</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Refund requests</h1>
        {actionError && (
          <p className="mt-4 rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-xs text-rose-300">{actionError}</p>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Exception request (bypasses the 7-day window)</h2>
        <p className="mt-1 text-sm text-slate-400">
          For duplicate charges, incorrect billing, payment/provider errors, or a legally required consumer remedy. This only
          creates the request — it still requires a separate approval below, exactly like a normal request.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500" htmlFor="exception-company-id">Company ID</label>
            <input
              id="exception-company-id"
              type="text"
              value={exceptionCompanyId}
              onChange={(event) => setExceptionCompanyId(event.target.value)}
              placeholder="Company UUID"
              className="mt-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500" htmlFor="exception-category">Category</label>
            <select
              id="exception-category"
              value={exceptionCategory}
              onChange={(event) => setExceptionCategory(event.target.value as (typeof EXCEPTION_CATEGORIES)[number])}
              className="mt-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            >
              {EXCEPTION_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-slate-500" htmlFor="exception-reason">Reason</label>
            <input
              id="exception-reason"
              type="text"
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
              placeholder="Why this qualifies as an exception"
              className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            />
          </div>
          <button
            type="button"
            disabled={exceptionBusy || !exceptionCompanyId.trim() || !exceptionReason.trim()}
            onClick={() => void createException()}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {exceptionBusy ? "Creating…" : "Create exception request"}
          </button>
        </div>
        {exceptionError && <p className="mt-2 text-xs text-rose-300">{exceptionError}</p>}
        {exceptionSuccess && <p className="mt-2 text-xs text-emerald-300">{exceptionSuccess}</p>}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Pending review ({pending.length})</h2>
        <div className="mt-4 space-y-4">
          {pending.length === 0 && <p className="text-sm text-slate-500">No refund requests are pending review.</p>}
          {pending.map((row) => (
            <div key={row.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {row.company.legalName}
                    {row.isException && (
                      <span className="ml-2 rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Exception: {row.exceptionCategory?.replace(/_/g, " ")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Requested by {row.requestedByUser.fullName} ({row.requestedByUser.email}) on {new Date(row.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">Payment succeeded: {new Date(row.successfulPaymentAt).toLocaleString()}</p>
                </div>
                <p className="text-lg font-semibold text-white">{formatMoney(row.requestedAmountMinor, row.currency)}</p>
              </div>
              <p className="mt-3 text-xs text-slate-500">Subscription: {row.externalSubscriptionId}</p>
              <p className="mt-1 text-xs text-slate-500">Payment: {row.stripePaymentIntentId}{row.stripeInvoiceId ? ` · Invoice: ${row.stripeInvoiceId}` : ""}</p>
              <p className="mt-3 text-sm text-slate-300">{row.reason}</p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void approve(row.id, "REFUND_AND_CANCEL")}
                  title="Recommended default for a subscription refund: refunding without also cancelling leaves the customer paying again next cycle unless they cancel separately."
                  className="rounded-2xl border border-blue-500 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busyId === row.id ? "Working…" : "Refund + cancel subscription (Recommended)"}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void approve(row.id, "REFUND_ONLY")}
                  title="For exceptional billing corrections only (e.g. a duplicate charge) where the subscription itself should keep running."
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  {busyId === row.id ? "Working…" : "Refund only — exceptional billing correction"}
                </button>
                <input
                  type="text"
                  placeholder="Rejection reason (optional)"
                  value={rejectReasonById[row.id] ?? ""}
                  onChange={(event) => setRejectReasonById((prev) => ({ ...prev, [row.id]: event.target.value }))}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                />
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void reject(row.id)}
                  className="rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 disabled:opacity-50"
                >
                  {busyId === row.id ? "Working…" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">History</h2>
        <div className="mt-4 space-y-2">
          {resolved.length === 0 && <p className="text-sm text-slate-500">No resolved refund requests yet.</p>}
          {resolved.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
              <span className="text-slate-200">{row.company.legalName}</span>
              <span>{formatMoney(row.requestedAmountMinor, row.currency)}</span>
              <span>{row.status}</span>
              {row.stripeRefundId && <span>Refund: {row.stripeRefundId}</span>}
              {row.failureMessage && <span className="text-rose-300">{row.failureMessage}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
