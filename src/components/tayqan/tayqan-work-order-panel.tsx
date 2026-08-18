"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import { TAYQAN_WORK_STAGE_ORDER } from "@/lib/tayqan/tayqan-workflow-contract";

export type TayqanMeasurementExceptionState = {
  key: string;
  kind: string;
  message: string;
  pageIds: string[];
  waivable: boolean;
  resolution: {
    kind: string;
    action: "WAIVED";
    reason: string;
    actorUserId: string;
    actorName: string;
    resolvedAt: string;
  } | null;
};

export type TayqanWorkOrderState = {
  id: string;
  status: "RUNNING" | "NEEDS_INPUT" | "READY_FOR_ACCEPTANCE" | "COMPLETED" | "FAILED" | "CANCELLED";
  stage: string;
  projectId: string;
  boqId: string | null;
  intakeSessionId: string;
  hireEntitlementId: string;
  desiredDeliverable: string;
  includeRates: boolean;
  pricingBasis: string | null;
  blockerCode: string | null;
  blockerMessage: string | null;
  blocker: {
    kind: "ACTION" | "ENTITY_REVIEW" | "QUANTITY_REQUIRED" | "RATE_REQUIRED" | "QA_QUESTION" | "MEASUREMENT_EXCEPTIONS" | "ERROR";
    i18nKey: string;
    actionHref?: string;
    entity?: { id: string; label: string; quantity: number | null; unit: string | null; sourceReference: string | null; confidence: number };
    qa?: { assignmentId: string; questionId: string; questionType: string; prompt: string; whyMaterial: string; recommendedAction: string };
  } | null;
  qaWorkerRunId: string | null;
  tayqanMeasurement: {
    version: string;
    measuredSubjectCount: number;
    exceptionCount: number;
    resolvedCount: number;
    unresolvedCount: number;
    exceptionRegisterRunId: string;
    exceptionRegisterBatchCount: number;
    exceptionPreviewTruncated: boolean;
    seniorReview: {
      clusterReviewCount: number;
      globalReviewApplied: boolean;
      acceptedSubjectCount: number;
      rejectedSubjectCount: number;
      findingCount: number;
      evidencePageCoveragePercent: number;
    };
    exceptions: TayqanMeasurementExceptionState[];
  } | null;
  startedAt: string;
  lastAdvancedAt: string;
  completedAt: string | null;
  events: Array<{ id: string; stage: string; eventType: string; payload: unknown; createdAt: string }>;
};

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tayqan-work-${Date.now()}`;
}

export function TayqanWorkOrderPanel({
  projectId,
  sessionId,
  initialState,
  onQaStarted,
}: {
  projectId: string;
  sessionId: string;
  initialState?: TayqanWorkOrderState | null;
  onQaStarted?: () => void | Promise<void>;
}) {
  const t = useTranslations();
  const [state, setState] = useState<TayqanWorkOrderState | null>(initialState ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");
  const [resolutionReasons, setResolutionReasons] = useState<Record<string, string>>({});
  const qaNotified = useRef<string | null>(null);
  // Senior QS can outlive the poll interval; never overlap expensive /advance calls.
  const advanceInFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await apiClient.get<TayqanWorkOrderState | null>(
        `/api/projects/${encodeURIComponent(projectId)}/tayqan/work-order?sessionId=${encodeURIComponent(sessionId)}`,
      );
      setState(next);
      setError(null);
      return next;
    } catch (err) {
      setError(getApiErrorMessage(err));
      return null;
    }
  }, [projectId, sessionId]);

  const advance = useCallback(async (workOrderId: string) => {
    try {
      const next = await apiClient.post<TayqanWorkOrderState>(
        `/api/projects/${encodeURIComponent(projectId)}/tayqan/work-order/advance`,
        { workOrderId },
      );
      setState(next);
      setError(null);
      return next;
    } catch (err) {
      setError(getApiErrorMessage(err));
      return null;
    }
  }, [projectId]);

  useEffect(() => { if (!initialState) void load(); }, [initialState, load]);

  useEffect(() => {
    if (!state || state.status !== "RUNNING") return;
    const workOrderId = state.id;
    const timer = window.setInterval(() => {
      if (advanceInFlight.current) return;
      advanceInFlight.current = true;
      void advance(workOrderId).finally(() => {
        advanceInFlight.current = false;
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [state, advance]);

  useEffect(() => {
    if (!state?.qaWorkerRunId || state.qaWorkerRunId === qaNotified.current || !onQaStarted) return;
    qaNotified.current = state.qaWorkerRunId;
    void onQaStarted();
  }, [state?.qaWorkerRunId, onQaStarted]);

  const answer = async (payload: Record<string, unknown>) => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const next = await apiClient.post<TayqanWorkOrderState>(
        `/api/projects/${encodeURIComponent(projectId)}/tayqan/work-order/answer`,
        { workOrderId: state.id, ...payload },
      );
      setState(next);
      setQuantity(""); setUnit(""); setRate(""); setNote(""); setResolutionReasons({});
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return <div className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-400">{error ?? t("tayqan.hire.workflow.loading")}</div>;
  }

  const currentIndex = TAYQAN_WORK_STAGE_ORDER.indexOf(state.stage as (typeof TAYQAN_WORK_STAGE_ORDER)[number]);
  const blocker = state.blocker;

  return (
    <div className="mt-5 space-y-4 rounded-3xl border border-cyan-900 bg-slate-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">{t("tayqan.hire.workflow.title")}</p>
          <p className="mt-1 text-sm text-slate-300">{t(`tayqan.hire.workflow.stage.${state.stage}` as TranslationKey)}</p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{state.status}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {TAYQAN_WORK_STAGE_ORDER.map((stage, index) => (
          <div key={stage} className={[
            "rounded-xl border px-2 py-2 text-center text-[10px]",
            index <= currentIndex ? "border-cyan-700 bg-cyan-950/20 text-cyan-200" : "border-slate-800 text-slate-600",
          ].join(" ")}>
            {t(`tayqan.hire.workflow.stage.${stage}` as TranslationKey)}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {state.status === "RUNNING" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          {t("tayqan.hire.workflow.running")}
        </div>
      )}

      {state.status === "READY_FOR_ACCEPTANCE" && (
        <div className="rounded-2xl border border-emerald-700 bg-emerald-950/20 p-4">
          <p className="font-semibold text-emerald-200">{t("tayqan.hire.workflow.readyForAcceptance")}</p>
          <p className="mt-1 text-sm text-slate-300">{t("tayqan.hire.workflow.acceptanceNote")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {state.boqId && <Link href={`/projects/${encodeURIComponent(projectId)}/boq`} className="inline-block text-sm font-semibold text-cyan-300 underline">{t("tayqan.hire.openBoq")}</Link>}
            <button
              disabled={busy}
              onClick={() => void answer({ action: "ACCEPT_DELIVERABLE" })}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? t("tayqan.hire.workflow.accepting") : t("tayqan.hire.workflow.acceptDeliverable")}
            </button>
          </div>
        </div>
      )}

      {state.status === "NEEDS_INPUT" && blocker && (
        <div className="rounded-2xl border border-amber-800 bg-amber-950/10 p-4">
          <p className="font-semibold text-amber-100">{t(blocker.i18nKey as TranslationKey)}</p>
          {blocker.entity && (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
              <p className="font-semibold text-white">{blocker.entity.label}</p>
              <p className="mt-1">{blocker.entity.quantity ?? "—"} {blocker.entity.unit ?? ""}</p>
              {blocker.entity.sourceReference && <p className="mt-1 text-slate-500">{blocker.entity.sourceReference}</p>}
            </div>
          )}
          {blocker.kind === "ENTITY_REVIEW" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void answer({ action: "CONFIRM_ENTITY" })} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">{t("tayqan.hire.workflow.confirm")}</button>
              <button disabled={busy} onClick={() => void answer({ action: "REJECT_ENTITY", note })} className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white">{t("tayqan.hire.workflow.reject")}</button>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("tayqan.hire.workflow.notePlaceholder")} className="min-w-[220px] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </div>
          )}
          {blocker.kind === "QUANTITY_REQUIRED" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" placeholder={t("tayqan.hire.workflow.quantity")} className="w-36 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("tayqan.hire.workflow.unit")} className="w-28 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              <button disabled={busy || !quantity || !unit} onClick={() => void answer({ action: "SET_QUANTITY", quantity: Number(quantity), unit, note })} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white">{t("tayqan.hire.send")}</button>
            </div>
          )}
          {blocker.kind === "RATE_REQUIRED" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder={t("tayqan.hire.workflow.unitCost")} className="w-40 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("tayqan.hire.workflow.rateSource")} className="min-w-[220px] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              <button disabled={busy || !rate} onClick={() => void answer({ action: "SET_RATE", unitCost: Number(rate), note })} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white">{t("tayqan.hire.send")}</button>
            </div>
          )}
          {blocker.kind === "QA_QUESTION" && blocker.qa && (
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>{blocker.qa.prompt}</p>
              <p className="text-xs text-slate-500">{blocker.qa.whyMaterial}</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("tayqan.hire.workflow.notePlaceholder")} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <button disabled={busy} onClick={() => void answer({ action: "ANSWER_QA", qaAnswerType: "EXPLAINED_WITH_NOTE", note })} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white">{t("tayqan.hire.send")}</button>
            </div>
          )}
          {blocker.kind === "ACTION" && blocker.actionHref && (
            <div className="mt-3 flex gap-2">
              <Link href={blocker.actionHref} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white">{t("tayqan.hire.workflow.openRequiredStep")}</Link>
              <button disabled={busy} onClick={() => void answer({ action: "RETRY" })} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">{t("tayqan.hire.checkAgain")}</button>
            </div>
          )}
          {blocker.kind === "MEASUREMENT_EXCEPTIONS" && state.tayqanMeasurement && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-300">
                {t("tayqan.hire.workflow.measurementExceptionsSummary", {
                  unresolved: state.tayqanMeasurement.unresolvedCount,
                  total: state.tayqanMeasurement.exceptionCount,
                })}
              </p>
              <div className="space-y-2">
                {state.tayqanMeasurement.exceptions.map((exception) => (
                  <div key={exception.key} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{exception.kind}</p>
                    <p className="mt-1 text-sm text-slate-200">{exception.message}</p>
                    {exception.resolution ? (
                      <p className="mt-2 text-xs text-emerald-300">
                        {t("tayqan.hire.workflow.measurementExceptionResolved", {
                          name: exception.resolution.actorName,
                          reason: exception.resolution.reason,
                        })}
                      </p>
                    ) : exception.waivable ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-[11px] text-slate-500">{t("tayqan.hire.workflow.measurementExceptionWaivable")}</p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            value={resolutionReasons[exception.key] ?? ""}
                            onChange={(e) => setResolutionReasons((current) => ({ ...current, [exception.key]: e.target.value }))}
                            placeholder={t("tayqan.hire.workflow.resolutionReasonPlaceholder")}
                            className="min-w-[220px] flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                          />
                          <button
                            disabled={busy || !resolutionReasons[exception.key]?.trim()}
                            onClick={() => void answer({
                              action: "RESOLVE_MEASUREMENT_EXCEPTION",
                              exceptionKey: exception.key,
                              note: resolutionReasons[exception.key],
                            })}
                            className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {t("tayqan.hire.workflow.resolveException")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-rose-300">{t("tayqan.hire.workflow.measurementExceptionRequiresRemeasurement")}</p>
                    )}
                  </div>
                ))}
              </div>
              <button
                disabled={busy}
                onClick={() => void answer({ action: "RERUN_TAYQAN_MEASUREMENT" })}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900 disabled:opacity-60"
              >
                {busy ? t("tayqan.hire.workflow.rerunningMeasurement") : t("tayqan.hire.workflow.rerunMeasurement")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
