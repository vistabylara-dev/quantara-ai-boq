"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import type { Project } from "@/types/project";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import { deriveProjectWorkflow } from "@/lib/guidance/project-workflow";
import type { ProjectWorkflowSnapshot } from "@/lib/guidance/project-workflow-snapshot";
import { ProjectWorkflowGuide } from "@/components/guidance/project-workflow-guide";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProposalSummary = { id: string; status: string; recipientName: string; expiresAt: string };

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-slate-400",
  READY: "text-blue-300",
  SENT: "text-sky-300",
  OPENED: "text-amber-300",
  COMMENTED: "text-amber-300",
  REVISION_REQUESTED: "text-orange-300",
  APPROVED: "text-emerald-300",
  REJECTED: "text-rose-300",
  REVOKED: "text-slate-500",
  EXPIRED: "text-slate-500",
};

export default function ProjectOverviewPage(props: PageProps) {
  const params = use(props.params);
  const [project, setProject] = useState<Project | null>(null);
  const [latestProposal, setLatestProposal] = useState<ProposalSummary | null>(null);
  const [boqs, setBoqs] = useState<any[]>([]);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<ProjectWorkflowSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadProject = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [data, proposals, boqData, workflowSnapshotData] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodeURIComponent(params.projectId)}`, signal),
        apiClient.get<ProposalSummary[]>(`/api/projects/${encodeURIComponent(params.projectId)}/proposals`, signal).catch(() => []),
        apiClient.get<any[]>(`/api/projects/${encodeURIComponent(params.projectId)}/boqs`, signal),
        apiClient.get<ProjectWorkflowSnapshot>(
          `/api/projects/${encodeURIComponent(params.projectId)}/workflow-snapshot`,
          signal,
        ).catch(() => null),
      ]);

      if (signal?.aborted) return;
      setProject(data);
      setLatestProposal(proposals[0] ?? null);
      setBoqs([...boqData].sort((left, right) => (Number(right.revision?.replace(/^R/i, "")) || 0) - (Number(left.revision?.replace(/^R/i, "")) || 0)));
      setWorkflowSnapshot(workflowSnapshotData);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      if (loadError instanceof ApiClientError && loadError.status === 404) {
        setNotFound(true);
        setProject(null);
      } else {
        setError(getApiErrorMessage(loadError));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProject(controller.signal);
    return () => controller.abort();
  }, [loadProject]);

  const activeBoq = boqs[0] ?? null;
  const isBoqLocked = activeBoq && (activeBoq.isLocked || activeBoq.status === "locked" || activeBoq.status === "approved");

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading project workspace</p>
        <p className="mt-2 text-sm text-slate-400">Fetching project details...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Project not found</p>
        <p className="mt-2 text-sm text-slate-400">This project does not exist in the current company workspace.</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Project unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{error ?? "The project could not be loaded."}</p>
        <button
          type="button"
          onClick={() => void loadProject()}
          className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Try again
        </button>
      </div>
    );
  }

  const workflow = workflowSnapshot
    ? deriveProjectWorkflow({
        projectExists: true,
        projectId: project.id,
        snapshot: workflowSnapshot,
        hasBoq: Boolean(activeBoq),
      })
    : null;

  return (
    <div className="space-y-6">
      <div
        id="project-overview-section"
        tabIndex={-1}
        className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Project</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{project.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{project.description}</p>
          </div>
          <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Client</p>
            <Link href={`/clients/${project.clientId}`} className="block text-base font-semibold text-white hover:text-blue-400">
              {project.clientName}
            </Link>
            <p className="text-sm text-slate-400">{project.clientEmail}</p>
          </div>
          <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Status</p>
            <p className="text-base font-semibold text-white">{project.status}</p>
            <p className="text-sm text-slate-400">Updated {formatDate(project.updatedAt)}</p>
          </div>
        </div>
      </div>

      {workflow ? (
        <ProjectWorkflowGuide workflow={workflow} />
      ) : (
        <section className="rounded-[28px] border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100 sm:p-8">
          <h2 className="text-lg font-semibold">Project intelligence is temporarily unavailable</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">
            Quantara is not claiming workflow progress without a verified snapshot. Your project, sources, BOQ, documents, and other valid workspaces remain available.
          </p>
          <button
            type="button"
            onClick={() => void loadProject()}
            className="mt-4 rounded-xl border border-amber-500 px-4 py-2 text-sm font-semibold transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:hover:bg-amber-400/10"
          >
            Retry project intelligence
          </button>
        </section>
      )}

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h3 className="text-xl font-semibold text-white">Project summary</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Reference</p>
            <p className="mt-3 text-lg font-semibold text-white">{project.reference}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Location</p>
            <p className="mt-3 text-lg font-semibold text-white">{project.location}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Currency</p>
            <p className="mt-3 text-lg font-semibold text-white">{project.currency}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Revision</p>
            <p className="mt-3 text-lg font-semibold text-white">{project.currentRevision}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Bill of Quantities</h3>
            <p className="mt-1 text-sm text-slate-400">
              {activeBoq ? `Current revision: ${activeBoq.revision} · ${activeBoq.status}` : "No BOQ has been created yet."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!activeBoq && (
              <Link
                href={`/projects/${project.id}/boq?action=create-initial`}
                className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Create Initial BOQ
              </Link>
            )}
            {activeBoq && !isBoqLocked && (
              <Link
                href={`/projects/${project.id}/boq`}
                className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Continue BOQ
              </Link>
            )}
            {activeBoq && isBoqLocked && (
              <>
                <Link
                  href={`/projects/${project.id}/boq`}
                  className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  View BOQ
                </Link>
                <Link
                  href={`/projects/${project.id}/boq?action=new-revision`}
                  className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Create New Revision
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Latest proposal</h3>
            {latestProposal ? (
              <p className="mt-1 text-sm text-slate-400">
                To {latestProposal.recipientName} · expires {formatDate(latestProposal.expiresAt)} ·{" "}
                <span className={`font-semibold ${PROPOSAL_STATUS_COLORS[latestProposal.status] ?? "text-slate-300"}`}>{latestProposal.status}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No proposals have been created for this project yet.</p>
            )}
          </div>
          <Link
            href={`/projects/${project.id}/proposals`}
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {latestProposal ? "Manage proposals" : "Create a proposal"}
          </Link>
        </div>
      </div>
    </div>
  );
}
