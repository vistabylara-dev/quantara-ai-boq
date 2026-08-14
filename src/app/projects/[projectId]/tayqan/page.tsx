"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { apiClient, ApiClientError, getApiErrorMessage, type ApiErrorPayload } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import { nextHireIdempotencyKey, type HireAttemptKeyState } from "@/lib/worker/tayqan-hire-attempt";
import {
  buildAssignmentTimeline,
  buildRunTimeline,
  capabilityTranslationKey,
  presentAssignmentStatus,
  presentRunStatus,
  statusTranslationKey,
} from "@/lib/worker/tayqan-presentation";
import { TAYQAN_WORKER_DEFINITION } from "@/lib/worker/worker-definitions";

/**
 * TAYQAN-1 — the hireable-worker foundation UI. Reuses the existing
 * WorkerRun/WorkerAssignment/WorkerDecision/WorkerMaterialQuestion system
 * end to end; this file adds no new persistence of its own beyond what the
 * extended enqueueWorkerReview/GET review-status routes already expose.
 *
 * Every user-visible string here comes from the i18n dictionary (t(...)) or
 * from tayqan-presentation.ts's dictionary-key-returning helpers — this file
 * must not hard-code English presentation text itself. "TAYQAN" is the one
 * intentional exception, kept untranslated as the brand name (see
 * tests/i18n-dictionary-parity.test.ts's allowed-identical list for the same
 * pattern applied to "Quantara").
 */

type BOQSummary = { id: string; title: string; revisionNumber: number };

type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
type AssignmentStatus = "RUNNING" | "NEEDS_INPUT" | "COMPLETED" | "FAILED" | "CANCELLED";

/** Mirrors the Prisma WorkerRunEventType/WorkerEventType enum values without importing @prisma/client — this file must stay safe to bundle into the client. */
type RunEventType =
  | "RUN_ENQUEUED" | "LEASE_ACQUIRED" | "RETRY_SCHEDULED" | "DETERMINISTIC_REVIEW_LINKED"
  | "AI_PLANNER_SKIPPED" | "AI_PLAN_RECORDED" | "RUN_COMPLETED" | "RUN_FAILED";
type AssignmentEventType =
  | "ASSIGNMENT_CREATED" | "INSPECTION_STARTED" | "WORKSPACE_CAPTURED" | "DECISIONS_RECORDED"
  | "MATERIAL_QUESTIONS_OPENED" | "MATERIAL_QUESTION_ANSWERED" | "REVIEW_COMPLETED"
  | "REVIEW_NEEDS_INPUT" | "REVIEW_FAILED";

type WorkerRunDTO = {
  id: string;
  status: RunStatus;
  brief: { assignmentObjective: string | null; specialInstructions: string | null };
  failure: { code: string; message: string | null } | null;
  resultAssignment: { id: string; status: AssignmentStatus; inspectionVersion: string; completedAt: string | null } | null;
  advisoryPlan: {
    plan: { summary: string; priority: string; actions: Array<{ kind: string; subjectType: string; subjectId: string; rationale: string }>; cautions: string[]; requiresHumanReview: boolean };
  } | null;
  events: Array<{ eventType: RunEventType; createdAt: string }>;
  createdAt: string;
};

type MaterialQuestion = {
  id: string;
  status: "OPEN" | "ANSWERED";
  subjectType: string;
  prompt: string;
  whyMaterial: string;
  recommendedAction: string;
  answer: { answerType: string; note: string } | null;
};

type Decision = {
  id: string;
  code: string;
  outcome: string;
  severity: string;
  subjectType: string;
  summary: string;
  evidenceRefs: unknown;
};

type AssignmentDTO = {
  id: string;
  status: AssignmentStatus;
  requestedBy: { name: string };
  startedAt: string;
  completedAt: string | null;
  workspace: {
    conclusion: string;
    itemCount: number;
    confirmedQuantityCount: number;
    confirmedRateCount: number;
    unresolvedCriticalCount: number;
    unresolvedWarningCount: number;
    revisionEvidenceCount: number;
  } | null;
  decisions: Decision[];
  materialQuestions: MaterialQuestion[];
  events: Array<{ eventType: AssignmentEventType; createdAt: string; payload?: unknown }>;
};

function generateIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tayqan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function TayqanPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(props.params);
  const t = useTranslations();

  const [boqs, setBoqs] = useState<BOQSummary[] | null>(null);
  const [selectedBoqId, setSelectedBoqId] = useState<string | null>(null);
  const [run, setRun] = useState<WorkerRunDTO | null | undefined>(undefined); // undefined = loading, null = never hired
  const [assignment, setAssignment] = useState<AssignmentDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [assignmentObjective, setAssignmentObjective] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [hiring, setHiring] = useState(false);
  const [hireError, setHireError] = useState<string | null>(null);
  const [hireAttempt, setHireAttempt] = useState<HireAttemptKeyState>(null);

  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerNote, setAnswerNote] = useState("");
  const [answerError, setAnswerError] = useState<string | null>(null);

  const loadBoqs = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await apiClient.get<BOQSummary[]>(`/api/projects/${encodeURIComponent(projectId)}/boqs`, signal);
      setBoqs(result);
      if (result.length > 0) setSelectedBoqId((current) => current ?? result[0].id);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBoqs(controller.signal);
    return () => controller.abort();
  }, [loadBoqs]);

  const fetchRunStatus = useCallback(async (boqId: string, signal?: AbortSignal) => {
    return apiClient.get<WorkerRunDTO | null>(`/api/boqs/${encodeURIComponent(boqId)}/worker/review`, signal);
  }, []);

  const applyRunStatus = useCallback(async (result: WorkerRunDTO | null, signal?: AbortSignal) => {
    setRun(result);
    if (result?.resultAssignment) {
      const detail = await apiClient.get<AssignmentDTO>(`/api/worker/assignments/${encodeURIComponent(result.resultAssignment.id)}`, signal);
      setAssignment(detail);
    } else {
      setAssignment(null);
    }
  }, []);

  const loadRunStatus = useCallback(async (boqId: string, signal?: AbortSignal) => {
    try {
      const result = await fetchRunStatus(boqId, signal);
      await applyRunStatus(result, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [fetchRunStatus, applyRunStatus]);

  useEffect(() => {
    if (!selectedBoqId) return;
    const controller = new AbortController();
    void loadRunStatus(selectedBoqId, controller.signal);
    return () => controller.abort();
  }, [selectedBoqId, loadRunStatus]);

  const hireTayqan = async () => {
    if (!selectedBoqId) return;
    setHiring(true);
    setHireError(null);
    // Reuse the same key for an uncertain retry on this BOQ; only a genuinely
    // new BOQ selection (or a previously confirmed outcome) gets a fresh one.
    const idempotencyKey = nextHireIdempotencyKey(selectedBoqId, hireAttempt, generateIdempotencyKey);
    setHireAttempt({ boqId: selectedBoqId, key: idempotencyKey });
    try {
      const response = await fetch(`/api/boqs/${encodeURIComponent(selectedBoqId)}/worker/review`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          assignmentObjective: assignmentObjective.trim() || undefined,
          specialInstructions: specialInstructions.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { ok: true; data: WorkerRunDTO } | { ok: false; error: ApiErrorPayload };
      if (!response.ok || !payload.ok) {
        throw new ApiClientError(
          !payload.ok ? payload.error : { code: "REQUEST_FAILED", message: "Could not hire TAYQAN." },
          response.status,
        );
      }
      setHireAttempt(null); // definitively observed: the run now exists under this key
      await applyRunStatus(payload.data);
    } catch (error) {
      // The POST's outcome is uncertain (e.g. the response was lost after the
      // server had already created the run) — confirm with a read-only
      // lookup before surfacing an error or letting a retry mint a new key.
      try {
        const confirmed = await fetchRunStatus(selectedBoqId);
        if (confirmed) {
          setHireAttempt(null);
          await applyRunStatus(confirmed);
        } else {
          setHireError(getApiErrorMessage(error));
        }
      } catch {
        // The confirmation lookup also failed — stay uncertain and keep the
        // same pending key so the next retry reuses it instead of risking a
        // duplicate WorkerRun.
        setHireError(getApiErrorMessage(error));
      }
    } finally {
      setHiring(false);
    }
  };

  const submitAnswer = async (questionId: string, answerType: "ACKNOWLEDGED" | "WILL_CORRECT_SOURCE" | "EXPLAINED_WITH_NOTE") => {
    if (!assignment) return;
    setAnswerError(null);
    try {
      const updated = await apiClient.post<AssignmentDTO>(
        `/api/worker/assignments/${encodeURIComponent(assignment.id)}/questions/${encodeURIComponent(questionId)}/answer`,
        { answerType, note: answerNote.trim() || t("tayqan.fallbackAnswerNote") },
      );
      setAssignment(updated);
      setAnsweringId(null);
      setAnswerNote("");
    } catch (error) {
      setAnswerError(getApiErrorMessage(error));
    }
  };

  if (loadError) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("tayqan.unavailable")}</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
      </div>
    );
  }

  if (boqs === null) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("tayqan.loading")}</p>
      </div>
    );
  }

  if (boqs.length === 0) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("tayqan.noBoqTitle")}</p>
        <p className="mt-2 text-sm text-slate-400">{t("tayqan.noBoqDescription")}</p>
      </div>
    );
  }

  const hasOpenQuestions = assignment?.materialQuestions.some((question) => question.status === "OPEN") ?? false;
  const presentationState = run
    ? (assignment ? presentAssignmentStatus(assignment.status, hasOpenQuestions) : presentRunStatus(run.status))
    : null;
  const timelineEntries = run
    ? [...buildRunTimeline(run.events), ...(assignment ? buildAssignmentTimeline(assignment.events) : [])]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-cyan-900 bg-cyan-950/10 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">{t("tayqan.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{TAYQAN_WORKER_DEFINITION.name}</h1>
        <p className="mt-1 text-lg text-cyan-200">{t(TAYQAN_WORKER_DEFINITION.titleKey as TranslationKey)}</p>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">{t("tayqan.tagline")}</p>

        {boqs.length > 1 && (
          <div className="mt-6">
            <label className="block text-xs text-slate-500" htmlFor="tayqan-boq-select">{t("tayqan.selectBoq")}</label>
            <select
              id="tayqan-boq-select"
              value={selectedBoqId ?? ""}
              onChange={(event) => {
                setSelectedBoqId(event.target.value);
                setRun(undefined);
                setHireAttempt(null);
                setHireError(null);
              }}
              className="mt-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              {boqs.map((boq) => (
                <option key={boq.id} value={boq.id}>{boq.title} ({t("tayqan.revisionLabel", { number: boq.revisionNumber })})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {run === undefined ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">{t("tayqan.loading")}</div>
      ) : run === null ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">{t("tayqan.available")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{t("tayqan.capabilitiesTitle")}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {TAYQAN_WORKER_DEFINITION.capabilityKeys.map((capabilityKey) => (
              <li key={capabilityKey} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                {t(capabilityTranslationKey(capabilityKey) as TranslationKey)}
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold text-white">{t("tayqan.briefTitle")}</h3>
            <label className="block text-xs text-slate-500" htmlFor="tayqan-objective">{t("tayqan.objectiveLabel")}</label>
            <textarea
              id="tayqan-objective"
              value={assignmentObjective}
              onChange={(event) => setAssignmentObjective(event.target.value)}
              placeholder={t("tayqan.objectivePlaceholder")}
              rows={2}
              maxLength={2000}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600"
            />
            <label className="block text-xs text-slate-500" htmlFor="tayqan-instructions">{t("tayqan.instructionsLabel")}</label>
            <textarea
              id="tayqan-instructions"
              value={specialInstructions}
              onChange={(event) => setSpecialInstructions(event.target.value)}
              placeholder={t("tayqan.instructionsPlaceholder")}
              rows={2}
              maxLength={2000}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600"
            />
            {hireError && <p className="text-xs text-rose-300">{hireError}</p>}
            <button
              type="button"
              onClick={() => void hireTayqan()}
              disabled={hiring}
              className="rounded-2xl border border-cyan-500 bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {hiring ? t("tayqan.hiring") : t("tayqan.hireCta")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            {presentationState && (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
                {t(statusTranslationKey(presentationState) as TranslationKey)}
              </p>
            )}
            <h2 className="mt-2 text-xl font-semibold text-white">{t("tayqan.assignmentTitle")}</h2>
            {(run.brief.assignmentObjective || run.brief.specialInstructions) && (
              <div className="mt-3 space-y-1 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
                {run.brief.assignmentObjective && <p><span className="text-slate-500">{t("tayqan.objectiveLabel")}: </span>{run.brief.assignmentObjective}</p>}
                {run.brief.specialInstructions && <p><span className="text-slate-500">{t("tayqan.instructionsLabel")}: </span>{run.brief.specialInstructions}</p>}
              </div>
            )}
            {run.failure && <p className="mt-3 text-sm text-rose-300">{run.failure.message}</p>}

            {assignment?.workspace && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label={t("tayqan.stats.items")} value={assignment.workspace.itemCount} />
                <Stat label={t("tayqan.stats.quantityConfirmed")} value={assignment.workspace.confirmedQuantityCount} />
                <Stat label={t("tayqan.stats.rateConfirmed")} value={assignment.workspace.confirmedRateCount} />
                <Stat label={t("tayqan.stats.criticalIssues")} value={assignment.workspace.unresolvedCriticalCount} accent={assignment.workspace.unresolvedCriticalCount > 0 ? "text-rose-300" : undefined} />
                <Stat label={t("tayqan.stats.warnings")} value={assignment.workspace.unresolvedWarningCount} accent={assignment.workspace.unresolvedWarningCount > 0 ? "text-amber-300" : undefined} />
                <Stat label={t("tayqan.stats.revisionEvidence")} value={assignment.workspace.revisionEvidenceCount} />
              </div>
            )}
          </div>

          {assignment && assignment.materialQuestions.length > 0 && (
            <div className="rounded-[32px] border border-amber-900 bg-amber-950/10 p-8">
              <h2 className="text-xl font-semibold text-white">{t("tayqan.questionsTitle")}</h2>
              <div className="mt-4 space-y-4">
                {assignment.materialQuestions.map((question) => (
                  <div key={question.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm font-semibold text-white">{question.prompt}</p>
                    <p className="mt-1 text-xs text-slate-400">{question.whyMaterial}</p>
                    <p className="mt-1 text-xs text-slate-500">{t("tayqan.recommendedAction")}: {question.recommendedAction}</p>
                    <p className="mt-1 text-xs text-slate-600">{t("tayqan.affectedSubject")}: {question.subjectType}</p>

                    {question.status === "ANSWERED" ? (
                      <p className="mt-3 rounded-2xl border border-emerald-900 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-300">
                        {question.answer?.note}
                      </p>
                    ) : answeringId === question.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={answerNote}
                          onChange={(event) => setAnswerNote(event.target.value)}
                          placeholder={t("tayqan.answerPlaceholder")}
                          rows={2}
                          maxLength={2000}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200"
                        />
                        {answerError && <p className="text-xs text-rose-300">{answerError}</p>}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void submitAnswer(question.id, "ACKNOWLEDGED")} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">
                            {t("tayqan.answerAcknowledged")}
                          </button>
                          <button type="button" onClick={() => void submitAnswer(question.id, "WILL_CORRECT_SOURCE")} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">
                            {t("tayqan.answerWillCorrect")}
                          </button>
                          <button type="button" onClick={() => void submitAnswer(question.id, "EXPLAINED_WITH_NOTE")} className="rounded-xl border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-900/70">
                            {t("tayqan.answerExplain")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAnsweringId(question.id); setAnswerNote(""); setAnswerError(null); }}
                        className="mt-3 rounded-xl border border-amber-700 bg-amber-900/30 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/60"
                      >
                        {t("tayqan.needsYourDecision")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {assignment && assignment.decisions.length > 0 && (
            <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
              <h2 className="text-xl font-semibold text-white">{t("tayqan.findingsTitle")}</h2>
              <div className="mt-4 space-y-2">
                {assignment.decisions.map((decision) => (
                  <div key={decision.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs">
                    <span className="text-slate-200">{decision.summary}</span>
                    <span className={decision.severity === "MATERIAL" ? "text-rose-300" : decision.severity === "WARNING" ? "text-amber-300" : "text-slate-500"}>{decision.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {run.advisoryPlan && (
            <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
              <h2 className="text-xl font-semibold text-white">{t("tayqan.advisoryTitle")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("tayqan.advisoryDisclaimer")}</p>
              <p className="mt-3 text-sm text-slate-300">{run.advisoryPlan.plan.summary}</p>
              {run.advisoryPlan.plan.cautions.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {run.advisoryPlan.plan.cautions.map((caution, index) => (
                    <li key={index} className="text-xs text-amber-300">⚠ {caution}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h2 className="text-xl font-semibold text-white">{t("tayqan.timelineTitle")}</h2>
            <ol className="mt-4 space-y-2">
              {timelineEntries.map((entry, index) => (
                <li key={index} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400">
                  <span className="text-slate-200">{t(entry.i18nKey as TranslationKey, entry.vars)}</span>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>

          {!hasOpenQuestions && assignment?.status === "COMPLETED" && (
            <p className="text-center text-sm text-slate-500">{t("tayqan.completedNote")}</p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}
