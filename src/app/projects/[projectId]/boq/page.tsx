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
import AddItemFromSourceModal, { type AddItemTab } from "@/components/boq/add-item-from-source-modal";
import { BoqStartWizard, type BoqCreationMethod } from "@/components/boq/boq-start-wizard";
import { BoqWorkflowStepper } from "@/components/boq/boq-workflow-stepper";
import { computeBoqWorkflowState, type NextStepAction } from "@/lib/workflow/boq-workflow-state";

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemInitialTab, setAddItemInitialTab] = useState<AddItemTab>("search");
  const [showCreationSelector, setShowCreationSelector] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [extractedEntities, setExtractedEntities] = useState<Array<{
    id: string;
    status: string;
    quantity: number | null;
    unit: string | null;
  }>>([]);
  const [calculations, setCalculations] = useState<Array<{
    id: string;
    extractedEntityId: string | null;
    status: string;
  }>>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<Array<{
    boqId: string;
    status: string;
    isDraft: boolean;
  }> | null>(null);
  const [workflowFactsWarning, setWorkflowFactsWarning] = useState<string | null>(null);
  const [validationWarningCount, setValidationWarningCount] = useState<number | null>(null);
  const [validationPreviewError, setValidationPreviewError] = useState<string | null>(null);
  const hasTriggeredAction = useRef(false);

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const encodedProjectId = encodeURIComponent(params.projectId);
      const [projectData, boqData, filesData, entitiesData, calculationsData, documentsData] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<BOQ[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
        apiClient.get<unknown[]>(`/api/projects/${encodedProjectId}/files`, signal).catch(() => null),
        apiClient.get<Array<{
          id: string;
          status: string;
          quantity: number | null;
          unit: string | null;
        }>>(`/api/projects/${encodedProjectId}/extractions`, signal).catch(() => null),
        apiClient
          .get<Array<{
            id: string;
            extractedEntityId: string | null;
            status: string;
          }>>(`/api/projects/${encodedProjectId}/quantity-calculations`, signal)
          .catch(() => null),
        apiClient
          .get<Array<{ boqId: string; status: string; isDraft: boolean }>>(
            `/api/projects/${encodedProjectId}/documents`,
            signal,
          )
          .catch(() => null),
      ]);

      const orderedRevisions = newestFirst(boqData);
      setProject(projectData);
      setRevisions(orderedRevisions);
      setActiveBoq(orderedRevisions[0] ?? null);
      setHasUnsavedChanges(false);

      setFileCount(filesData?.length ?? 0);
      setExtractedEntities(entitiesData ?? []);
      setCalculations(calculationsData ?? []);
      setGeneratedDocuments(documentsData);

      const unavailableFacts = [
        filesData === null ? "sources" : null,
        entitiesData === null ? "extraction" : null,
        calculationsData === null ? "calculations" : null,
        documentsData === null ? "output history" : null,
      ].filter((value): value is string => Boolean(value));

      setWorkflowFactsWarning(
        unavailableFacts.length > 0
          ? `Workflow guidance is temporarily incomplete because ${unavailableFacts.join(", ")} could not be verified. BOQ editing remains available; no unavailable count is being treated as zero.`
          : null,
      );
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
    setHasUnsavedChanges(false);
  }, []);

  const handleBoqChange = useCallback((updated: BOQ) => {
    setActiveBoq(updated);
    setHasUnsavedChanges(true);
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
        {},
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
    } else if (action === "import-reviewed") {
      setAddItemInitialTab("reviewed");

      const editableRevision = revisions.find((revision) => !isReadOnlyBOQ(revision));
      if (editableRevision) {
        setActiveBoq(editableRevision);
        setHasUnsavedChanges(false);
        setShowAddItem(true);
      } else if (revisions.length === 0) {
        void createInitialBOQ(true);
      } else {
        setActionError(
          "Reviewed source information is ready, but this project has no editable BOQ revision. "
          + "Create a new revision before importing it.",
        );
      }
    }
    
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    router.replace(url.pathname + url.search);
  }, [isLoading, searchParams, revisions, activeBoq, createInitialBOQ, createRevision, router]);

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

  const activeRevisionId = activeRevision?.id ?? null;

  useEffect(() => {
    if (!activeRevisionId) {
      setValidationWarningCount(null);
      setValidationPreviewError(null);
      return;
    }

    const controller = new AbortController();
    setValidationWarningCount(null);
    setValidationPreviewError(null);

    apiClient
      .get<{ code: string }[]>(
        `/api/boqs/${encodeURIComponent(activeRevisionId)}/validation-preview`,
        controller.signal,
      )
      .then((warnings) => {
        setValidationWarningCount(warnings.length);
        setValidationPreviewError(null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setValidationWarningCount(null);
        setValidationPreviewError(
          `Validation preview is currently unavailable: ${getApiErrorMessage(error)} No zero-warning status is being assumed.`,
        );
      });

    return () => controller.abort();
  }, [activeRevisionId]);

  const boqItemCount = useMemo(
    () => (activeRevision ? activeRevision.sections.reduce((sum, section) => sum + section.items.length, 0) : 0),
    [activeRevision],
  );

  const generatedDocumentCount = useMemo(() => {
    if (!activeRevision || generatedDocuments === null) return null;
    return generatedDocuments.filter(
      (document) =>
        document.boqId === activeRevision.id
        && document.status === "COMPLETED"
        && document.isDraft === false,
    ).length;
  }, [activeRevision, generatedDocuments]);

  const workflowState = useMemo(
    () =>
      computeBoqWorkflowState({
        fileCount,
        extractedEntities,
        calculations,
        boqItemCount,
        validationWarningCount,
        generatedDocumentCount,
        isLocked: isReadOnlyBOQ(activeRevision),
      }),
    [
      fileCount,
      extractedEntities,
      calculations,
      boqItemCount,
      validationWarningCount,
      generatedDocumentCount,
      activeRevision,
    ],
  );

  const handleWorkflowAction = useCallback((action: NonNullable<NextStepAction["ctaAction"]>) => {
    const encodedProjectId = encodeURIComponent(params.projectId);

    switch (action) {
      case "open_files":
        router.push(`/projects/${encodedProjectId}/files`);
        break;

      case "review_extractions":
        router.push(`/projects/${encodedProjectId}/extractions`);
        break;

      case "review_dimensions":
      case "review_calculations":
        if (!activeRevision) {
          void createInitialBOQ(true);
          setAddItemInitialTab("reviewed");
          break;
        }
        if (isReadOnlyBOQ(activeRevision)) {
          setActionError(
            "This BOQ revision is locked. Create a new revision before adding or changing reviewed measurements.",
          );
          break;
        }
        if (hasUnsavedChanges) {
          setActionError(
            "Save the current BOQ changes before adding or importing another item. Your unsaved edits will not be discarded.",
          );
          break;
        }
        setAddItemInitialTab("reviewed");
        setShowAddItem(true);
        break;

      case "open_boq":
        if (!activeRevision) {
          const hasReviewedEntities = extractedEntities.some(
            (entity) => entity.status === "CONFIRMED" || entity.status === "CORRECTED",
          );
          setAddItemInitialTab(hasReviewedEntities ? "reviewed" : "search");
          void createInitialBOQ(true);
          break;
        }
        if (isReadOnlyBOQ(activeRevision)) {
          setActionError(
            "This BOQ revision is locked. Create a new revision before adding an item.",
          );
          break;
        }
        if (hasUnsavedChanges) {
          setActionError(
            "Save the current BOQ changes before adding or importing another item. Your unsaved edits will not be discarded.",
          );
          break;
        }
        setAddItemInitialTab(
          extractedEntities.some(
            (entity) => entity.status === "CONFIRMED" || entity.status === "CORRECTED",
          )
            ? "reviewed"
            : "search",
        );
        setShowAddItem(true);
        break;

      case "view_boq":
        // "BOQ Review" step: the editor is already rendered on this page —
        // scroll to it instead of popping the add-item modal (that's a
        // different action). Falls back to the empty-state creation flow
        // when there's nothing to scroll to yet.
        if (!activeRevision) {
          const hasReviewedEntities = extractedEntities.some(
            (entity) => entity.status === "CONFIRMED" || entity.status === "CORRECTED",
          );
          setAddItemInitialTab(hasReviewedEntities ? "reviewed" : "search");
          void createInitialBOQ(true);
          break;
        }
        {
          const editorSection = document.getElementById("boq-editor-section");
          editorSection?.scrollIntoView({ behavior: "smooth", block: "start" });
          editorSection?.focus({ preventScroll: true });
        }
        break;

      case "run_validation":
        // Read-only professional verification workspace. Never locks the BOQ.
        router.push(`/projects/${encodedProjectId}/verification`);
        break;

      case "lock_boq":
        // Consequential action remains explicit and separate from validation.
        if (activeRevision) void lockRevision(activeRevision);
        break;

      case "view_output":
        router.push(`/projects/${encodedProjectId}/documents`);
        break;
    }
  }, [
    activeRevision,
    createInitialBOQ,
    extractedEntities,
    hasUnsavedChanges,
    lockRevision,
    params.projectId,
    router,
  ]);

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
        setHasUnsavedChanges(false);
      }
      setShowCreationSelector(false);
    } else if (method === "upload_drawings") {
      // Honest routing (spec section 13): this navigates to the project's real,
      // already-working file/drawing upload workflow instead of a "coming soon" alert.
      router.push(`/projects/${encodeURIComponent(params.projectId)}/drawings`);
    } else if (method === "connect_app") {
      // Project context must survive the trip through the integrations hub —
      // otherwise the user lands on a page with no idea which project they
      // came from, and has to navigate back manually.
      const encodedProjectId = encodeURIComponent(params.projectId);
      router.push(
        `/integrations?projectId=${encodedProjectId}&intent=boq-source&returnTo=${encodeURIComponent(`/projects/${params.projectId}/boq`)}`,
      );
    }
    // import_measurements / import_boq render their own "not available yet" state
    // with real alternatives inside BoqStartWizard and never reach this handler.
  }, [createInitialBOQ, params.projectId, revisions, router]);

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
              onClick={() => {
                setAddItemInitialTab("search");
                setShowAddItem(true);
              }}
              title={hasUnsavedChanges ? "Save current BOQ changes before adding another item." : ""}
              disabled={!activeRevision || isReadOnly || actionInProgress || hasUnsavedChanges}
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

      {workflowFactsWarning ? (
        <div
          role="status"
          className="rounded-[28px] border border-amber-900/60 bg-amber-950/20 p-5 text-sm text-amber-200"
        >
          {workflowFactsWarning}
        </div>
      ) : (
        <BoqWorkflowStepper
          steps={workflowState.steps}
          nextAction={workflowState.nextAction}
          onAction={handleWorkflowAction}
        />
      )}

      {validationPreviewError && (
        <div
          role="alert"
          className="rounded-[28px] border border-amber-900/60 bg-amber-950/20 p-5 text-sm text-amber-200"
        >
          {validationPreviewError}
        </div>
      )}

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
            <BoqStartWizard
              hasDrafts={revisions.some(r => !isReadOnlyBOQ(r))}
              onSelectMethod={handleCreationMethodSelect}
            />
          ) : activeRevision ? (
            <div id="boq-editor-section" tabIndex={-1} className="rounded-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
            <BoqEditor
              boq={activeRevision}
              projectId={params.projectId}
              currency={project.currency}
              taxRate={project.taxRate}
              industryId={project.industryId}
              actionPending={actionInProgress}
              onChange={handleBoqChange}
              onSave={saveBoq}
              onCreateRevision={createRevision}
              onLock={lockRevision}
              onApplyCatalogueRate={applyCatalogueRate}
              onAddItem={() => {
                if (hasUnsavedChanges) {
                  setActionError(
                    "Save the current BOQ changes before adding another item. Your unsaved edits will not be discarded.",
                  );
                  return;
                }
                setAddItemInitialTab("search");
                setShowAddItem(true);
              }}
              hasUnsavedChanges={hasUnsavedChanges}
              onVoiceApplied={replaceRevision}
            />
            </div>
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
                    if (boq.id !== activeRevision?.id) {
                      setActiveBoq(boq);
                      setHasUnsavedChanges(false);
                    }
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
          projectId={params.projectId}
          boqId={activeRevision.id}
          sections={activeRevision.sections.map((section) => ({ id: section.id, title: section.title }))}
          nextItemNumber={activeRevision.sections.reduce((max, section) => Math.max(max, ...section.items.map((item) => item.itemNumber), 0), 0) + 1}
          initialTab={addItemInitialTab}
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
