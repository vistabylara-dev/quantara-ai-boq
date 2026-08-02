"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BOQ } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/dates";

type AffectedItem = {
  itemNumber: number;
  itemCode: string;
  description: string;
};

type VerificationExceptionView = {
  id: string;
  boqItemId?: string | null;
  type: string;
  severity: string;
  message: string;
  sourceReference?: string | null;
  currentValue?: string | null;
  suggestedValue?: string | null;
  resolved: boolean;
  resolutionNote?: string | null;
  affectedItem?: AffectedItem;
};

type VerificationSummary = {
  unresolvedCritical: number;
  unresolvedWarning: number;
  resolved: number;
  lockBlocked: boolean;
  lockEligible: boolean;
};

type VerificationData = {
  boq: BOQ;
  exceptions: VerificationExceptionView[];
  summary: VerificationSummary;
};

type PageProps = {
  params: {
    projectId: string;
  };
};

export default function ProjectVerificationPage({ params }: PageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [boqs, setBoqs] = useState<BOQ[]>([]);
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const applyVerification = useCallback((data: VerificationData) => {
    setVerification(data);
    setBoqs((current) =>
      current.map((boq) => (boq.id === data.boq.id ? data.boq : boq))
    );
  }, []);

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const encodedProjectId = encodeURIComponent(params.projectId);
      const [projectData, revisions] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<BOQ[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
      ]);
      setProject(projectData);
      setBoqs(revisions);

      const activeBoq = revisions[0];
      if (activeBoq) {
        const verificationData = await apiClient.get<VerificationData>(
          `/api/boqs/${encodeURIComponent(activeBoq.id)}/verification`,
          signal
        );
        setVerification(verificationData);
      } else {
        setVerification(null);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, [loadWorkspace]);

  const refreshVerification = useCallback(async () => {
    if (!verification?.boq.id) return;
    const data = await apiClient.get<VerificationData>(
      `/api/boqs/${encodeURIComponent(verification.boq.id)}/verification`
    );
    applyVerification(data);
  }, [applyVerification, verification?.boq.id]);

  const rerunVerification = useCallback(async () => {
    if (!verification?.boq.id || isRerunning) return;
    setIsRerunning(true);
    setActionError(null);
    try {
      const data = await apiClient.post<VerificationData>(
        `/api/boqs/${encodeURIComponent(verification.boq.id)}/verification/run`
      );
      applyVerification(data);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsRerunning(false);
    }
  }, [applyVerification, isRerunning, verification?.boq.id]);

  const resolveException = useCallback(async (exceptionId: string) => {
    const resolutionNote = resolutionNotes[exceptionId]?.trim();
    if (!resolutionNote) {
      setActionError("Add a resolution note before resolving this exception.");
      return;
    }
    setResolvingId(exceptionId);
    setActionError(null);
    try {
      await apiClient.post(`/api/verification/${encodeURIComponent(exceptionId)}/resolve`, {
        resolutionNote,
      });
      await refreshVerification();
      setResolutionNotes((current) => {
        const next = { ...current };
        delete next[exceptionId];
        return next;
      });
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setResolvingId(null);
    }
  }, [refreshVerification, resolutionNotes]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading verification workspace</p>
        <p className="mt-2 text-sm text-slate-400">Fetching project details and verification checks.</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Verification workspace unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "No project was found for this verification workspace."}</p>
        <button
          type="button"
          onClick={() => void loadWorkspace()}
          className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Try again
        </button>
      </div>
    );
  }

  const exceptions = verification?.exceptions ?? [];
  const summary = verification?.summary;
  const isRevisionReadOnly = Boolean(verification?.boq.isLocked) ||
    verification?.boq.status === "locked" ||
    verification?.boq.status === "approved";

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Verification</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{project.name} checks</h2>
            <p className="mt-3 text-slate-400">
              {verification
                ? `${verification.boq.title} · ${verification.boq.revision}`
                : "No BOQ is available for verification."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void rerunVerification()}
            disabled={!verification || isRerunning || resolvingId !== null}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRerunning ? "Running checks…" : "Re-run verification"}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-[28px] border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{actionError}</p>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="rounded-2xl border border-rose-800 px-3 py-2 font-semibold hover:bg-rose-900/40"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {exceptions.map((issue) => (
            <article key={issue.id} className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{issue.severity}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{issue.message}</h3>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{issue.type.replace(/_/g, " ")}</p>
                </div>
                <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm uppercase tracking-[0.24em] text-slate-300">
                  {issue.resolved ? "resolved" : "open"}
                </span>
              </div>

              {issue.affectedItem && (
                <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">
                    Item {issue.affectedItem.itemNumber} · {issue.affectedItem.itemCode || "No code"}
                  </p>
                  <p className="mt-1 text-slate-400">{issue.affectedItem.description}</p>
                </div>
              )}

              {(issue.currentValue || issue.suggestedValue || issue.sourceReference) && (
                <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
                  {issue.currentValue && <p>Current: <span className="text-slate-200">{issue.currentValue}</span></p>}
                  {issue.suggestedValue && <p>Suggested: <span className="text-slate-200">{issue.suggestedValue}</span></p>}
                  {issue.sourceReference && <p className="sm:col-span-2">Source: <span className="text-slate-200">{issue.sourceReference}</span></p>}
                </div>
              )}

              {issue.resolved ? (
                <p className="mt-5 text-sm text-slate-400">
                  Resolution: <span className="text-slate-200">{issue.resolutionNote || "Resolved"}</span>
                </p>
              ) : (
                <label className="mt-5 block text-sm text-slate-300">
                  <span className="text-slate-400">Resolution note</span>
                  <input
                    type="text"
                    value={resolutionNotes[issue.id] ?? ""}
                    onChange={(event) => setResolutionNotes((current) => ({ ...current, [issue.id]: event.target.value }))}
                    placeholder="Describe how this exception was resolved"
                    disabled={resolvingId !== null || isRerunning}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {!issue.resolved && (
                  <button
                    type="button"
                    onClick={() => void resolveException(issue.id)}
                    disabled={resolvingId !== null || isRerunning}
                    className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resolvingId === issue.id ? "Resolving…" : "Resolve"}
                  </button>
                )}
                <Link
                  href={`/projects/${params.projectId}/boq`}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Inspect BOQ
                </Link>
              </div>
            </article>
          ))}

          {verification && exceptions.length === 0 && (
            <div className="rounded-[28px] border border-slate-800 bg-slate-950 p-8 text-center text-slate-400">
              No verification exceptions were found for this BOQ revision.
            </div>
          )}

          {!verification && (
            <div className="rounded-[28px] border border-slate-800 bg-slate-950 p-8 text-center text-slate-400">
              No BOQ revisions are available for verification.
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">BOQ revisions</p>
            <p className="mt-3 text-sm text-slate-400">Showing revisions for the current project.</p>
            <div className="mt-6 space-y-3">
              {boqs.length > 0 ? (
                boqs.map((boq) => (
                  <div key={boq.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{boq.revision}</span>
                      <span className="rounded-full bg-slate-950 px-2 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-slate-400">
                        {boq.status}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-400">Created: {formatDate(boq.createdAt)}</p>
                    <p className="mt-2 text-white">Grand total: {formatCurrency(boq.totals.grandTotal, project.currency)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-400">
                  No revisions were found for this project.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Verification status</p>
            {summary ? (
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-slate-400">Unresolved critical</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{summary.unresolvedCritical}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-slate-400">Unresolved warning</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{summary.unresolvedWarning}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-slate-400">Resolved</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{summary.resolved}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <p className="font-semibold text-white">
                    {isRevisionReadOnly
                      ? verification?.boq.status === "approved"
                        ? "Revision approved"
                        : "Revision locked"
                      : summary.lockEligible
                        ? "Eligible to lock"
                        : "Lock blocked"}
                  </p>
                  <p className="mt-2 text-slate-400">
                    {isRevisionReadOnly
                      ? "This revision is already read-only; lock eligibility no longer applies."
                      : summary.lockBlocked
                        ? "Resolve all critical exceptions before locking this BOQ."
                        : "No unresolved critical exceptions block this revision."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Create a BOQ before running verification checks.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
