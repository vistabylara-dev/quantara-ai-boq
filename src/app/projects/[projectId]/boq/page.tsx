"use client";

import { useCallback, useEffect, useMemo, useState, use, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { BOQ, BOQStatus } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/dates";
import { withCalculatedBOQTotals } from "@/lib/calculations/boq-totals";
import BoqEditor from "@/components/boq/boq-editor";
import { RateOnlyBOQEditor } from "@/components/boq/rate-only-boq-editor";
import AddItemFromSourceModal, { type AddItemTab } from "@/components/boq/add-item-from-source-modal";
import { BoqStartWizard, type BoqCreationMethod } from "@/components/boq/boq-start-wizard";
import { BoqWorkflowStepper } from "@/components/boq/boq-workflow-stepper";
import { computeBoqWorkflowState, type NextStepAction } from "@/lib/workflow/boq-workflow-state";
import { parseGuideBoqAction } from "@/lib/guidance/guide-navigation";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import { getLocalizedApiErrorMessage } from "@/lib/i18n/api-error-message";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type PendingAction = "save" | "create" | "revision" | "lock" | null;

type AiDraftConfirmationResult = {
  confirmedCount: number;
  skippedCount: number;
  remainingCount: number;
  skippedItems: Array<{ id: string; itemCode: string; description: string }>;
};

const WORKFLOW_FACT_TRANSLATION_KEYS = {
  sources: "boqEditor.factSources",
  extraction: "boqEditor.factExtraction",
  calculations: "boqEditor.factCalculations",
  outputHistory: "boqEditor.factOutputHistory",
} as const;

const BOQ_STATUS_TRANSLATION_KEYS: Record<BOQStatus, TranslationKey> = {
  draft: "boqEditor.revisionStatusDraft",
  locked: "boqEditor.revisionStatusLocked",
  approved: "boqEditor.revisionStatusApproved",
};

type UnavailableWorkflowFact = keyof typeof WORKFLOW_FACT_TRANSLATION_KEYS;

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
  const { locale, t } = useLocale();
  const localizationRef = useRef({ locale, t });
  localizationRef.current = { locale, t };
  const params = use(props.params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const rateOnlyMode = searchParams.get("mode") === "rates";
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
    inputValues: Record<string, number>;
  }>>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<Array<{
    boqId: string;
    status: string;
    isDraft: boolean;
  }> | null>(null);
  const [unavailableWorkflowFacts, setUnavailableWorkflowFacts] = useState<UnavailableWorkflowFact[]>([]);
  const [validationWarningCount, setValidationWarningCount] = useState<number | null>(null);
  const [validationPreviewError, setValidationPreviewError] = useState<string | null>(null);
  const [isConfirmingAiDraft, setIsConfirmingAiDraft] = useState(false);
  const [aiDraftMessage, setAiDraftMessage] = useState<string | null>(null);
  const handledActionSignatureRef = useRef<string | null>(null);

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
            inputValues: Record<string, number>;
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
        documentsData === null ? "outputHistory" : null,
      ].filter((value): value is UnavailableWorkflowFact => value !== null);

      setUnavailableWorkflowFacts(unavailableFacts);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const current = localizationRef.current;
      setLoadError(getLocalizedApiErrorMessage(error, current.t, current.locale));
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
      setActionError(getLocalizedApiErrorMessage(error, t, locale));
    } finally {
      setPendingAction(null);
    }
  }, [locale, project?.taxRate, replaceRevision, t]);

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
      setActionError(getLocalizedApiErrorMessage(error, t, locale));
    } finally {
      setPendingAction(null);
    }
  }, [locale, params.projectId, pendingAction, replaceRevision, revisions.length, t]);

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
      setActionError(getLocalizedApiErrorMessage(error, t, locale));
    } finally {
      setPendingAction(null);
    }
  }, [locale, pendingAction, persistDraft, replaceRevision, t]);

  const focusBoqStartWorkflow = useCallback(() => {
    setShowCreationSelector(true);
    requestAnimationFrame(() => {
      const startWorkflow = document.getElementById("boq-start-workflow");
      startWorkflow?.scrollIntoView({ behavior: "smooth", block: "start" });
      startWorkflow?.focus({ preventScroll: true });
    });
  }, []);

  const openReviewedWorkflow = useCallback((allowCreate: boolean) => {
    if (!activeBoq) {
      if (allowCreate) {
        void createInitialBOQ(true);
        setAddItemInitialTab("reviewed");
      } else {
        // Guide query state is advisory and never permission to create a BOQ.
        focusBoqStartWorkflow();
      }
      return;
    }

    if (isReadOnlyBOQ(activeBoq)) {
      setActionError(t("boqEditor.lockedCreateRevisionMeasurements"));
      return;
    }

    if (hasUnsavedChanges) {
      setActionError(t("boqEditor.saveBeforeAddingOrImporting"));
      return;
    }

    // This is the existing reviewed-measurement and calculation entry surface.
    // Opening it never selects, imports, saves, or confirms professional data.
    setAddItemInitialTab("reviewed");
    setShowAddItem(true);
  }, [activeBoq, createInitialBOQ, focusBoqStartWorkflow, hasUnsavedChanges, t]);

  const focusBoqWorkspace = useCallback((allowCreate: boolean) => {
    if (!activeBoq) {
      if (allowCreate) {
        const hasReviewedEntities = extractedEntities.some(
          (entity) => entity.status === "CONFIRMED" || entity.status === "CORRECTED",
        );
        setAddItemInitialTab(hasReviewedEntities ? "reviewed" : "search");
        void createInitialBOQ(true);
      } else {
        focusBoqStartWorkflow();
      }
      return;
    }

    const editorSection = document.getElementById("boq-editor-section");
    editorSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    editorSection?.focus({ preventScroll: true });
  }, [activeBoq, createInitialBOQ, extractedEntities, focusBoqStartWorkflow]);

  useEffect(() => {
    if (isLoading) return;
    const actionValues = searchParams.getAll("action");
    if (actionValues.length === 0) {
      handledActionSignatureRef.current = null;
      return;
    }

    const actionSignature = searchParams.toString();
    if (handledActionSignatureRef.current === actionSignature) return;
    handledActionSignatureRef.current = actionSignature;

    const guideAction = parseGuideBoqAction(searchParams);
    const action = actionValues.length === 1 ? actionValues[0] : null;

    if (guideAction === "review_dimensions" || guideAction === "review_calculations") {
      openReviewedWorkflow(false);
    } else if (guideAction === "view_boq") {
      focusBoqWorkspace(false);
    } else if (action === "create-initial" && revisions.length === 0) {
      // Preserve the existing, explicitly requested project-overview action.
      void createInitialBOQ();
    } else if (action === "new-revision" && activeBoq && isReadOnlyBOQ(activeBoq)) {
      // Preserve the existing, explicitly requested revision action.
      void createRevision(activeBoq);
    } else if (action === "import-reviewed") {
      // Preserve the existing reviewed-import action. It is intentionally not
      // part of the Guide-safe action whitelist because it may create a BOQ.
      setAddItemInitialTab("reviewed");

      const editableRevision = revisions.find((revision) => !isReadOnlyBOQ(revision));
      if (editableRevision) {
        setActiveBoq(editableRevision);
        setHasUnsavedChanges(false);
        setShowAddItem(true);
      } else if (revisions.length === 0) {
        void createInitialBOQ(true);
      } else {
        setActionError(t("boqEditor.importReadyNoRevision"));
      }
    }

    // Every supported, malformed, or unknown action is one-shot URL state.
    // Remove it after interpretation while preserving unrelated query state.
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [
    activeBoq,
    createInitialBOQ,
    createRevision,
    focusBoqWorkspace,
    isLoading,
    openReviewedWorkflow,
    revisions,
    router,
    searchParams,
    t,
  ]);

  const lockRevisionAndReturn = useCallback(async (draft: BOQ): Promise<BOQ | null> => {
    if (isReadOnlyBOQ(draft) || pendingAction) return null;
    setPendingAction("lock");
    setActionError(null);
    try {
      const saved = await persistDraft(draft);
      const locked = await apiClient.post<BOQ>(
        `/api/boqs/${encodeURIComponent(saved.id)}/lock`
      );
      replaceRevision(locked);
      return locked;
    } catch (error) {
      setActionError(getLocalizedApiErrorMessage(error, t, locale));
      return null;
    } finally {
      setPendingAction(null);
    }
  }, [locale, pendingAction, persistDraft, replaceRevision, t]);

  const lockRevision = useCallback(async (draft: BOQ): Promise<void> => {
    await lockRevisionAndReturn(draft);
  }, [lockRevisionAndReturn]);

  const activeRevision = useMemo(() => activeBoq ?? revisions[0] ?? null, [activeBoq, revisions]);

  const activeRevisionId = activeRevision?.id ?? null;
  const aiDraftMode = searchParams.get("aiDraft") === "1";
  const aiDraftAddedCount = Number(searchParams.get("added") ?? "0") || 0;
  const aiDraftSkippedCount = Number(searchParams.get("skipped") ?? "0") || 0;
  const aiDraftExistingCount = Number(searchParams.get("existing") ?? "0") || 0;
  const hasAiDraftItems = useMemo(
    () => Boolean(activeRevision?.sections.some(
      (section) => section.items.some(
        (item) => item.notes?.includes("AI Draft from extracted project evidence"),
      ),
    )),
    [activeRevision],
  );
  const aiSuggestedMeasurementCount = useMemo(
    () => activeRevision?.sections.reduce(
      (total, section) =>
        total + section.items.filter(
          (item) => item.notes?.includes("AI-suggested measurement"),
        ).length,
      0,
    ) ?? 0,
    [activeRevision],
  );
  const showAiDraftReview = aiDraftMode || hasAiDraftItems;
  const missingRateCount = useMemo(
    () => activeRevision?.sections.reduce(
      (total, section) => total + section.items.filter((item) => item.sellingRate <= 0).length,
      0,
    ) ?? 0,
    [activeRevision],
  );
  const allRatesEntered = useMemo(
    () => Boolean(activeRevision)
      && activeRevision!.sections.some((section) => section.items.length > 0)
      && activeRevision!.sections.every((section) => section.items.every((item) => item.sellingRate > 0)),
    [activeRevision],
  );
  const verificationBlocked = (activeRevision?.finalization?.unresolvedCritical ?? 0) > 0;

  const generateFinalBoq = useCallback(async () => {
    if (!activeRevision || hasUnsavedChanges || !allRatesEntered || verificationBlocked) return;
    const locked = await lockRevisionAndReturn(activeRevision);
    if (locked) {
      router.push(`/projects/${encodeURIComponent(params.projectId)}/documents`);
    }
  }, [activeRevision, allRatesEntered, hasUnsavedChanges, lockRevisionAndReturn, params.projectId, router, verificationBlocked]);

  const confirmRemainingAiDraftQuantities = useCallback(async () => {
    if (!activeRevision || isReadOnlyBOQ(activeRevision) || isConfirmingAiDraft) return;
    if (hasUnsavedChanges) {
      setActionError(t("boqEditor.saveBeforeAddingOrImporting"));
      return;
    }

    setIsConfirmingAiDraft(true);
    setActionError(null);
    setAiDraftMessage(null);
    try {
      const result = await apiClient.post<AiDraftConfirmationResult>(
        `/api/boqs/${encodeURIComponent(activeRevision.id)}/ai-draft/confirm-quantities`,
        {},
      );
      const summary =
        result.confirmedCount > 0
          ? `${result.confirmedCount} AI Draft ${result.confirmedCount === 1 ? "quantity was" : "quantities were"} professionally confirmed. ${result.remainingCount} remain for review.`
          : "No additional AI Draft quantities were confirmed. Review any remaining exceptions before finalizing.";
      // TAYQAN-AI-DRAFT-LOOP-FIX: name the specific item(s) this button
      // could not auto-confirm (e.g. no measured quantity was ever extracted
      // for them) instead of leaving the customer with only a generic count
      // and no way to know which row still needs a manual quantity typed in.
      const skippedHint =
        result.skippedItems.length > 0
          ? " " + t("tayqan.hire.workflow.aiDraftSkippedItemsHint", {
              items: result.skippedItems.map((item) => item.itemCode).join(", "),
            })
          : "";
      setAiDraftMessage(summary + skippedHint);
      await loadWorkspace();
    } catch (error) {
      setActionError(getLocalizedApiErrorMessage(error, t, locale));
    } finally {
      setIsConfirmingAiDraft(false);
    }
  }, [activeRevision, hasUnsavedChanges, isConfirmingAiDraft, loadWorkspace, locale, t]);

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
          t("boqEditor.validationPreviewUnavailable", {
            message: getLocalizedApiErrorMessage(error, t, locale),
          }),
        );
      });

    return () => controller.abort();
  }, [activeRevisionId, locale, t]);

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
      }, t),
    [
      fileCount,
      extractedEntities,
      calculations,
      boqItemCount,
      validationWarningCount,
      generatedDocumentCount,
      activeRevision,
      t,
    ],
  );

  const workflowFactsWarning = unavailableWorkflowFacts.length > 0
    ? t("boqEditor.workflowFactsWarning", {
        facts: unavailableWorkflowFacts
          .map((fact) => t(WORKFLOW_FACT_TRANSLATION_KEYS[fact]))
          .join(", "),
      })
    : null;

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
        openReviewedWorkflow(true);
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
          setActionError(t("boqEditor.lockedCreateRevisionItem"));
          break;
        }
        if (hasUnsavedChanges) {
          setActionError(t("boqEditor.saveBeforeAddingOrImporting"));
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
        focusBoqWorkspace(true);
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
    focusBoqWorkspace,
    lockRevision,
    openReviewedWorkflow,
    params.projectId,
    router,
    t,
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
        <p className="text-lg font-semibold text-white">{t("boqEditor.loadingWorkspace")}</p>
        <p className="mt-2 text-sm text-slate-400">{t("boqEditor.fetchingRevisionData")}</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("boqEditor.workspaceUnavailable")}</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? t("boqEditor.noProjectFound")}</p>
        <button
          type="button"
          onClick={() => void loadWorkspace()}
          className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          {t("boqEditor.tryAgain")}
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
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("boqEditor.pageEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{t("boqEditor.pageTitle", { name: project.name })}</h2>
            <p className="mt-2 text-sm text-slate-400">{t("boqEditor.pageSubtitle")}</p>
          </div>
          {!rateOnlyMode && <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setAddItemInitialTab("search");
                setShowAddItem(true);
              }}
              title={hasUnsavedChanges ? t("boqEditor.saveBeforeAddingItem") : ""}
              disabled={!activeRevision || isReadOnly || actionInProgress || hasUnsavedChanges}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("boqCreate.addItem")}
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
                ? t("boqEditor.creatingRevision")
                : activeRevision
                  ? t("boqEditor.newRevision")
                  : t("boqEditor.createBoq")}
            </button>
            <button
              type="button"
              title={activeRevision?.sections.every(s => s.items.length === 0) ? t("boqEditor.addItemBeforeLocking") : ""}
              onClick={() => activeRevision && void lockRevision(activeRevision)}
              disabled={!activeRevision || isReadOnly || actionInProgress || activeRevision.sections.every(s => s.items.length === 0)}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "lock"
                ? t("boqEditor.lockingRevision")
                : activeRevision?.status === "approved"
                  ? t("boqEditor.revisionApproved")
                  : isReadOnly
                    ? t("boqEditor.revisionLocked")
                    : t("boqEditor.lockRevision")}
            </button>
          </div>}
        </div>
      </div>

      {!rateOnlyMode && showAiDraftReview && activeRevision && !isReadOnly && (
        <section className="rounded-[28px] border border-blue-500/40 bg-blue-500/10 p-5 text-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">AI Draft BOQ</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Review the completed BOQ instead of approving extraction one item at a time</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {aiDraftMode
                  ? `Quantara added ${aiDraftAddedCount} extracted ${aiDraftAddedCount === 1 ? "item" : "items"} to this editable draft.`
                  : "This editable BOQ contains AI Draft items from extracted project evidence."}
                {aiDraftMode && aiDraftExistingCount > 0 ? ` ${aiDraftExistingCount} extracted ${aiDraftExistingCount === 1 ? "item was" : "items were"} already present and were not duplicated.` : ""}
                {aiDraftMode && aiDraftSkippedCount > 0 ? ` ${aiDraftSkippedCount} incomplete ${aiDraftSkippedCount === 1 ? "candidate still needs" : "candidates still need"} extraction review.` : ""}
              </p>
              {aiSuggestedMeasurementCount > 0 && (
                <p className="mt-2 rounded-xl border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-xs leading-5 text-blue-100">
                  Quantara inferred {aiSuggestedMeasurementCount} missing {aiSuggestedMeasurementCount === 1 ? "measurement" : "measurements"} from stored drawing evidence. Review the suggested quantity/unit in the BOQ table; the existing confirmation action is the single professional approval step.
                </p>
              )}
              <p className="mt-2 text-xs leading-5 text-slate-400">
                AI-suggested and unchanged AI Draft quantities stay unconfirmed until you approve them here. Any quantity you edit follows the existing manual confirmation path. Quantara does not invent rates: use your purchased packages, catalogue/company library, or manual pricing before final validation.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const editor = document.getElementById("boq-editor-section");
                  editor?.scrollIntoView({ behavior: "smooth", block: "start" });
                  editor?.focus({ preventScroll: true });
                }}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Review BOQ
              </button>
              <button
                type="button"
                onClick={() => void confirmRemainingAiDraftQuantities()}
                disabled={isConfirmingAiDraft || hasUnsavedChanges}
                title={hasUnsavedChanges ? "Save the BOQ before confirming AI Draft quantities." : ""}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirmingAiDraft ? "Confirming..." : "Confirm Remaining Draft Quantities"}
              </button>
              {aiDraftMode && aiDraftSkippedCount > 0 && (
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${encodeURIComponent(params.projectId)}/extractions`)}
                  className="rounded-xl border border-amber-600/70 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-950/30"
                >
                  Review {aiDraftSkippedCount} Extraction {aiDraftSkippedCount === 1 ? "Exception" : "Exceptions"}
                </button>
              )}
            </div>
          </div>
          {aiDraftMessage && (
            <p role="status" className="mt-4 rounded-xl border border-emerald-700/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
              {aiDraftMessage}
            </p>
          )}
        </section>
      )}

      {!rateOnlyMode && (workflowFactsWarning ? (
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
      ))}

      {rateOnlyMode && activeRevision && !isReadOnly ? (
        <section className="rounded-[28px] border border-blue-500/40 bg-blue-500/10 p-5 text-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">Final pricing</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Quantara prepared the measured BOQ</h3>
              <p className="mt-1 text-sm text-slate-300">Enter every unit rate, then generate the verified final BOQ. Quantities and source evidence remain read-only.</p>
              {missingRateCount > 0 ? <p className="mt-2 text-sm font-semibold text-amber-200">Finalization is blocked: {missingRateCount} zero or missing {missingRateCount === 1 ? "rate" : "rates"} remain.</p> : null}
              {verificationBlocked ? <p className="mt-2 text-sm font-semibold text-rose-200">Finalization is blocked by critical verification findings. Resolve only the affected evidence before locking.</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void generateFinalBoq()}
              disabled={actionInProgress || hasUnsavedChanges || !allRatesEntered || verificationBlocked}
              title={hasUnsavedChanges ? "Save every rate before generating the final BOQ." : !allRatesEntered ? "Enter a rate greater than zero for every item." : verificationBlocked ? "Resolve critical verification findings before finalization." : ""}
              className="shrink-0 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "lock" ? "Verifying…" : "Generate final BOQ"}
            </button>
          </div>
        </section>
      ) : null}

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
              {t("boqEditor.dismiss")}
            </button>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {showCreationSelector || (!activeRevision && revisions.length === 0) ? (
            <div
              id="boq-start-workflow"
              tabIndex={-1}
              className="rounded-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
            >
              <BoqStartWizard
                hasDrafts={revisions.some(r => !isReadOnlyBOQ(r))}
                onSelectMethod={handleCreationMethodSelect}
              />
            </div>
          ) : activeRevision ? (
            <div id="boq-editor-section" tabIndex={-1} className="min-w-0 rounded-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
            {rateOnlyMode ? (
              <RateOnlyBOQEditor
                boq={activeRevision}
                currency={project.currency}
                readOnly={isReadOnly}
                onBoqUpdated={replaceRevision}
                onDirtyChange={setHasUnsavedChanges}
              />
            ) : <BoqEditor
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
                  setActionError(t("boqEditor.saveBeforeAddingOrImporting"));
                  return;
                }
                setAddItemInitialTab("search");
                setShowAddItem(true);
              }}
              hasUnsavedChanges={hasUnsavedChanges}
              onVoiceApplied={replaceRevision}
            />}
            </div>
          ) : (
            <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
              <p className="text-lg font-semibold text-white">{t("boqEditor.noActiveRevision")}</p>
              <p className="mt-2 text-sm text-slate-400">{t("boqEditor.selectRevisionFromHistory")}</p>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("boqEditor.revisionHistory")}</p>
            <div className="mt-6 space-y-3">
              {revisions.map((boq) => (
                <button
                  key={boq.id}
                  type="button"
                  onClick={() => {
                    if (boq.id !== activeRevision?.id) {
                      if (hasUnsavedChanges) {
                        setActionError("Save the current rate changes before opening another revision.");
                        return;
                      }
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
                      {t(BOQ_STATUS_TRANSLATION_KEYS[boq.status])}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-400">{formatDate(boq.createdAt)}</p>
                  <p className="mt-2 text-white">{formatCurrency(boq.totals.grandTotal, project.currency)}</p>
                </button>
              ))}
              {revisions.length === 0 && (
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                  {t("boqEditor.noRevisionsAvailable")}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {!rateOnlyMode && showAddItem && activeRevision && (
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
