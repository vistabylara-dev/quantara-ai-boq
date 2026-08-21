"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, use } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type ProposalDocument = { id: string; type: string; audience: string; fileName: string | null; fileSize: number | null };
type ProposalSettings = {
  showUnitRates: boolean;
  showSectionTotals: boolean;
  allowOptionSelection: boolean;
  allowComments: boolean;
  allowDocumentDownload: boolean;
  requireApprovalName: boolean;
  requireApprovalEmail: boolean;
  requireAccessPasscode: boolean;
  clientLanguage: string;
  showTerms: boolean;
  showExclusions: boolean;
};
type Proposal = {
  id: string;
  projectId: string;
  boqId: string;
  revisionNumber: number;
  clientName: string;
  recipientEmail: string;
  recipientName: string;
  status: string;
  expiresAt: string;
  revokedAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  revisionRequestedAt: string | null;
  clientComment: string | null;
  approvalName: string | null;
  approvalEmail: string | null;
  rejectionReason: string | null;
  selectedOptionsJson: Record<string, string>;
  settings: ProposalSettings;
  documents: ProposalDocument[];
  createdAt: string;
  updatedAt: string;
};
type ProposalEvent = {
  id: string;
  eventType: string;
  actorType: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};
type EmailDispatch = {
  id: string;
  recipient: string;
  subject: string;
  provider: string;
  status: string;
  attempts: number;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};
type EmailTemplate = { id: string; name: string; language: string; isDefault: boolean };

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

type PageProps = { params: Promise<{ projectId: string; proposalId: string }> };

export default function ProposalDetailPage(props: PageProps) {
  const params = use(props.params);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [events, setEvents] = useState<ProposalEvent[]>([]);
  const [dispatches, setDispatches] = useState<EmailDispatch[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tokenInfo, setTokenInfo] = useState<{ rawToken: string; secureUrl: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string; bodyText: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [proposalData, eventData, dispatchData, templateData] = await Promise.all([
        apiClient.get<Proposal>(`/api/proposals/${encodeURIComponent(params.proposalId)}`, signal),
        apiClient.get<ProposalEvent[]>(`/api/proposals/${encodeURIComponent(params.proposalId)}/events`, signal),
        apiClient.get<EmailDispatch[]>(`/api/proposals/${encodeURIComponent(params.proposalId)}/emails`, signal),
        apiClient.get<EmailTemplate[]>(`/api/email-templates?category=BOQ`, signal),
      ]);
      setProposal(proposalData);
      setEvents(eventData);
      setDispatches(dispatchData);
      setTemplates(templateData);
      setSelectedTemplateId((current) => current || templateData.find((t) => t.isDefault)?.id || templateData[0]?.id || "");
      setTestRecipient((current) => current || proposalData.recipientEmail);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.proposalId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(`proposal-token:${params.proposalId}`);
    if (stored) {
      try {
        setTokenInfo(JSON.parse(stored) as { rawToken: string; secureUrl: string });
      } catch {
        // ignore malformed session storage
      }
    }
  }, [params.proposalId]);

  const runAction = useCallback(
    async (name: string, fn: () => Promise<void>) => {
      setBusyAction(name);
      setActionError(null);
      setActionMessage(null);
      try {
        await fn();
      } catch (error) {
        setActionError(getApiErrorMessage(error));
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  const markReady = useCallback(() => runAction("ready", async () => {
    await apiClient.post(`/api/proposals/${params.proposalId}/ready`, {});
    setActionMessage("Proposal marked READY.");
    await load();
  }), [load, params.proposalId, runAction]);

  const revoke = useCallback(() => runAction("revoke", async () => {
    if (!window.confirm("Revoke this proposal? The current secure link will stop working immediately.")) return;
    await apiClient.post(`/api/proposals/${params.proposalId}/revoke`, {});
    setActionMessage("Proposal revoked.");
    await load();
  }), [load, params.proposalId, runAction]);

  const regenerateLink = useCallback(() => runAction("regenerate", async () => {
    const result = await apiClient.post<{ rawToken: string; secureUrl: string }>(`/api/proposals/${params.proposalId}/regenerate-link`, {});
    window.sessionStorage.setItem(`proposal-token:${params.proposalId}`, JSON.stringify({ rawToken: result.rawToken, secureUrl: result.secureUrl }));
    setTokenInfo({ rawToken: result.rawToken, secureUrl: result.secureUrl });
    setActionMessage("A new secure link was generated. The previous link no longer works.");
    await load();
  }), [load, params.proposalId, runAction]);

  const previewEmail = useCallback(() => runAction("preview", async () => {
    if (!tokenInfo) {
      setActionError("The secure link isn't available in this browser session. Regenerate the link to preview or send email.");
      return;
    }
    const result = await apiClient.post<{ subject: string; bodyHtml: string; bodyText: string }>(
      `/api/proposals/${params.proposalId}/email/preview`,
      { rawToken: tokenInfo.rawToken, emailTemplateId: selectedTemplateId || undefined },
    );
    setPreview(result);
  }), [params.proposalId, runAction, selectedTemplateId, tokenInfo]);

  const testSend = useCallback(() => runAction("test-send", async () => {
    if (!tokenInfo) {
      setActionError("The secure link isn't available in this browser session. Regenerate the link to preview or send email.");
      return;
    }
    await apiClient.post(`/api/proposals/${params.proposalId}/email/test-send`, {
      rawToken: tokenInfo.rawToken,
      emailTemplateId: selectedTemplateId || undefined,
      testRecipient,
    });
    setActionMessage(`Test email sent to ${testRecipient} via the development provider (check the server console).`);
  }), [params.proposalId, runAction, selectedTemplateId, testRecipient, tokenInfo]);

  const sendEmail = useCallback(() => runAction("send", async () => {
    if (!tokenInfo) {
      setActionError("The secure link isn't available in this browser session. Regenerate the link to preview or send email.");
      return;
    }
    if (!window.confirm(`Send the proposal email to ${proposal?.recipientEmail}?`)) return;
    const result = await apiClient.post<{ status: string; proposalStatus: string }>(`/api/proposals/${params.proposalId}/email/send`, {
      rawToken: tokenInfo.rawToken,
      emailTemplateId: selectedTemplateId || undefined,
    });
    setActionMessage(result.status === "FAILED" ? "Email dispatch failed. See the delivery log below." : "Email dispatched.");
    await load();
  }), [load, params.proposalId, proposal?.recipientEmail, runAction, selectedTemplateId, tokenInfo]);

  const totalDocSize = useMemo(
    () => (proposal ? proposal.documents.reduce((sum, doc) => sum + (doc.fileSize ?? 0), 0) : 0),
    [proposal],
  );

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading proposal</p>
      </div>
    );
  }

  if (loadError || !proposal) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Proposal unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This proposal could not be loaded."}</p>
      </div>
    );
  }

  const canMarkReady = proposal.status === "DRAFT";
  const canSend = proposal.status === "READY" || proposal.status === "SENT";
  const canRevoke = !["APPROVED", "REJECTED", "REVOKED", "EXPIRED"].includes(proposal.status);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <Link href={`/projects/${params.projectId}/proposals`} className="text-xs text-slate-500 hover:text-slate-300">
          ← Back to proposals
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Revision R{String(proposal.revisionNumber).padStart(2, "0")}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{proposal.recipientName}</h2>
            <p className="mt-1 text-slate-400">{proposal.recipientEmail} · {proposal.clientName}</p>
          </div>
          <div className={`text-lg font-semibold ${STATUS_COLORS[proposal.status] ?? "text-slate-300"}`}>{proposal.status}</div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-slate-400 md:grid-cols-4">
          <div><p className="text-slate-500">Expires</p><p className="text-white">{formatDate(proposal.expiresAt)}</p></div>
          <div><p className="text-slate-500">First opened</p><p className="text-white">{proposal.firstOpenedAt ? formatDate(proposal.firstOpenedAt) : "—"}</p></div>
          <div><p className="text-slate-500">Last opened</p><p className="text-white">{proposal.lastOpenedAt ? formatDate(proposal.lastOpenedAt) : "—"}</p></div>
          <div><p className="text-slate-500">Documents</p><p className="text-white">{proposal.documents.length} ({Math.round(totalDocSize / 1024)} KB)</p></div>
        </div>

        {(actionMessage || actionError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {canMarkReady && (
            <button type="button" onClick={() => void markReady()} disabled={busyAction === "ready"} className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busyAction === "ready" ? "Marking…" : "Mark ready"}
            </button>
          )}
          {canRevoke && (
            <button type="button" onClick={() => void revoke()} disabled={busyAction === "revoke"} className="rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/60 disabled:opacity-50">
              {busyAction === "revoke" ? "Revoking…" : "Revoke"}
            </button>
          )}
          {canRevoke && (
            <button type="button" onClick={() => void regenerateLink()} disabled={busyAction === "regenerate"} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
              {busyAction === "regenerate" ? "Generating…" : "Regenerate link"}
            </button>
          )}
        </div>

        {tokenInfo && (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">Secure client link (visible only in this browser session)</p>
            <p className="mt-1 break-all text-sm text-blue-300">{tokenInfo.secureUrl}</p>
          </div>
        )}
        {!tokenInfo && (
          <p className="mt-4 text-xs text-slate-500">
            The secure link isn&apos;t available in this session (raw tokens are never stored). Regenerate the link to obtain a fresh one.
          </p>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h3 className="text-xl font-semibold text-white">Client email</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Email template</span>
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500">
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name} ({template.language}){template.isDefault ? " · default" : ""}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Test recipient</span>
            <input value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void previewEmail()} disabled={busyAction === "preview"} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            {busyAction === "preview" ? "Loading…" : "Preview"}
          </button>
          <button type="button" onClick={() => void testSend()} disabled={busyAction === "test-send"} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            {busyAction === "test-send" ? "Sending…" : "Send test (dev provider)"}
          </button>
          {canSend && (
            <button type="button" onClick={() => void sendEmail()} disabled={busyAction === "send"} className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busyAction === "send" ? "Sending…" : "Send to client"}
            </button>
          )}
        </div>

        {preview && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">Subject</p>
            <p className="text-white">{preview.subject}</p>
            <p className="mt-3 text-xs text-slate-500">HTML preview</p>
            <iframe title="email-preview" srcDoc={preview.bodyHtml} className="mt-2 h-96 w-full rounded-xl border border-slate-800 bg-white" />
          </div>
        )}

        {dispatches.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr><th className="px-4 py-2">Sent</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Provider</th><th className="px-4 py-2">Recipient</th></tr>
              </thead>
              <tbody>
                {dispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="border-t border-slate-800">
                    <td className="px-4 py-2">{formatDate(dispatch.createdAt)}</td>
                    <td className="px-4 py-2">{dispatch.status}{dispatch.errorMessage ? ` — ${dispatch.errorMessage}` : ""}</td>
                    <td className="px-4 py-2">{dispatch.provider}</td>
                    <td className="px-4 py-2">{dispatch.recipient}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(proposal.clientComment || proposal.approvalName || proposal.rejectionReason) && (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h3 className="text-xl font-semibold text-white">Client response</h3>
          {proposal.approvedAt && (
            <p className="mt-3 text-sm text-emerald-300">Approved by {proposal.approvalName} ({proposal.approvalEmail}) on {formatDate(proposal.approvedAt)}.</p>
          )}
          {proposal.rejectedAt && (
            <p className="mt-3 text-sm text-rose-300">Rejected by {proposal.approvalName} ({proposal.approvalEmail}) on {formatDate(proposal.rejectedAt)}: {proposal.rejectionReason}</p>
          )}
          {proposal.revisionRequestedAt && (
            <p className="mt-3 text-sm text-orange-300">Revision requested on {formatDate(proposal.revisionRequestedAt)}.</p>
          )}
          {proposal.clientComment && <p className="mt-3 text-sm text-slate-300">&ldquo;{proposal.clientComment}&rdquo;</p>}
          {Object.keys(proposal.selectedOptionsJson).length > 0 && (
            <p className="mt-3 text-xs text-slate-500">{Object.keys(proposal.selectedOptionsJson).length} item option(s) selected by the client.</p>
          )}
        </div>
      )}

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h3 className="text-xl font-semibold text-white">Event history</h3>
        <div className="mt-4 space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm">
              <span className="text-slate-300">{event.eventType.replace(/_/g, " ")}</span>
              <span className="text-xs text-slate-500">{event.actorName ?? event.actorType} · {formatDate(event.createdAt)}</span>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-slate-500">No events yet.</p>}
        </div>
      </div>
    </div>
  );
}
