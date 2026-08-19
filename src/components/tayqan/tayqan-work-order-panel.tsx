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
  relatedEntityId: string | null;
  dangerous: boolean;
  resolution: { reason: string; actorUserId: string; actorName: string; resolvedAt: string } | null;
};

/** Subset of toExtractedEntityDTO's shape actually rendered here. */
type ResolvedExceptionEntity = {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  extractionMethod: string;
  sourceText: string | null;
};

/** The reasoner's own JSON schema caps a single exception at 16 pageIds; this is a defensive UI cap, not a real-world expectation (typical exceptions cite 1-3 pages). */
const MAX_INLINE_PAGE_THUMBNAILS = 12;

function DrawingPageThumbnail({ pageId }: { pageId: string }) {
  const t = useTranslations();
  const [failed, setFailed] = useState(false);
  const src = `/api/drawing-pages/${encodeURIComponent(pageId)}/image`;

  if (failed) {
    return (
      <div className="flex h-20 w-28 items-center justify-center rounded-lg border border-slate-800 text-center text-[10px] text-slate-500">
        {t("tayqan.hire.workflow.exceptionNoPageImage")}
      </div>
    );
  }

  return (
    <a href={src} target="_blank" rel="noreferrer" className="block h-20 w-28 overflow-hidden rounded-lg border border-slate-800 bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={t("tayqan.hire.workflow.exceptionPageEvidence")} className="h-full w-full object-cover" onError={() => setFailed(true)} />
    </a>
  );
}

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
  measurementExceptions: {
    totalCount: number;
    dangerousCount: number;
    unresolvedDangerousCount: number;
    exceptions: TayqanMeasurementExceptionState[];
  };
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
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const [resolvedEntities, setResolvedEntities] = useState<Record<string, ResolvedExceptionEntity>>({});
  const resolvedEntityIdsFetched = useRef<string>("");
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

  // Resolves measurementExceptions[].relatedEntityId to real entity details
  // (mission 2). Independent of the polling/advance flow above — a failure
  // here silently leaves resolvedEntities as-is; the exception's own kind
  // and message (already rendered regardless) are never blocked on this.
  useEffect(() => {
    const ids = [...new Set(
      (state?.measurementExceptions.exceptions ?? [])
        .map((exception) => exception.relatedEntityId)
        .filter((id): id is string => Boolean(id))
        .filter((id) => !resolvedEntities[id]),
    )];
    if (ids.length === 0) return;
    const fetchKey = ids.slice().sort().join(",");
    if (fetchKey === resolvedEntityIdsFetched.current) return;
    resolvedEntityIdsFetched.current = fetchKey;

    const controller = new AbortController();
    apiClient
      .get<ResolvedExceptionEntity[]>(
        `/api/projects/${encodeURIComponent(projectId)}/extractions?ids=${encodeURIComponent(ids.join(","))}`,
        controller.signal,
      )
      .then((entities) => {
        setResolvedEntities((current) => {
          const next = { ...current };
          for (const entity of entities) next[entity.id] = entity;
          return next;
        });
      })
      .catch(() => { /* degrade gracefully — the exception text is already shown */ });
    return () => controller.abort();
  }, [state?.measurementExceptions.exceptions, projectId, resolvedEntities]);

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

  const acceptDeliverable = async () => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const next = await apiClient.post<TayqanWorkOrderState>(
        `/api/projects/${encodeURIComponent(projectId)}/tayqan/work-order/accept`,
        { workOrderId: state.id },
      );
      setState(next);
      setConfirmingAccept(false);
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
            {!confirmingAccept ? (
              <button
                disabled={busy || state.measurementExceptions.unresolvedDangerousCount > 0}
                onClick={() => setConfirmingAccept(true)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {t("tayqan.hire.workflow.acceptDeliverable")}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-700 bg-slate-950 p-3">
                <p className="text-xs text-slate-300">{t("tayqan.hire.workflow.acceptDeliverableConfirm")}</p>
                <button disabled={busy} onClick={() => void acceptDeliverable()} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                  {busy ? t("tayqan.hire.workflow.accepting") : t("tayqan.hire.workflow.acceptDeliverableConfirmYes")}
                </button>
                <button disabled={busy} onClick={() => setConfirmingAccept(false)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">
                  {t("tayqan.hire.workflow.cancel")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {state.measurementExceptions.totalCount > 0 && (
        <div className="rounded-2xl border border-amber-800 bg-amber-950/10 p-4">
          <p className="font-semibold text-amber-100">{t("tayqan.hire.workflow.measurementExceptionsTitle")}</p>
          <p className="mt-1 text-xs text-slate-400">
            {t("tayqan.hire.workflow.measurementExceptionsSummary", {
              unresolved: state.measurementExceptions.unresolvedDangerousCount,
              total: state.measurementExceptions.totalCount,
            })}
          </p>
          <div className="mt-3 space-y-2">
            {state.measurementExceptions.exceptions.map((exception) => (
              <div key={exception.key} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{exception.kind}</p>
                <p className="mt-1 text-sm text-slate-200">{exception.message}</p>

                {exception.pageIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {exception.pageIds.slice(0, MAX_INLINE_PAGE_THUMBNAILS).map((pageId) => (
                      <DrawingPageThumbnail key={pageId} pageId={pageId} />
                    ))}
                    {exception.pageIds.length > MAX_INLINE_PAGE_THUMBNAILS && (
                      <span className="self-center text-[11px] text-slate-500">
                        +{exception.pageIds.length - MAX_INLINE_PAGE_THUMBNAILS}
                      </span>
                    )}
                  </div>
                )}

                {exception.relatedEntityId && (() => {
                  const entity = resolvedEntities[exception.relatedEntityId];
                  if (!entity) return null;
                  const isTableSourced = entity.extractionMethod === "TABLE_PARSER";
                  return (
                    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-slate-300">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{entity.label}</p>
                        <span className={[
                          "rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.15em]",
                          isTableSourced ? "border border-blue-900/60 bg-blue-950/30 text-blue-200" : "border border-slate-700 bg-slate-800 text-slate-300",
                        ].join(" ")}>
                          {isTableSourced ? t("tayqan.hire.workflow.exceptionEntitySourceTable") : t("tayqan.hire.workflow.exceptionEntitySourcePage")}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-400">{entity.quantity ?? "—"} {entity.unit ?? ""}</p>
                      {entity.sourceText && <p className="mt-1 whitespace-pre-line text-slate-500">{entity.sourceText}</p>}
                    </div>
                  );
                })()}

                {exception.resolution ? (
                  <p className="mt-2 text-xs text-emerald-300">
                    {t("tayqan.hire.workflow.measurementExceptionResolved", {
                      name: exception.resolution.actorName,
                      reason: exception.resolution.reason,
                    })}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-500">
                      {exception.dangerous ? t("tayqan.hire.workflow.measurementExceptionDangerous") : t("tayqan.hire.workflow.measurementExceptionInformational")}
                    </p>
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
                )}
              </div>
            ))}
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
        </div>
      )}
    </div>
  );
}
