"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, use } from "react";
import type { BOQ } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type DocumentSummary = { id: string; type: string; audience: string; status: string; fileName: string | null };
type ProposalSummary = {
  id: string;
  revisionNumber: number;
  recipientEmail: string;
  recipientName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

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

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectProposalsPage(props: PageProps) {
  const params = use(props.params);
  const [project, setProject] = useState<Project | null>(null);
  const [boqs, setBoqs] = useState<BOQ[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedBoqId, setSelectedBoqId] = useState("");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
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
      const [projectData, revisions, proposalData] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<BOQ[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
        apiClient.get<ProposalSummary[]>(`/api/projects/${encodedProjectId}/proposals`, signal),
      ]);
      setProject(projectData);
      setBoqs(revisions);
      setProposals(proposalData);
      const lockedRevision = revisions.find((boq) => boq.isLocked || boq.status === "locked" || boq.status === "approved");
      setSelectedBoqId((current) => current || lockedRevision?.id || "");
      setRecipientName((current) => current || projectData.clientName);
      setRecipientEmail((current) => current || projectData.clientEmail);
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
    if (!showCreate) return;
    const controller = new AbortController();
    apiClient
      .get<DocumentSummary[]>(`/api/projects/${encodeURIComponent(params.projectId)}/documents`, controller.signal)
      .then((docs) => {
        const clientFacing = docs.filter((doc) => doc.audience === "CLIENT" && doc.status === "COMPLETED");
        setDocuments(clientFacing);
      })
      .catch(() => setDocuments([]));
    return () => controller.abort();
  }, [showCreate, params.projectId]);

  const selectedBoq = useMemo(() => boqs.find((boq) => boq.id === selectedBoqId) ?? null, [boqs, selectedBoqId]);
  const isLockedRevision = Boolean(selectedBoq?.isLocked) || selectedBoq?.status === "locked" || selectedBoq?.status === "approved";

  const toggleDocument = useCallback((id: string) => {
    setSelectedDocumentIds((current) => (current.includes(id) ? current.filter((docId) => docId !== id) : [...current, id]));
  }, []);

  const createProposal = useCallback(async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const result = await apiClient.post<{
        proposal: { id: string };
        rawToken: string | null;
        secureUrl: string | null;
        isExisting: boolean;
      }>(`/api/projects/${encodeURIComponent(params.projectId)}/proposals`, {
        boqId: selectedBoqId,
        recipientEmail,
        recipientName,
        expiresInDays,
        documentIds: selectedDocumentIds,
        settings: {
          allowOptionSelection,
          allowComments,
          allowDocumentDownload,
          requireAccessPasscode,
          ...(requireAccessPasscode && accessPasscode ? { accessPasscode } : {}),
        },
      });
      if (result.rawToken) {
        window.sessionStorage.setItem(
          `proposal-token:${result.proposal.id}`,
          JSON.stringify({ rawToken: result.rawToken, secureUrl: result.secureUrl }),
        );
      }
      window.location.href = `/projects/${params.projectId}/proposals/${result.proposal.id}`;
    } catch (error) {
      setCreateError(getApiErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }, [
    accessPasscode,
    allowComments,
    allowDocumentDownload,
    allowOptionSelection,
    expiresInDays,
    params.projectId,
    recipientEmail,
    recipientName,
    requireAccessPasscode,
    selectedBoqId,
    selectedDocumentIds,
  ]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading proposals</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Proposals unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This project could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Client proposals</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{project.name}</h2>
            <p className="mt-3 text-slate-400">Create secure client proposal links from a locked BOQ revision.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Create proposal
          </button>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-4 py-3">Revision</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">R{String(proposal.revisionNumber).padStart(2, "0")}</td>
                  <td className="px-4 py-3">
                    <p className="text-white">{proposal.recipientName}</p>
                    <p className="text-xs text-slate-500">{proposal.recipientEmail}</p>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${STATUS_COLORS[proposal.status] ?? "text-slate-300"}`}>{proposal.status}</td>
                  <td className="px-4 py-3">{formatDate(proposal.expiresAt)}</td>
                  <td className="px-4 py-3">{formatDate(proposal.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${params.projectId}/proposals/${proposal.id}`}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {proposals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No proposals have been created for this project yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h3 className="text-xl font-semibold text-white">Create client proposal</h3>

            <label className="mt-5 block text-sm text-slate-300">
              <span className="text-slate-400">Locked revision</span>
              <select
                value={selectedBoqId}
                onChange={(event) => setSelectedBoqId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                <option value="">Select a revision</option>
                {boqs.map((boq) => (
                  <option key={boq.id} value={boq.id}>{boq.revision} · {boq.status}</option>
                ))}
              </select>
              {selectedBoqId && !isLockedRevision && (
                <p className="mt-2 text-xs text-amber-300">This revision is not locked. Lock it before creating a proposal.</p>
              )}
            </label>

            <div className="mt-4 space-y-2">
              <p className="text-sm text-slate-400">Client-facing documents</p>
              {documents.length === 0 && <p className="text-xs text-slate-500">No client-facing documents were found for this project. Generate one first.</p>}
              {documents.map((doc) => (
                <label key={doc.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                  <span>{doc.type} — {doc.fileName ?? "document"}</span>
                  <input type="checkbox" checked={selectedDocumentIds.includes(doc.id)} onChange={() => toggleDocument(doc.id)} className="h-4 w-4" />
                </label>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Recipient name</span>
                <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Recipient email</span>
                <input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              </label>
            </div>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Expiry (days)</span>
              <input type="number" min={1} max={365} value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            </label>

            <div className="mt-4 space-y-2">
              <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                <span>Allow option selection</span>
                <input type="checkbox" checked={allowOptionSelection} onChange={(event) => setAllowOptionSelection(event.target.checked)} className="h-4 w-4" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                <span>Allow comments</span>
                <input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} className="h-4 w-4" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                <span>Allow document download</span>
                <input type="checkbox" checked={allowDocumentDownload} onChange={(event) => setAllowDocumentDownload(event.target.checked)} className="h-4 w-4" />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                <span>Require access passcode</span>
                <input type="checkbox" checked={requireAccessPasscode} onChange={(event) => setRequireAccessPasscode(event.target.checked)} className="h-4 w-4" />
              </label>
              {requireAccessPasscode && (
                <input
                  value={accessPasscode}
                  onChange={(event) => setAccessPasscode(event.target.value)}
                  placeholder="Passcode (min 4 characters)"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              )}
            </div>

            {createError && <p className="mt-4 rounded-2xl border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{createError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createProposal()}
                disabled={isCreating || !selectedBoqId || !isLockedRevision || selectedDocumentIds.length === 0 || !recipientEmail || !recipientName}
                className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create proposal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
