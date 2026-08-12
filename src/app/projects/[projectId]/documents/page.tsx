"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, use } from "react";
import type { BOQ } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import { computeDocumentReadiness } from "@/lib/workflow/document-readiness-state";
import { GuideTip } from "@/components/guidance/guide-tip";
import { CommercialUnlockPanel } from "@/components/commercial/commercial-unlock-panel";
import type { CommercialAccessDecision } from "@/lib/commercial/commercial-types";

type DocumentTemplateSummary = {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
};

type GeneratedDocumentView = {
  id: string;
  boqId: string;
  templateId: string;
  templateName: string;
  templateVersionNumber: number | null;
  revisionNumber: number;
  type: string;
  audience: string;
  status: string;
  isDraft: boolean;
  fileName: string | null;
  fileSize: number | null;
  generatedByName: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type VerificationSummary = {
  unresolvedCritical: number;
  unresolvedWarning: number;
};

const DOCUMENT_TYPES = ["CSV", "XLSX", "PDF", "DOCX", "HTML"] as const;
const FINAL_ONLY_TYPES = new Set(["PDF", "XLSX", "DOCX"]);

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectDocumentsPage(props: PageProps) {
  const params = use(props.params);
  const [project, setProject] = useState<Project | null>(null);
  const [boqs, setBoqs] = useState<BOQ[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [history, setHistory] = useState<GeneratedDocumentView[]>([]);
  const [verification, setVerification] = useState<VerificationSummary | null>(null);

  const [selectedBoqId, setSelectedBoqId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<(typeof DOCUMENT_TYPES)[number]>("PDF");
  const [selectedAudience, setSelectedAudience] = useState<"INTERNAL" | "CLIENT">("CLIENT");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Captures the BOQ id and verification snapshot at the moment the
  // confirmation panel opens, not the live selectedBoqId/verification —
  // otherwise switching the revision dropdown while the panel is open would
  // lock a different, un-reviewed revision, or show the wrong revision's
  // totals/verification counts in the confirmation itself.
  const [lockConfirmBoqId, setLockConfirmBoqId] = useState<string | null>(null);
  const [lockConfirmVerification, setLockConfirmVerification] = useState<VerificationSummary | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const encodedProjectId = encodeURIComponent(params.projectId);
      const [projectData, revisions, templateData, historyData] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<BOQ[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
        apiClient.get<DocumentTemplateSummary[]>("/api/templates", signal),
        apiClient.get<GeneratedDocumentView[]>(`/api/projects/${encodedProjectId}/documents`, signal),
      ]);
      setProject(projectData);
      setBoqs(revisions);
      setTemplates(templateData);
      setHistory(historyData);
      setSelectedBoqId((current) => current || revisions[0]?.id || "");
      setSelectedTemplateId((current) => current || templateData.find((t) => t.isDefault)?.id || templateData[0]?.id || "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!selectedBoqId) {
      setVerification(null);
      return;
    }
    const controller = new AbortController();
    apiClient
      .get<{ summary: VerificationSummary }>(`/api/boqs/${encodeURIComponent(selectedBoqId)}/verification`, controller.signal)
      .then((data) => setVerification(data.summary))
      .catch(() => setVerification(null));
    return () => controller.abort();
  }, [selectedBoqId]);

  const selectedBoq = useMemo(() => boqs.find((boq) => boq.id === selectedBoqId) ?? null, [boqs, selectedBoqId]);
  const isLockedRevision = Boolean(selectedBoq?.isLocked) || selectedBoq?.status === "locked" || selectedBoq?.status === "approved";
  const requiresLock = FINAL_ONLY_TYPES.has(selectedType) && !isLockedRevision;
  const blockedByCriticals = Boolean(verification && verification.unresolvedCritical > 0);
  const canGenerate = Boolean(selectedBoqId && selectedTemplateId && !requiresLock && !blockedByCriticals && !isGenerating);

  const readiness = useMemo(
    () => computeDocumentReadiness({ selectedBoq, isLockedRevision, verification, isGenerating }),
    [selectedBoq, isLockedRevision, verification, isGenerating],
  );

  const refreshHistory = useCallback(async () => {
    const data = await apiClient.get<GeneratedDocumentView[]>(`/api/projects/${encodeURIComponent(params.projectId)}/documents`);
    setHistory(data);
  }, [params.projectId]);

  const refreshBoqs = useCallback(async () => {
    const revisions = await apiClient.get<BOQ[]>(`/api/projects/${encodeURIComponent(params.projectId)}/boqs`);
    setBoqs(revisions);
  }, [params.projectId]);

  const confirmLock = useCallback(async () => {
    if (!lockConfirmBoqId) return;
    setIsLocking(true);
    setLockError(null);
    try {
      await apiClient.post(`/api/boqs/${encodeURIComponent(lockConfirmBoqId)}/lock`, {});
      setLockConfirmBoqId(null);
      setLockConfirmVerification(null);
      await refreshBoqs();
      if (lockConfirmBoqId === selectedBoqId) {
        const data = await apiClient.get<{ summary: VerificationSummary }>(`/api/boqs/${encodeURIComponent(lockConfirmBoqId)}/verification`);
        setVerification(data.summary);
      }
    } catch (error) {
      // Server remains authoritative — if it finds a new blocker (e.g. a critical
      // exception introduced since this page loaded), surface it exactly as returned.
      setLockError(getApiErrorMessage(error));
    } finally {
      setIsLocking(false);
    }
  }, [lockConfirmBoqId, refreshBoqs, selectedBoqId]);

  const [commercialDecision, setCommercialDecision] = useState<{ boqId: string; decision: CommercialAccessDecision } | null>(null);

  const generate = useCallback(async (overrides?: Partial<{ boqId: string; templateId: string; type: string; audience: string }>) => {
    const boqId = overrides?.boqId ?? selectedBoqId;
    const type = overrides?.type ?? selectedType;
    setGenerateError(null);
    setCommercialDecision(null);

    // CANVA-MODEL-1 — the clean final export is the only place commercial
    // requirements are ever checked. Draft CSV/HTML always proceed; PDF/
    // XLSX/DOCX (final-only) check the BOQ's real commercial manifest first
    // and show the unlock screen instead of a generic error if unmet.
    if (boqId && FINAL_ONLY_TYPES.has(type)) {
      try {
        const decision = await apiClient.get<CommercialAccessDecision>(`/api/boqs/${encodeURIComponent(boqId)}/commercial-requirements`);
        if (decision.status !== "ALLOW") {
          // Regenerate (overrides.boqId) can target a different BOQ than
          // selectedBoqId — track the id the decision was actually resolved
          // for, so the panel's checkout request stays aligned with the
          // manifest fingerprint instead of silently using the wrong BOQ.
          setCommercialDecision({ boqId, decision });
          return;
        }
      } catch (error) {
        setGenerateError(getApiErrorMessage(error));
        return;
      }
    }

    setIsGenerating(true);
    try {
      await apiClient.post(`/api/projects/${encodeURIComponent(params.projectId)}/documents/generate`, {
        boqId,
        templateId: overrides?.templateId ?? selectedTemplateId,
        documentType: type,
        audience: overrides?.audience ?? selectedAudience,
      });
      await refreshHistory();
    } catch (error) {
      setGenerateError(getApiErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }, [params.projectId, refreshHistory, selectedAudience, selectedBoqId, selectedTemplateId, selectedType]);

  const deleteDocument = useCallback(async (documentId: string) => {
    setDeletingId(documentId);
    setGenerateError(null);
    try {
      await apiClient.delete(`/api/documents/${encodeURIComponent(documentId)}`);
      await refreshHistory();
    } catch (error) {
      setGenerateError(getApiErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }, [refreshHistory]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading document workspace</p>
        <p className="mt-2 text-sm text-slate-400">Fetching project revisions, templates, and generation history.</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Documents unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This project could not be loaded."}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Documents</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{project.name} document package</h2>
        <p className="mt-3 text-slate-400">Generate client-ready and internal BOQ documents from a fixed revision.</p>
        <Link
          href={`/projects/${params.projectId}/documents/preview?boqId=${selectedBoqId}&templateId=${selectedTemplateId}&audience=${selectedAudience}`}
          className="mt-4 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Open printable preview
        </Link>
      </div>

      {generateError && (
        <div className="rounded-[28px] border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{generateError}</p>
            <button type="button" onClick={() => setGenerateError(null)} className="rounded-2xl border border-rose-800 px-3 py-2 font-semibold hover:bg-rose-900/40">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h3 className="text-xl font-semibold text-white">Generation history</h3>
          <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Revision</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((doc) => (
                  <tr key={doc.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-semibold text-white">{doc.type}</td>
                    <td className="px-4 py-3">
                      R{String(doc.revisionNumber).padStart(2, "0")}
                      {doc.isDraft && <span className="ml-2 rounded-full bg-amber-950/60 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-amber-300">draft</span>}
                    </td>
                    <td className="px-4 py-3">
                      {doc.templateName}
                      {doc.templateVersionNumber !== null && (
                        <span className="ml-1.5 text-xs text-slate-500">v{doc.templateVersionNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{doc.audience}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          doc.status === "COMPLETED"
                            ? "text-emerald-300"
                            : doc.status === "FAILED"
                              ? "text-rose-300"
                              : "text-slate-400"
                        }
                      >
                        {doc.status}
                      </span>
                      {doc.errorMessage && <p className="mt-1 max-w-[200px] text-xs text-rose-400">{doc.errorMessage}</p>}
                    </td>
                    <td className="px-4 py-3">{formatFileSize(doc.fileSize)}</td>
                    <td className="px-4 py-3">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3">{doc.generatedByName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {doc.status === "COMPLETED" && (
                          <a
                            href={`/api/documents/${encodeURIComponent(doc.id)}/download`}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                          >
                            Download
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void generate({ boqId: doc.boqId, templateId: doc.templateId, type: doc.type, audience: doc.audience })}
                          disabled={isGenerating}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDocument(doc.id)}
                          disabled={deletingId === doc.id}
                          className="rounded-xl border border-rose-900 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === doc.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      No documents have been generated for this project yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Generate a document</p>

            <label className="mt-5 block text-sm text-slate-300">
              <span className="text-slate-400">Revision</span>
              <select
                value={selectedBoqId}
                onChange={(event) => setSelectedBoqId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {boqs.map((boq) => (
                  <option key={boq.id} value={boq.id}>
                    {boq.revision} · {boq.status}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Template</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}{template.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Format</span>
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value as (typeof DOCUMENT_TYPES)[number])}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Audience</span>
              <select
                value={selectedAudience}
                onChange={(event) => setSelectedAudience(event.target.value as "INTERNAL" | "CLIENT")}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                <option value="CLIENT">Client-facing</option>
                <option value="INTERNAL">Internal</option>
              </select>
            </label>

            <div
              role="status"
              className={`mt-4 rounded-2xl border p-4 text-xs ${
                readiness.state === "LOCKED_READY"
                  ? "border-emerald-900 bg-emerald-950/30 text-emerald-300"
                  : readiness.state === "DRAFT_HAS_CRITICALS"
                    ? "border-rose-900 bg-rose-950/30 text-rose-300"
                    : "border-amber-900 bg-amber-950/30 text-amber-300"
              }`}
            >
              <p className="font-semibold uppercase tracking-[0.18em]">{readiness.state.replace(/_/g, " ")}</p>
              <p className="mt-2 text-slate-300">{readiness.why}</p>
              {FINAL_ONLY_TYPES.has(selectedType) && readiness.state !== "LOCKED_READY" && readiness.state !== "GENERATING" && (
                <p className="mt-2 text-slate-400">
                  Draft export in CSV or HTML remains available now — switch Format above.
                </p>
              )}
            </div>

            {readiness.state === "DRAFT_READY_TO_LOCK" && !lockConfirmBoqId && (
              <button
                type="button"
                onClick={() => { setLockConfirmBoqId(selectedBoqId); setLockConfirmVerification(verification); }}
                className="mt-4 w-full rounded-2xl border border-blue-700 bg-blue-950/40 px-4 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-900/40"
              >
                Review & lock revision
              </button>
            )}

            {(readiness.state === "DRAFT_UNVALIDATED" || readiness.state === "DRAFT_HAS_CRITICALS") && (
              <Link
                href={`/projects/${params.projectId}/verification`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                {readiness.nextActionLabel}
              </Link>
            )}

            {readiness.state === "NO_BOQ" && (
              <Link
                href={`/projects/${params.projectId}/boq`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Open BOQ
              </Link>
            )}

            {lockConfirmBoqId && (() => {
              const lockConfirmBoq = boqs.find((boq) => boq.id === lockConfirmBoqId);
              if (!lockConfirmBoq) return null;
              return (
              <div className="mt-4 rounded-2xl border border-blue-800 bg-blue-950/20 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">Lock {lockConfirmBoq.revision}?</p>
                <dl className="mt-3 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between"><dt>Grand total</dt><dd className="text-slate-200">{lockConfirmBoq.totals.grandTotal.toLocaleString()}</dd></div>
                  <div className="flex justify-between"><dt>Unresolved critical</dt><dd className="text-slate-200">{lockConfirmVerification?.unresolvedCritical ?? "—"}</dd></div>
                  <div className="flex justify-between"><dt>Unresolved warning</dt><dd className="text-slate-200">{lockConfirmVerification?.unresolvedWarning ?? "—"}</dd></div>
                </dl>
                <p className="mt-3 rounded-xl border border-amber-900 bg-amber-950/30 p-2 text-xs text-amber-300">
                  Locked revisions are immutable. This cannot be undone from this workspace.
                </p>
                {lockError && <p className="mt-2 text-xs text-rose-300" role="alert">{lockError}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setLockConfirmBoqId(null); setLockConfirmVerification(null); setLockError(null); }}
                    disabled={isLocking}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmLock()}
                    disabled={isLocking}
                    className="flex-1 rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLocking ? "Locking…" : "Confirm lock"}
                  </button>
                </div>
              </div>
              );
            })()}

            {commercialDecision && (
              <div className="mt-6">
                <CommercialUnlockPanel
                  boqId={commercialDecision.boqId}
                  decision={commercialDecision.decision}
                  onWorkSaved={() => setGenerateError(null)}
                />
                <button
                  type="button"
                  onClick={() => setCommercialDecision(null)}
                  className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  ← Back to my BOQ
                </button>
              </div>
            )}

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={!canGenerate}
                className="flex-1 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "Generating…" : "Generate document"}
              </button>
              <GuideTip
                title="Generate document"
                shortDescription="Creates a real document file from this exact BOQ revision and template."
                whatQuantaraDoes="Quantara renders the selected format from this revision and adds it to the generation history below — PDF, XLSX, and DOCX use the revision's locked totals; CSV and HTML drafts use its current totals, locked or not."
                whatProfessionalCanDo="PDF, XLSX, and DOCX require a locked revision. CSV and HTML drafts are available any time — switch Format above to try one now."
                ariaLabel="Help: Generate document"
              />
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Verification status</p>
            {verification ? (
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>Unresolved critical: <span className="font-semibold text-white">{verification.unresolvedCritical}</span></p>
                <p>Unresolved warning: <span className="font-semibold text-white">{verification.unresolvedWarning}</span></p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Select a revision to view its verification status.</p>
            )}
            <Link
              href={`/projects/${params.projectId}/verification`}
              className="mt-4 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Open verification workspace
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
