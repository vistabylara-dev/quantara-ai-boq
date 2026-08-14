"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { apiClient, ApiClientError, getApiErrorMessage, type ApiErrorPayload } from "@/lib/api/client";
import { TAYQAN_WORKER_DEFINITION } from "@/lib/worker/worker-definitions";
import { useTranslations } from "@/lib/i18n/locale-provider";

/**
 * TAYQAN-1 — the hireable-worker foundation UI. Reuses the existing
 * WorkerRun/WorkerAssignment/WorkerDecision/WorkerMaterialQuestion system
 * end to end; this file adds no new persistence of its own beyond what the
 * extended enqueueWorkerReview/GET review-status routes already expose.
 */

type BOQSummary = { id: string; title: string; revisionNumber: number };

type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
type AssignmentStatus = "RUNNING" | "NEEDS_INPUT" | "COMPLETED" | "FAILED" | "CANCELLED";

type WorkerRunDTO = {
  id: string;
  status: RunStatus;
  brief: { assignmentObjective: string | null; specialInstructions: string | null };
  failure: { code: string; message: string | null } | null;
  resultAssignment: { id: string; status: AssignmentStatus; inspectionVersion: string; completedAt: string | null } | null;
  advisoryPlan: {
    plan: { summary: string; priority: string; actions: Array<{ kind: string; subjectType: string; subjectId: string; rationale: string }>; cautions: string[]; requiresHumanReview: boolean };
  } | null;
  events: Array<{ eventType: string; createdAt: string }>;
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
  events: Array<{ eventType: string; createdAt: string }>;
};

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  QUEUED: "TAYQAN is working",
  RUNNING: "TAYQAN is working",
  COMPLETED: "TAYQAN completed the run",
  FAILED: "TAYQAN needs attention",
  CANCELLED: "Cancelled",
};

const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  RUNNING: "TAYQAN is working",
  NEEDS_INPUT: "TAYQAN needs your decision",
  COMPLETED: "TAYQAN completed the review",
  FAILED: "TAYQAN needs attention",
  CANCELLED: "Cancelled",
};

const EVENT_LABEL: Record<string, string> = {
  RUN_ENQUEUED: "TAYQAN was hired",
  LEASE_ACQUIRED: "TAYQAN started working",
  RETRY_SCHEDULED: "TAYQAN is retrying",
  DETERMINISTIC_REVIEW_LINKED: "Review results linked",
  AI_PLANNER_SKIPPED: "Advisory plan skipped",
  AI_PLAN_RECORDED: "Advisory plan recorded",
  RUN_COMPLETED: "TAYQAN finished this run",
  RUN_FAILED: "TAYQAN's run failed",
  ASSIGNMENT_CREATED: "TAYQAN hired",
  INSPECTION_STARTED: "Review started",
  WORKSPACE_CAPTURED: "BOQ workspace captured",
  DECISIONS_RECORDED: "Quantity and rate evidence checked",
  MATERIAL_QUESTIONS_OPENED: "Material questions opened",
  MATERIAL_QUESTION_ANSWERED: "You answered a question",
  REVIEW_COMPLETED: "QA review completed",
  REVIEW_NEEDS_INPUT: "TAYQAN needs your decision",
  REVIEW_FAILED: "Review could not complete",
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

  const loadRunStatus = useCallback(async (boqId: string, signal?: AbortSignal) => {
    try {
      const result = await apiClient.get<WorkerRunDTO | null>(`/api/boqs/${encodeURIComponent(boqId)}/worker/review`, signal);
      setRun(result);
      if (result?.resultAssignment) {
        const detail = await apiClient.get<AssignmentDTO>(`/api/worker/assignments/${encodeURIComponent(result.resultAssignment.id)}`, signal);
        setAssignment(detail);
      } else {
        setAssignment(null);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

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
    try {
      const response = await fetch(`/api/boqs/${encodeURIComponent(selectedBoqId)}/worker/review`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": generateIdempotencyKey(),
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
      await loadRunStatus(selectedBoqId);
    } catch (error) {
      setHireError(getApiErrorMessage(error));
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
        { answerType, note: answerNote.trim() || "Acknowledged." },
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
        <p className="text-lg font-semibold text-white">TAYQAN unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
      </div>
    );
  }

  if (boqs === null) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading TAYQAN…</p>
      </div>
    );
  }

  if (boqs.length === 0) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">No BOQ yet</p>
        <p className="mt-2 text-sm text-slate-400">Create a BOQ for this project before hiring TAYQAN.</p>
      </div>
    );
  }

  const hasOpenQuestions = assignment?.materialQuestions.some((question) => question.status === "OPEN") ?? false;

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-cyan-900 bg-cyan-950/10 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">{t("tayqan.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{TAYQAN_WORKER_DEFINITION.name}</h1>
        <p className="mt-1 text-lg text-cyan-200">{TAYQAN_WORKER_DEFINITION.title}</p>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">{t("tayqan.tagline")}</p>

        {boqs.length > 1 && (
          <div className="mt-6">
            <label className="block text-xs text-slate-500" htmlFor="tayqan-boq-select">{t("tayqan.selectBoq")}</label>
            <select
              id="tayqan-boq-select"
              value={selectedBoqId ?? ""}
              onChange={(event) => { setSelectedBoqId(event.target.value); setRun(undefined); }}
              className="mt-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              {boqs.map((boq) => (
                <option key={boq.id} value={boq.id}>{boq.title} (rev {boq.revisionNumber})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {run === undefined ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">Loading TAYQAN status…</div>
      ) : run === null ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">{t("tayqan.available")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{t("tayqan.capabilitiesTitle")}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {TAYQAN_WORKER_DEFINITION.capabilities.map((capability) => (
              <li key={capability} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">{capability}</li>
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
              {assignment ? ASSIGNMENT_STATUS_LABEL[assignment.status] : RUN_STATUS_LABEL[run.status]}
            </p>
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
                <Stat label="Items" value={assignment.workspace.itemCount} />
                <Stat label="Quantity confirmed" value={assignment.workspace.confirmedQuantityCount} />
                <Stat label="Rate confirmed" value={assignment.workspace.confirmedRateCount} />
                <Stat label="Critical issues" value={assignment.workspace.unresolvedCriticalCount} accent={assignment.workspace.unresolvedCriticalCount > 0 ? "text-rose-300" : undefined} />
                <Stat label="Warnings" value={assignment.workspace.unresolvedWarningCount} accent={assignment.workspace.unresolvedWarningCount > 0 ? "text-amber-300" : undefined} />
                <Stat label="Revision evidence" value={assignment.workspace.revisionEvidenceCount} />
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
              {[...run.events, ...(assignment?.events ?? [])]
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map((event, index) => (
                  <li key={index} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400">
                    <span className="text-slate-200">{EVENT_LABEL[event.eventType] ?? event.eventType}</span>
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
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
