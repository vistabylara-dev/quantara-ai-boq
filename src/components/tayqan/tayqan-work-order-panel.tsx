"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import { TAYQAN_WORK_STAGE_ORDER } from "@/lib/tayqan/tayqan-workflow-contract";

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
    kind: "ACTION" | "ENTITY_REVIEW" | "QUANTITY_REQUIRED" | "RATE_REQUIRED" | "QA_QUESTION" | "ERROR";
    i18nKey: string;
    actionHref?: string;
    entity?: { id: string; label: string; quantity: number | null; unit: string | null; sourceReference: string | null; confidence: number };
    qa?: { assignmentId: string; questionId: string; questionType: string; prompt: string; whyMaterial: string; recommendedAction: string };
  } | null;
  qaWorkerRunId: string | null;
  startedAt: string;
  lastAdvancedAt: string;
  completedAt: string | null;
  events: Array<{ id: string; stage: string; eventType: string; payload: unknown; createdAt: string }>;
};

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tayqan-work-${Date.now()}`;
}

type DocumentTemplateSummary = { id: string; isDefault: boolean; isActive: boolean };
type GeneratedDocumentView = { id: string; status: string };

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
  const [exportingDraftBoq, setExportingDraftBoq] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedDocumentId, setExportedDocumentId] = useState<string | null>(null);
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
      setQuantity(""); setUnit(""); setRate(""); setNote("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const exportDraftBoqWord = async () => {
    if (!state?.boqId) return;
    setExportingDraftBoq(true);
    setExportError(null);
    setExportedDocumentId(null);
    try {
      // Reuses the existing document-generation infra end to end (same
      // pattern as the project documents page) — no second export pipeline.
      const templates = await apiClient.get<DocumentTemplateSummary[]>("/api/templates");
      const template = templates.find((candidate) => candidate.isDefault && candidate.isActive) ?? templates.find((candidate) => candidate.isActive);
      if (!template) {
        setExportError(t("tayqan.hire.workflow.exportDraftBoqNoTemplate"));
        return;
      }
      const generated = await apiClient.post<GeneratedDocumentView>(
        `/api/projects/${encodeURIComponent(projectId)}/documents/generate`,
        { boqId: state.boqId, templateId: template.id, documentType: "DOCX", audience: "CLIENT", pricingMode: "QUANTITIES_ONLY" },
      );
      setExportedDocumentId(generated.id);
    } catch (err) {
      setExportError(getApiErrorMessage(err));
    } finally {
      setExportingDraftBoq(false);
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

      {state.boqId && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm font-semibold text-slate-200">{t("tayqan.hire.workflow.exportDraftBoqTitle")}</p>
          <p className="mt-1 text-xs text-slate-400">{t("tayqan.hire.workflow.exportDraftBoqNote")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              disabled={exportingDraftBoq}
              onClick={() => void exportDraftBoqWord()}
              className="rounded-xl border border-cyan-700 bg-cyan-950/40 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingDraftBoq ? t("tayqan.hire.workflow.exportingDraftBoq") : t("tayqan.hire.workflow.exportDraftBoqWord")}
            </button>
            {exportedDocumentId && (
              <a
                href={`/api/documents/${encodeURIComponent(exportedDocumentId)}/download`}
                className="text-xs font-semibold text-emerald-300 underline"
              >
                {t("tayqan.hire.workflow.exportDraftBoqDownload")}
              </a>
            )}
          </div>
          {exportError && <p className="mt-2 text-xs text-rose-300">{exportError}</p>}
        </div>
      )}

      {state.status === "RUNNING" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          {t("tayqan.hire.workflow.running")}
        </div>
      )}

      {state.status === "READY_FOR_ACCEPTANCE" && (
        <div className="rounded-2xl border border-emerald-700 bg-emerald-950/20 p-4">
          <p className="font-semibold text-emerald-200">{t("tayqan.hire.workflow.readyForAcceptance")}</p>
          <p className="mt-1 text-sm text-slate-300">{t("tayqan.hire.workflow.acceptanceNote")}</p>
          {state.boqId && <Link href={`/projects/${encodeURIComponent(projectId)}/boq`} className="mt-3 inline-block text-sm font-semibold text-cyan-300 underline">{t("tayqan.hire.openBoq")}</Link>}
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
