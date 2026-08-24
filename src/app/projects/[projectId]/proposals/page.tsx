"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import type { ClientProposalStatus } from "@prisma/client";
import type { BOQ } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { TranslateFn } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { getLocalizedApiErrorMessage } from "@/lib/i18n/api-error-message";

type DocumentSummary = {
  id: string;
  type: string;
  audience: string;
  status: string;
  fileName: string | null;
  boqId: string | null;
  revisionNumber: number | null;
};

type TechnicalReportSummary = {
  id: string;
  name: string;
  status: "DRAFT" | "COMPLETED";
  templateName: string;
  documentType: string | null;
  fileName: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  updatedAt: string;
};

type ProposalSummary = {
  id: string;
  sourceType: "BOQ_REVISION" | "TECHNICAL_REPORT_REVISION";
  revisionNumber: number | null;
  recipientEmail: string;
  recipientName: string;
  status: ClientProposalStatus;
  expiresAt: string;
  createdAt: string;
};

type ProposalType = "BOQ_REVISION" | "TECHNICAL_REPORT_REVISION";
type WizardStep = "TYPE" | "SOURCE" | "ACCESS" | "REVIEW";

const STATUS_COLORS: Record<string, string> = {
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

/** Maps the server's specific error codes (see client-proposal-service.ts) to an actionable message. */
function friendlyError(error: unknown, t: TranslateFn, locale: Locale): string {
  if (error instanceof ApiClientError) {
    const errorMessages: Record<string, string> = {
      PROPOSAL_TYPE_REQUIRED: t("proposals.errorTypeRequired"),
      PROPOSAL_SOURCE_REQUIRED: t("proposals.errorSourceRequired"),
      BOQ_REVISION_NOT_LOCKED: t("proposals.errorRevisionNotLocked"),
      REPORT_REVISION_NOT_FINAL: t("proposals.errorReportNotFinal"),
      GENERATED_DOCUMENT_REQUIRED: t("proposals.errorDocumentRequired"),
      GENERATED_DOCUMENT_SOURCE_MISMATCH: t("proposals.errorDocumentMismatch"),
      PROPOSAL_RECIPIENT_INVALID: t("proposals.errorRecipientInvalid"),
      PROPOSAL_EXPIRY_INVALID: t("proposals.errorExpiryInvalid"),
      PROPOSAL_CREATION_FAILED: t("proposals.errorCreationFailed"),
    };
    if (errorMessages[error.code]) return errorMessages[error.code];
  }
  return getLocalizedApiErrorMessage(error, t, locale);
}

function isLockedBoq(boq: BOQ): boolean {
  return Boolean(boq.isLocked) || boq.status === "locked" || boq.status === "approved";
}

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectProposalsPage(props: PageProps) {
  const params = use(props.params);
  const { locale, t } = useLocale();
  const localizationRef = useRef({ locale, t });
  localizationRef.current = { locale, t };
  const STEPS: { key: WizardStep; label: string }[] = [
    { key: "TYPE", label: t("proposals.stepType") },
    { key: "SOURCE", label: t("proposals.stepSource") },
    { key: "ACCESS", label: t("proposals.stepAccess") },
    { key: "REVIEW", label: t("proposals.stepReview") },
  ];
  const STATUS_LABELS: Record<ClientProposalStatus, string> = {
    DRAFT: t("proposals.statusDraft"),
    READY: t("proposals.statusReady"),
    SENT: t("proposals.statusSent"),
    OPENED: t("proposals.statusOpened"),
    COMMENTED: t("proposals.statusCommented"),
    REVISION_REQUESTED: t("proposals.statusRevisionRequested"),
    APPROVED: t("proposals.statusApproved"),
    REJECTED: t("proposals.statusRejected"),
    REVOKED: t("proposals.statusRevoked"),
    EXPIRED: t("proposals.statusExpired"),
  };
  const [project, setProject] = useState<Project | null>(null);
  const [boqs, setBoqs] = useState<BOQ[]>([]);
  const [reports, setReports] = useState<TechnicalReportSummary[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<WizardStep>("TYPE");
  const [proposalType, setProposalType] = useState<ProposalType | null>(null);

  // BOQ source state
  const [selectedBoqId, setSelectedBoqId] = useState("");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [lockingBoqId, setLockingBoqId] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  // Technical report source state
  const [selectedReportId, setSelectedReportId] = useState("");
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Shared access/recipient state
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [allowOptionSelection, setAllowOptionSelection] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [allowDocumentDownload, setAllowDocumentDownload] = useState(true);
  const [requireAccessPasscode, setRequireAccessPasscode] = useState(false);
  const [accessPasscode, setAccessPasscode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const encodedProjectId = encodeURIComponent(params.projectId);
      const [projectData, revisions, reportData, proposalData] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<BOQ[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
        apiClient.get<TechnicalReportSummary[]>(`/api/projects/${encodedProjectId}/technical-reports`, signal),
        apiClient.get<ProposalSummary[]>(`/api/projects/${encodedProjectId}/proposals`, signal),
      ]);
      setProject(projectData);
      setBoqs(revisions);
      setReports(reportData);
      setProposals(proposalData);
      setRecipientName((current) => current || projectData.clientName);
      setRecipientEmail((current) => current || projectData.clientEmail);
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
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadDocuments = useCallback((signal?: AbortSignal) => {
    return apiClient
      .get<DocumentSummary[]>(`/api/projects/${encodeURIComponent(params.projectId)}/documents`, signal)
      .then((docs) => setDocuments(docs.filter((doc) => doc.audience === "CLIENT" && doc.status === "COMPLETED")))
      .catch(() => setDocuments([]));
  }, [params.projectId]);

  useEffect(() => {
    if (!showCreate || proposalType !== "BOQ_REVISION") return;
    const controller = new AbortController();
    void loadDocuments(controller.signal);
    return () => controller.abort();
  }, [showCreate, proposalType, loadDocuments]);

  const refreshBoqs = useCallback(async () => {
    const revisions = await apiClient.get<BOQ[]>(`/api/projects/${encodeURIComponent(params.projectId)}/boqs`);
    setBoqs(revisions);
    return revisions;
  }, [params.projectId]);

  const refreshReports = useCallback(async () => {
    const reportData = await apiClient.get<TechnicalReportSummary[]>(`/api/projects/${encodeURIComponent(params.projectId)}/technical-reports`);
    setReports(reportData);
    return reportData;
  }, [params.projectId]);

  const lockedBoqs = useMemo(() => boqs.filter(isLockedBoq), [boqs]);
  const draftBoqs = useMemo(() => boqs.filter((boq) => !isLockedBoq(boq)), [boqs]);
  const selectedBoq = useMemo(() => boqs.find((boq) => boq.id === selectedBoqId) ?? null, [boqs, selectedBoqId]);
  const boqDocuments = useMemo(
    () => documents.filter((doc) => doc.boqId === selectedBoqId),
    [documents, selectedBoqId],
  );

  const completedReports = useMemo(() => reports.filter((report) => report.status === "COMPLETED"), [reports]);
  const notReadyReports = useMemo(() => reports.filter((report) => report.status !== "COMPLETED"), [reports]);
  const selectedReport = useMemo(() => reports.find((report) => report.id === selectedReportId) ?? null, [reports, selectedReportId]);

  const resetWizard = useCallback(() => {
    setStep("TYPE");
    setProposalType(null);
    setSelectedBoqId("");
    setSelectedDocumentIds([]);
    setSelectedReportId("");
    setLockError(null);
    setGenerateError(null);
    setCreateError(null);
    setAllowOptionSelection(true);
    setAllowComments(true);
    setAllowDocumentDownload(true);
    setRequireAccessPasscode(false);
    setAccessPasscode("");
    setExpiresInDays(30);
  }, []);

  const openCreate = useCallback(() => {
    resetWizard();
    setShowCreate(true);
  }, [resetWizard]);

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    resetWizard();
  }, [resetWizard]);

  const toggleDocument = useCallback((id: string) => {
    setSelectedDocumentIds((current) => (current.includes(id) ? current.filter((docId) => docId !== id) : [...current, id]));
  }, []);

  const lockAndContinue = useCallback(async (boqId: string) => {
    setLockingBoqId(boqId);
    setLockError(null);
    try {
      await apiClient.post(`/api/boqs/${encodeURIComponent(boqId)}/lock`, {});
      const revisions = await refreshBoqs();
      setSelectedBoqId(boqId);
      await loadDocuments();
      const nowLocked = revisions.find((boq) => boq.id === boqId);
      if (nowLocked && isLockedBoq(nowLocked)) setStep("SOURCE");
    } catch (error) {
      setLockError(friendlyError(error, t, locale));
    } finally {
      setLockingBoqId(null);
    }
  }, [locale, refreshBoqs, loadDocuments, t]);

  const generateAndContinue = useCallback(async (reportId: string) => {
    setGeneratingReportId(reportId);
    setGenerateError(null);
    try {
      await apiClient.post(`/api/technical-reports/${encodeURIComponent(reportId)}/generate`, { documentType: "DOCX" });
      await refreshReports();
      setSelectedReportId(reportId);
    } catch (error) {
      setGenerateError(friendlyError(error, t, locale));
    } finally {
      setGeneratingReportId(null);
    }
  }, [locale, refreshReports, t]);

  const canContinueFromSource =
    proposalType === "BOQ_REVISION"
      ? Boolean(selectedBoqId) && isLockedBoq(selectedBoq!) && selectedDocumentIds.length > 0
      : proposalType === "TECHNICAL_REPORT_REVISION"
        ? Boolean(selectedReportId) && selectedReport?.status === "COMPLETED"
        : false;

  const canCreate =
    !isCreating &&
    Boolean(proposalType) &&
    canContinueFromSource &&
    Boolean(recipientEmail.trim()) &&
    Boolean(recipientName.trim()) &&
    expiresInDays >= 1 &&
    expiresInDays <= 365 &&
    (!requireAccessPasscode || accessPasscode.trim().length >= 4);

  const createProposal = useCallback(async () => {
    if (!proposalType) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const settings = {
        allowComments,
        allowDocumentDownload,
        requireAccessPasscode,
        ...(proposalType === "BOQ_REVISION" ? { allowOptionSelection } : {}),
        ...(requireAccessPasscode && accessPasscode ? { accessPasscode } : {}),
      };
      const body =
        proposalType === "BOQ_REVISION"
          ? {
              sourceType: "BOQ_REVISION" as const,
              boqId: selectedBoqId,
              recipientEmail,
              recipientName,
              expiresInDays,
              documentIds: selectedDocumentIds,
              settings,
            }
          : {
              sourceType: "TECHNICAL_REPORT_REVISION" as const,
              technicalReportId: selectedReportId,
              recipientEmail,
              recipientName,
              expiresInDays,
              settings,
            };
      const result = await apiClient.post<{
        proposal: { id: string };
        rawToken: string | null;
        secureUrl: string | null;
        isExisting: boolean;
      }>(`/api/projects/${encodeURIComponent(params.projectId)}/proposals`, body);
      if (result.rawToken) {
        window.sessionStorage.setItem(
          `proposal-token:${result.proposal.id}`,
          JSON.stringify({ rawToken: result.rawToken, secureUrl: result.secureUrl }),
        );
      }
      window.location.href = `/projects/${params.projectId}/proposals/${result.proposal.id}`;
    } catch (error) {
      setCreateError(friendlyError(error, t, locale));
    } finally {
      setIsCreating(false);
    }
  }, [
    accessPasscode,
    allowComments,
    allowDocumentDownload,
    allowOptionSelection,
    expiresInDays,
    locale,
    params.projectId,
    proposalType,
    recipientEmail,
    recipientName,
    requireAccessPasscode,
    selectedBoqId,
    selectedDocumentIds,
    selectedReportId,
    t,
  ]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("proposals.loadingList")}</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("proposals.listUnavailable")}</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? t("proposals.projectCouldNotLoad")}</p>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("proposals.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{project.name}</h2>
            <p className="mt-3 text-slate-400">{t("proposals.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {t("proposals.createProposal")}
          </button>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-4 py-3">{t("proposals.colType")}</th>
                <th className="px-4 py-3">{t("proposals.colSource")}</th>
                <th className="px-4 py-3">{t("proposals.colRecipient")}</th>
                <th className="px-4 py-3">{t("proposals.colStatus")}</th>
                <th className="px-4 py-3">{t("proposals.colExpires")}</th>
                <th className="px-4 py-3">{t("proposals.colCreated")}</th>
                <th className="px-4 py-3">{t("proposals.colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">{proposal.sourceType === "BOQ_REVISION" ? t("proposals.sourceBoq") : t("proposals.sourceReport")}</td>
                  <td className="px-4 py-3">{proposal.revisionNumber ? `R${String(proposal.revisionNumber).padStart(2, "0")}` : "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-white">{proposal.recipientName}</p>
                    <p className="text-xs text-slate-500">{proposal.recipientEmail}</p>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${STATUS_COLORS[proposal.status] ?? "text-slate-300"}`}>{STATUS_LABELS[proposal.status]}</td>
                  <td className="px-4 py-3">{formatDate(proposal.expiresAt)}</td>
                  <td className="px-4 py-3">{formatDate(proposal.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${params.projectId}/proposals/${proposal.id}`}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      {t("proposals.open")}
                    </Link>
                  </td>
                </tr>
              ))}
              {proposals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {t("proposals.noProposalsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h3 className="text-xl font-semibold text-white">{t("proposals.modalTitle")}</h3>

            <ol className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {STEPS.map((s, index) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      index <= currentStepIndex ? "border-blue-500 bg-blue-600 text-white" : "border-slate-700 bg-slate-900 text-slate-500"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={index <= currentStepIndex ? "text-slate-200" : ""}>{s.label}</span>
                  {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-800" />}
                </li>
              ))}
            </ol>

            {/* Step 1 — Choose Proposal Type */}
            {step === "TYPE" && (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => { setProposalType("BOQ_REVISION"); setStep("SOURCE"); }}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-blue-500"
                >
                  <p className="text-base font-semibold text-white">{t("proposals.createBoqProposal")}</p>
                  <p className="mt-1 text-sm text-slate-400">{t("proposals.createBoqProposalDescription")}</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setProposalType("TECHNICAL_REPORT_REVISION"); setStep("SOURCE"); }}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-blue-500"
                >
                  <p className="text-base font-semibold text-white">{t("proposals.createReportProposal")}</p>
                  <p className="mt-1 text-sm text-slate-400">{t("proposals.createReportProposalDescription")}</p>
                </button>
              </div>
            )}

            {/* Step 2 — Choose Source */}
            {step === "SOURCE" && proposalType === "BOQ_REVISION" && (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">{t("proposals.lockedBoqRevision")}</p>
                  {lockedBoqs.length === 0 && <p className="mt-2 text-xs text-slate-500">{t("proposals.noLockedRevisionsYet")}</p>}
                  <div className="mt-2 space-y-2">
                    {lockedBoqs.map((boq) => (
                      <label
                        key={boq.id}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                          selectedBoqId === boq.id ? "border-blue-500 bg-slate-900" : "border-slate-800 bg-slate-900/60"
                        }`}
                      >
                        <span className="text-slate-200">{t("proposals.revisionLockedLabel", { revision: boq.revision })}</span>
                        <input
                          type="radio"
                          name="boq-source"
                          checked={selectedBoqId === boq.id}
                          onChange={() => { setSelectedBoqId(boq.id); setSelectedDocumentIds([]); }}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {draftBoqs.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-400">{t("proposals.notYetAvailable")}</p>
                    <div className="mt-2 space-y-2">
                      {draftBoqs.map((boq) => (
                        <div key={boq.id} className="flex items-center justify-between rounded-2xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-sm">
                          <div>
                            <span className="text-amber-200">{t("proposals.revisionDraftLockAction", { revision: boq.revision })}</span>
                            {!boq.finalization?.lockEligible && (
                              <p className="mt-1 text-xs text-amber-300/80">
                                {boq.finalization?.lockReason === "VERIFICATION_STALE" || boq.finalization?.lockReason === "VERIFICATION_REQUIRED"
                                  ? "Re-run verification for this revision before locking."
                                  : boq.finalization?.lockReason === "UNRESOLVED_CRITICAL_EXCEPTIONS"
                                    ? `${boq.finalization.unresolvedCritical} critical verification issue(s) must be resolved first.`
                                    : boq.finalization?.lockReason === "ESTIMATE_INTEGRITY_REQUIRED"
                                      ? `${boq.finalization.unconfirmedItemCount} item(s) still need confirmed quantity and rate evidence.`
                                      : "This revision is not eligible to lock."}
                              </p>
                            )}
                          </div>
                          {boq.finalization?.lockEligible ? (
                            <button
                              type="button"
                              onClick={() => void lockAndContinue(boq.id)}
                              disabled={lockingBoqId === boq.id}
                              className="rounded-xl border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/70 disabled:opacity-50"
                            >
                              {lockingBoqId === boq.id ? t("proposals.locking") : t("proposals.lockAndContinue")}
                            </button>
                          ) : (
                            <Link
                              href={`/projects/${params.projectId}/verification`}
                              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                            >
                              Review verification
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                    {lockError && <p className="mt-2 text-xs text-rose-300">{lockError}</p>}
                  </div>
                )}

                {selectedBoqId && isLockedBoq(selectedBoq!) && (
                  <div>
                    <p className="text-sm text-slate-400">{t("proposals.generatedBoqDocument")}</p>
                    {boqDocuments.length === 0 && (
                      <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
                        {t("proposals.noClientDocumentYet")}
                        <Link
                          href={`/projects/${params.projectId}/documents`}
                          className="mt-2 block w-fit rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800"
                        >
                          {t("proposals.generateBoqDocument")}
                        </Link>
                      </div>
                    )}
                    <div className="mt-2 space-y-2">
                      {boqDocuments.map((doc) => (
                        <label key={doc.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                          <span>{t("proposals.documentRow", { type: doc.type, fileName: doc.fileName ?? t("proposals.documentFallbackName") })}</span>
                          <input type="checkbox" checked={selectedDocumentIds.includes(doc.id)} onChange={() => toggleDocument(doc.id)} className="h-4 w-4" />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === "SOURCE" && proposalType === "TECHNICAL_REPORT_REVISION" && (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">{t("proposals.completedTechnicalReport")}</p>
                  {completedReports.length === 0 && <p className="mt-2 text-xs text-slate-500">{t("proposals.noCompletedReportsYet")}</p>}
                  <div className="mt-2 space-y-2">
                    {completedReports.map((report) => (
                      <label
                        key={report.id}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                          selectedReportId === report.id ? "border-blue-500 bg-slate-900" : "border-slate-800 bg-slate-900/60"
                        }`}
                      >
                        <span className="text-slate-200">{t("proposals.reportCompletedLabel", { name: report.name, template: report.templateName })}</span>
                        <input
                          type="radio"
                          name="report-source"
                          checked={selectedReportId === report.id}
                          onChange={() => setSelectedReportId(report.id)}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {notReadyReports.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-400">{t("proposals.notYetAvailable")}</p>
                    <div className="mt-2 space-y-2">
                      {notReadyReports.map((report) => (
                        <div key={report.id} className="flex items-center justify-between rounded-2xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-sm">
                          <span className="text-amber-200">{t("proposals.reportDraftGenerateAction", { name: report.name })}</span>
                          <button
                            type="button"
                            onClick={() => void generateAndContinue(report.id)}
                            disabled={generatingReportId === report.id}
                            className="rounded-xl border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/70 disabled:opacity-50"
                          >
                            {generatingReportId === report.id ? t("proposals.generatingDocument") : t("proposals.generateClientDocument")}
                          </button>
                        </div>
                      ))}
                    </div>
                    {generateError && <p className="mt-2 text-xs text-rose-300">{generateError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Recipient and Access */}
            {step === "ACCESS" && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm text-slate-300">
                    <span className="text-slate-400">{t("proposals.recipientName")}</span>
                    <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="text-slate-400">{t("proposals.recipientEmail")}</span>
                    <input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
                  </label>
                </div>

                <label className="block text-sm text-slate-300">
                  <span className="text-slate-400">{t("proposals.expiryDays")}</span>
                  <input type="number" min={1} max={365} value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
                </label>

                <div className="space-y-2">
                  {proposalType === "BOQ_REVISION" && (
                    <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                      <span>{t("proposals.allowOptionSelection")}</span>
                      <input type="checkbox" checked={allowOptionSelection} onChange={(event) => setAllowOptionSelection(event.target.checked)} className="h-4 w-4" />
                    </label>
                  )}
                  <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                    <span>{t("proposals.allowComments")}</span>
                    <input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                    <span>{t("proposals.allowDocumentDownload")}</span>
                    <input type="checkbox" checked={allowDocumentDownload} onChange={(event) => setAllowDocumentDownload(event.target.checked)} className="h-4 w-4" />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                    <span>{t("proposals.requireAccessPasscode")}</span>
                    <input type="checkbox" checked={requireAccessPasscode} onChange={(event) => setRequireAccessPasscode(event.target.checked)} className="h-4 w-4" />
                  </label>
                  {requireAccessPasscode && (
                    <input
                      value={accessPasscode}
                      onChange={(event) => setAccessPasscode(event.target.value)}
                      placeholder={t("proposals.passcodePlaceholder")}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Step 4 — Review and Create */}
            {step === "REVIEW" && (
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p><span className="text-slate-500">{t("proposals.reviewType")}</span> {proposalType === "BOQ_REVISION" ? t("proposals.boqProposalType") : t("proposals.reportProposalType")}</p>
                  <p><span className="text-slate-500">{t("proposals.reviewProject")}</span> {project.name}</p>
                  {proposalType === "BOQ_REVISION" ? (
                    <>
                      <p><span className="text-slate-500">{t("proposals.reviewBoqRevision")}</span> {selectedBoq?.revision}</p>
                      <p><span className="text-slate-500">{t("proposals.reviewDocument")}</span> {boqDocuments.filter((d) => selectedDocumentIds.includes(d.id)).map((d) => d.fileName ?? d.type).join(", ") || "—"}</p>
                    </>
                  ) : (
                    <>
                      <p><span className="text-slate-500">{t("proposals.reviewTechnicalReport")}</span> {selectedReport?.name}</p>
                      <p><span className="text-slate-500">{t("proposals.reviewDocument")}</span> {selectedReport?.fileName ?? "—"}</p>
                    </>
                  )}
                  <p><span className="text-slate-500">{t("proposals.reviewRecipient")}</span> {recipientName} ({recipientEmail})</p>
                  <p><span className="text-slate-500">{t("proposals.reviewExpiry")}</span> {t("proposals.reviewExpiryDays", { days: expiresInDays })}</p>
                  {proposalType === "BOQ_REVISION" && <p><span className="text-slate-500">{t("proposals.reviewOptionSelection")}</span> {allowOptionSelection ? t("proposals.reviewAllowed") : t("proposals.reviewNotAllowed")}</p>}
                  <p><span className="text-slate-500">{t("proposals.reviewComments")}</span> {allowComments ? t("proposals.reviewAllowed") : t("proposals.reviewNotAllowed")}</p>
                  <p><span className="text-slate-500">{t("proposals.reviewDownloads")}</span> {allowDocumentDownload ? t("proposals.reviewAllowed") : t("proposals.reviewNotAllowed")}</p>
                  <p><span className="text-slate-500">{t("proposals.reviewPasscode")}</span> {requireAccessPasscode ? t("proposals.reviewRequired") : t("proposals.reviewNotRequired")}</p>
                </div>
                {createError && <p className="rounded-2xl border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{createError}</p>}
              </div>
            )}

            <div className="mt-6 flex justify-between gap-3">
              <button type="button" onClick={closeCreate} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                {t("common.cancel")}
              </button>
              <div className="flex gap-3">
                {step !== "TYPE" && (
                  <button
                    type="button"
                    onClick={() => setStep(STEPS[currentStepIndex - 1].key)}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    {t("common.back")}
                  </button>
                )}
                {step !== "REVIEW" && step !== "TYPE" && (
                  <button
                    type="button"
                    onClick={() => setStep(STEPS[currentStepIndex + 1].key)}
                    disabled={step === "SOURCE" && !canContinueFromSource}
                    className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("common.continue")}
                  </button>
                )}
                {step === "REVIEW" && (
                  <button
                    type="button"
                    onClick={() => void createProposal()}
                    disabled={!canCreate}
                    className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreating ? t("proposals.creatingProposal") : t("proposals.createProposalSubmit")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
