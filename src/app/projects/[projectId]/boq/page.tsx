"use client";

import { useCallback, useEffect, useMemo, useState, use, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { BOQ } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/dates";
import { withCalculatedBOQTotals } from "@/lib/calculations/boq-totals";
import BoqEditor from "@/components/boq/boq-editor";
import AddItemFromSourceModal from "@/components/boq/add-item-from-source-modal";
import { BoqCreationMethodSelector, type BoqCreationMethod } from "@/components/boq/boq-creation-method-selector";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type PendingAction = "save" | "create" | "revision" | "lock" | null;

function revisionNumber(boq: BOQ): number {
  return Number(boq.revision.replace(/^R/i, "")) || 0;
}

function newestFirst(boqs: BOQ[]): BOQ[] {
  return [...boqs].sort((left, right) => revisionNumber(right) - revisionNumber(left));
}

function isReadOnlyBOQ(boq: BOQ | null): boolean {
  return Boolean(boq?.isLocked) || boq?.status === "locked" || boq?.status === "approved";
}

export default function ProjectBOQPage(props: PageProps) {
  const params = use(props.params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [revisions, setRevisions] = useState<BOQ[]>([]);
  const [activeBoq, setActiveBoq] = useState<BOQ | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showCreationSelector, setShowCreationSelector] = useState(false);
  const hasTriggeredAction = useRef(false);

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const encodedProjectId = encodeURIComponent(params.projectId);
      const [projectData, boqData] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<BOQ[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
      ]);
      const orderedRevisions = newestFirst(boqData);
      setProject(projectData);
      setRevisions(orderedRevisions);
      setActiveBoq(orderedRevisions[0] ?? null);
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

  const replaceRevision = useCallback((updated: BOQ) => {
    setRevisions((current) => {
      const exists = current.some((revision) => revision.id === updated.id);
      const next = exists
        ? current.map((revision) => (revision.id === updated.id ? updated : revision))
        : [updated, ...current];
      return newestFirst(next);
    });
    setActiveBoq(updated);
  }, []);

  const saveBoq = useCallback(async (boq: BOQ) => {
    setPendingAction("save");
    setActionError(null);
    try {
      const payload = withCalculatedBOQTotals(boq, project?.taxRate ?? 0);
      const saved = await apiClient.put<BOQ>(
        `/api/boqs/${encodeURIComponent(payload.id)}`,
        payload,
      );
      replaceRevision(saved);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }, [project?.taxRate, replaceRevision]);

  const persistDraft = useCallback(async (boq: BOQ) => {
    const payload = withCalculatedBOQTotals(boq, project?.taxRate ?? 0);
    const saved = await apiClient.put<BOQ>(
      `/api/boqs/${encodeURIComponent(payload.id)}`,
      payload,
    );
    replaceRevision(saved);
    return saved;
  }, [project?.taxRate, replaceRevision]);

  const createInitialBOQ = useCallback(async (openAddModal = false) => {
    if (pendingAction || revisions.length > 0) return;
    setPendingAction("create");
    setActionError(null);
    try {
      const created = await apiClient.post<BOQ>(
        `/api/projects/${encodeURIComponent(params.projectId)}/boqs`,
      );
      replaceRevision(created);
      if (openAddModal) {
        setShowAddItem(true);
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }, [params.projectId, pendingAction, replaceRevision, revisions.length]);

  const createRevision = useCallback(async (draft: BOQ) => {
    if (pendingAction) return;
    setPendingAction("revision");
    setActionError(null);
    try {
      const source = isReadOnlyBOQ(draft) ? draft : await persistDraft(draft);
      const revision = await apiClient.post<BOQ>(
        `/api/boqs/${encodeURIComponent(source.id)}/revisions`
      );
      replaceRevision(revision);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }, [pendingAction, persistDraft, replaceRevision]);

  useEffect(() => {
    if (isLoading || hasTriggeredAction.current) return;
    const action = searchParams.get("action");
    if (!action) return;

    hasTriggeredAction.current = true;
    if (action === "create-initial" && revisions.length === 0) {
      void createInitialBOQ();
    } else if (action === "new-revision" && activeBoq && isReadOnlyBOQ(activeBoq)) {
      void createRevision(activeBoq);
    }
    
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    router.replace(url.pathname + url.search);
  }, [isLoading, searchParams, revisions.length, activeBoq, createInitialBOQ, createRevision, router]);

  const lockRevision = useCallback(async (draft: BOQ) => {
    if (isReadOnlyBOQ(draft) || pendingAction) return;
    setPendingAction("lock");
    setActionError(null);
    try {
      const saved = await persistDraft(draft);
      const locked = await apiClient.post<BOQ>(
        `/api/boqs/${encodeURIComponent(saved.id)}/lock`
      );
      replaceRevision(locked);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }, [pendingAction, persistDraft, replaceRevision]);

  const activeRevision = useMemo(() => activeBoq ?? revisions[0] ?? null, [activeBoq, revisions]);

  const applyCatalogueRate = useCallback(async (itemId: string, catalogueItemId: string, confirmReplaceOverrides = false) => {
    if (!activeRevision || isReadOnlyBOQ(activeRevision)) return;
    await persistDraft(activeRevision);
    const boq = await apiClient.post<BOQ>(`/api/catalogue/${encodeURIComponent(catalogueItemId)}/apply-to-boq`, {
      boqItemId: itemId,
      applyMode: "REPLACE_COMMERCIAL_FIELDS",
      confirmReplaceOverrides,
    });
    replaceRevision(boq);
  }, [activeRevision, persistDraft, replaceRevision]);

  const handleCreationMethodSelect = useCallback((method: BoqCreationMethod) => {
    if (method === "start_manually") {
      void createInitialBOQ(true); // Open modal immediately
      setShowCreationSelector(false);
    } else if (method === "continue_draft") {
      const draft = revisions.find(r => !isReadOnlyBOQ(r));
      if (draft) {
        setActiveBoq(draft);
      }
      setShowCreationSelector(false);
    } else {
      // Feature not implemented yet (Phases 8+)
      alert("This creation method is coming soon.");
    }
  }, [createInitialBOQ, revisions]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading BOQ workspace</p>
        <p className="mt-2 text-sm text-slate-400">Fetching project and revision data...</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Project BOQ unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "No project was found for this BOQ workspace."}</p>
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

  const isReadOnly = isReadOnlyBOQ(activeRevision);
  const actionInProgress = pendingAction !== null;

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">BOQ Studio</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{project.name} BOQ</h2>
            <p className="mt-2 text-sm text-slate-400">Review revisions, total values, and editing status.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowAddItem(true)}
              disabled={!activeRevision || isReadOnly || actionInProgress}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add item
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeRevision) {
                  void createRevision(activeRevision);
                } else {
                  setShowCreationSelector(true);
                }
              }}
              disabled={actionInProgress}
              className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "create" || pendingAction === "revision"
                ? "Creating…"
                : activeRevision
                  ? "New revision"
                  : "Create BOQ"}
            </button>
            <button
              type="button"
              title={activeRevision?.sections.every(s => s.items.length === 0) ? "Add at least one valid item before locking this revision." : ""}
              onClick={() => activeRevision && void lockRevision(activeRevision)}
              disabled={!activeRevision || isReadOnly || actionInProgress || activeRevision.sections.every(s => s.items.length === 0)}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "lock"
                ? "Locking…"
                : activeRevision?.status === "approved"
                  ? "Revision approved"
                  : isReadOnly
                    ? "Revision locked"
                    : "Lock revision"}
            </button>
          </div>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {showCreationSelector || (!activeRevision && revisions.length === 0) ? (
            <BoqCreationMethodSelector 
              hasDrafts={revisions.some(r => !isReadOnlyBOQ(r))}
              onSelectMethod={handleCreationMethodSelect}
            />
          ) : activeRevision ? (
            <BoqEditor
              boq={activeRevision}
              currency={project.currency}
              taxRate={project.taxRate}
              industryId={project.industryId}
              actionPending={actionInProgress}
              onChange={setActiveBoq}
              onSave={saveBoq}
              onCreateRevision={createRevision}
              onLock={lockRevision}
              onApplyCatalogueRate={applyCatalogueRate}
              onAddItem={() => setShowAddItem(true)}
            />
          ) : (
            <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
              <p className="text-lg font-semibold text-white">No active BOQ revision</p>
              <p className="mt-2 text-sm text-slate-400">Please select a revision from the history panel.</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Revision history</p>
            <div className="mt-6 space-y-3">
              {revisions.map((boq) => (
                <button
                  key={boq.id}
                  type="button"
                  onClick={() => {
                    if (boq.id !== activeRevision?.id) setActiveBoq(boq);
                  }}
                  disabled={actionInProgress}
                  className={`w-full rounded-3xl border px-4 py-4 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    boq.id === activeRevision?.id ? "border-blue-500 bg-blue-950 text-white" : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{boq.revision}</span>
                    <span className="rounded-full bg-slate-950 px-2 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-slate-400">
                      {boq.status}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-400">{formatDate(boq.createdAt)}</p>
                  <p className="mt-2 text-white">{formatCurrency(boq.totals.grandTotal, project.currency)}</p>
                </button>
              ))}
              {revisions.length === 0 && (
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                  No BOQ revisions are available for this project.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showAddItem && activeRevision && (
        <AddItemFromSourceModal
          boqId={activeRevision.id}
          sections={activeRevision.sections.map((section) => ({ id: section.id, title: section.title }))}
          nextItemNumber={activeRevision.sections.reduce((max, section) => Math.max(max, ...section.items.map((item) => item.itemNumber), 0), 0) + 1}
          onClose={() => setShowAddItem(false)}
          onAdded={() => {
            setShowAddItem(false);
            void loadWorkspace();
          }}
        />
      )}
    </div>
  );
}
