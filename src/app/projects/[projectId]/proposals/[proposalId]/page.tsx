"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import type { ClientProposalEventType, ClientProposalStatus, EmailDispatchStatus, ProposalActorType } from "@prisma/client";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { TranslateFn, TranslationKey } from "@/lib/i18n/translate";
import { getLocalizedApiErrorMessage } from "@/lib/i18n/api-error-message";

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
  status: ClientProposalStatus;
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
  eventType: ClientProposalEventType;
  actorType: ProposalActorType;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};
type EmailDispatch = {
  id: string;
  recipient: string;
  subject: string;
  provider: string;
  status: EmailDispatchStatus;
  attempts: number;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};
type EmailTemplate = { id: string; name: string; language: string; isDefault: boolean };

type SupportedEmailTemplateLanguage = "English" | "Arabic" | "en" | "ar";
type KnownEmailProvider = "development" | "smtp";

const TEMPLATE_LANGUAGE_LABEL_KEYS = {
  English: "proposals.templateLanguageEnglish",
  Arabic: "proposals.templateLanguageArabic",
  en: "proposals.templateLanguageEnglish",
  ar: "proposals.templateLanguageArabic",
} as const satisfies Record<SupportedEmailTemplateLanguage, TranslationKey>;

const DEFAULT_TEMPLATE_LABEL_KEY: TranslationKey = "proposals.defaultTemplate";

const DISPATCH_STATUS_LABEL_KEYS = {
  DRAFT: "proposals.dispatchStatusDraft",
  PREVIEWED: "proposals.dispatchStatusPreviewed",
  QUEUED: "proposals.dispatchStatusQueued",
  SENDING: "proposals.dispatchStatusSending",
  SENT: "proposals.dispatchStatusSent",
  DELIVERED: "proposals.dispatchStatusDelivered",
  FAILED: "proposals.dispatchStatusFailed",
  CANCELLED: "proposals.dispatchStatusCancelled",
} as const satisfies Record<EmailDispatchStatus, TranslationKey>;

const EMAIL_PROVIDER_LABEL_KEYS = {
  development: "proposals.providerDevelopment",
  smtp: "proposals.providerSmtp",
} as const satisfies Record<KnownEmailProvider, TranslationKey>;

const EVENT_TYPE_LABEL_KEYS = {
  CREATED: "proposals.eventCreated",
  READY: "proposals.eventReady",
  EMAIL_PREVIEWED: "proposals.eventEmailPreviewed",
  EMAIL_QUEUED: "proposals.eventEmailQueued",
  EMAIL_SENT: "proposals.eventEmailSent",
  EMAIL_FAILED: "proposals.eventEmailFailed",
  LINK_OPENED: "proposals.eventLinkOpened",
  DOCUMENT_VIEWED: "proposals.eventDocumentViewed",
  DOCUMENT_DOWNLOADED: "proposals.eventDocumentDownloaded",
  OPTION_SELECTED: "proposals.eventOptionSelected",
  COMMENT_ADDED: "proposals.eventCommentAdded",
  REVISION_REQUESTED: "proposals.eventRevisionRequested",
  APPROVED: "proposals.eventApproved",
  REJECTED: "proposals.eventRejected",
  REVOKED: "proposals.eventRevoked",
  EXPIRED: "proposals.eventExpired",
  LINK_REGENERATED: "proposals.eventLinkRegenerated",
} as const satisfies Record<ClientProposalEventType, TranslationKey>;

const ACTOR_TYPE_LABEL_KEYS = {
  INTERNAL: "proposals.actorInternal",
  CLIENT: "proposals.actorClient",
  SYSTEM: "proposals.actorSystem",
} as const satisfies Record<ProposalActorType, TranslationKey>;

function translatedKnownValue(
  value: string,
  labelKeys: Readonly<Record<string, TranslationKey>>,
  t: TranslateFn,
): string {
  const key = labelKeys[value];
  return key ? t(key) : value;
}

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
  const { direction, locale, t } = useLocale();
  const localizationRef = useRef({ locale, t });
  localizationRef.current = { locale, t };
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
      const current = localizationRef.current;
      setLoadError(getLocalizedApiErrorMessage(error, current.t, current.locale));
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
        setActionError(getLocalizedApiErrorMessage(error, t, locale));
      } finally {
        setBusyAction(null);
      }
    },
    [locale, t],
  );

  const markReady = useCallback(() => runAction("ready", async () => {
    await apiClient.post(`/api/proposals/${params.proposalId}/ready`, {});
    setActionMessage(t("proposals.markedReadyMessage"));
    await load();
  }), [load, params.proposalId, runAction, t]);

  const revoke = useCallback(() => runAction("revoke", async () => {
    if (!window.confirm(t("proposals.revokeConfirm"))) return;
    await apiClient.post(`/api/proposals/${params.proposalId}/revoke`, {});
    setActionMessage(t("proposals.revokedMessage"));
    await load();
  }), [load, params.proposalId, runAction, t]);

  const regenerateLink = useCallback(() => runAction("regenerate", async () => {
    const result = await apiClient.post<{ rawToken: string; secureUrl: string }>(`/api/proposals/${params.proposalId}/regenerate-link`, {});
    window.sessionStorage.setItem(`proposal-token:${params.proposalId}`, JSON.stringify({ rawToken: result.rawToken, secureUrl: result.secureUrl }));
    setTokenInfo({ rawToken: result.rawToken, secureUrl: result.secureUrl });
    setActionMessage(t("proposals.linkRegeneratedMessage"));
    await load();
  }), [load, params.proposalId, runAction, t]);

  const previewEmail = useCallback(() => runAction("preview", async () => {
    if (!tokenInfo) {
      setActionError(t("proposals.linkUnavailableInSession"));
      return;
    }
    const result = await apiClient.post<{ subject: string; bodyHtml: string; bodyText: string }>(
      `/api/proposals/${params.proposalId}/email/preview`,
      { rawToken: tokenInfo.rawToken, emailTemplateId: selectedTemplateId || undefined },
    );
    setPreview(result);
  }), [params.proposalId, runAction, selectedTemplateId, t, tokenInfo]);

  const testSend = useCallback(() => runAction("test-send", async () => {
    if (!tokenInfo) {
      setActionError(t("proposals.linkUnavailableInSession"));
      return;
    }
    await apiClient.post(`/api/proposals/${params.proposalId}/email/test-send`, {
      rawToken: tokenInfo.rawToken,
      emailTemplateId: selectedTemplateId || undefined,
      testRecipient,
    });
    setActionMessage(t("proposals.testEmailSent", { email: testRecipient }));
  }), [params.proposalId, runAction, selectedTemplateId, t, testRecipient, tokenInfo]);

  const sendEmail = useCallback(() => runAction("send", async () => {
    if (!tokenInfo) {
      setActionError(t("proposals.linkUnavailableInSession"));
      return;
    }
    if (!window.confirm(t("proposals.sendConfirm", { email: proposal?.recipientEmail ?? "" }))) return;
    const result = await apiClient.post<{ status: string; proposalStatus: string }>(`/api/proposals/${params.proposalId}/email/send`, {
      rawToken: tokenInfo.rawToken,
      emailTemplateId: selectedTemplateId || undefined,
    });
    setActionMessage(result.status === "FAILED" ? t("proposals.dispatchFailed") : t("proposals.dispatched"));
    await load();
  }), [load, params.proposalId, proposal?.recipientEmail, runAction, selectedTemplateId, t, tokenInfo]);

  const totalDocSize = useMemo(
    () => (proposal ? proposal.documents.reduce((sum, doc) => sum + (doc.fileSize ?? 0), 0) : 0),
    [proposal],
  );

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("proposals.detailLoading")}</p>
      </div>
    );
  }

  if (loadError || !proposal) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("proposals.detailUnavailable")}</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? t("proposals.detailCouldNotLoad")}</p>
      </div>
    );
  }

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

  const canMarkReady = proposal.status === "DRAFT";
  const canSend = proposal.status === "READY" || proposal.status === "SENT";
  const canRevoke = !["APPROVED", "REJECTED", "REVOKED", "EXPIRED"].includes(proposal.status);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <Link href={`/projects/${params.projectId}/proposals`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          <span aria-hidden="true">{direction === "rtl" ? "→" : "←"}</span>
          <span>{t("proposals.backToProposals")}</span>
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("proposals.revisionNumberLabel", { number: String(proposal.revisionNumber).padStart(2, "0") })}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{proposal.recipientName}</h2>
            <p className="mt-1 text-slate-400">{proposal.recipientEmail} · {proposal.clientName}</p>
          </div>
          <div className={`text-lg font-semibold ${STATUS_COLORS[proposal.status] ?? "text-slate-300"}`}>{STATUS_LABELS[proposal.status]}</div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-slate-400 md:grid-cols-4">
          <div><p className="text-slate-500">{t("proposals.expires")}</p><p className="text-white">{formatDate(proposal.expiresAt)}</p></div>
          <div><p className="text-slate-500">{t("proposals.firstOpened")}</p><p className="text-white">{proposal.firstOpenedAt ? formatDate(proposal.firstOpenedAt) : "—"}</p></div>
          <div><p className="text-slate-500">{t("proposals.lastOpened")}</p><p className="text-white">{proposal.lastOpenedAt ? formatDate(proposal.lastOpenedAt) : "—"}</p></div>
          <div><p className="text-slate-500">{t("proposals.documents")}</p><p className="text-white">{t("proposals.documentsWithSize", { count: proposal.documents.length, size: Math.round(totalDocSize / 1024) })}</p></div>
        </div>

        {(actionMessage || actionError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {canMarkReady && (
            <button type="button" onClick={() => void markReady()} disabled={busyAction === "ready"} className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busyAction === "ready" ? t("proposals.marking") : t("proposals.markReady")}
            </button>
          )}
          {canRevoke && (
            <button type="button" onClick={() => void revoke()} disabled={busyAction === "revoke"} className="rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/60 disabled:opacity-50">
              {busyAction === "revoke" ? t("proposals.revoking") : t("proposals.revoke")}
            </button>
          )}
          {canRevoke && (
            <button type="button" onClick={() => void regenerateLink()} disabled={busyAction === "regenerate"} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
              {busyAction === "regenerate" ? t("proposals.generatingLink") : t("proposals.regenerateLink")}
            </button>
          )}
        </div>

        {tokenInfo && (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">{t("proposals.secureLinkVisibleSession")}</p>
            <p className="mt-1 break-all text-sm text-blue-300">{tokenInfo.secureUrl}</p>
          </div>
        )}
        {!tokenInfo && (
          <p className="mt-4 text-xs text-slate-500">
            {t("proposals.linkNotAvailableSession")}
          </p>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h3 className="text-xl font-semibold text-white">{t("proposals.clientEmail")}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">{t("proposals.emailTemplate")}</span>
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500">
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({translatedKnownValue(template.language, TEMPLATE_LANGUAGE_LABEL_KEYS, t)})
                  {template.isDefault ? ` · ${t(DEFAULT_TEMPLATE_LABEL_KEY)}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">{t("proposals.testRecipient")}</span>
            <input value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void previewEmail()} disabled={busyAction === "preview"} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            {busyAction === "preview" ? t("proposals.loadingPreview") : t("proposals.preview")}
          </button>
          <button type="button" onClick={() => void testSend()} disabled={busyAction === "test-send"} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            {busyAction === "test-send" ? t("proposals.sending") : t("proposals.sendTest")}
          </button>
          {canSend && (
            <button type="button" onClick={() => void sendEmail()} disabled={busyAction === "send"} className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busyAction === "send" ? t("proposals.sending") : t("proposals.sendToClient")}
            </button>
          )}
        </div>

        {preview && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">{t("proposals.subject")}</p>
            <p className="text-white">{preview.subject}</p>
            <p className="mt-3 text-xs text-slate-500">{t("proposals.htmlPreview")}</p>
            <iframe title="email-preview" srcDoc={preview.bodyHtml} className="mt-2 h-96 w-full rounded-xl border border-slate-800 bg-white" />
          </div>
        )}

        {dispatches.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr><th className="px-4 py-2">{t("proposals.colSent")}</th><th className="px-4 py-2">{t("proposals.colStatus")}</th><th className="px-4 py-2">{t("proposals.colProvider")}</th><th className="px-4 py-2">{t("proposals.colRecipient")}</th></tr>
              </thead>
              <tbody>
                {dispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="border-t border-slate-800">
                    <td className="px-4 py-2">{formatDate(dispatch.createdAt)}</td>
                    <td className="px-4 py-2">
                      {t(DISPATCH_STATUS_LABEL_KEYS[dispatch.status])}
                      {dispatch.errorMessage ? ` — ${locale === "ar" ? t("proposals.deliveryErrorDetail") : dispatch.errorMessage}` : ""}
                    </td>
                    <td className="px-4 py-2">{translatedKnownValue(dispatch.provider, EMAIL_PROVIDER_LABEL_KEYS, t)}</td>
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
          <h3 className="text-xl font-semibold text-white">{t("proposals.clientResponse")}</h3>
          {proposal.approvedAt && (
            <p className="mt-3 text-sm text-emerald-300">{t("proposals.approvedByOn", { name: proposal.approvalName ?? "", email: proposal.approvalEmail ?? "", date: formatDate(proposal.approvedAt) })}</p>
          )}
          {proposal.rejectedAt && (
            <p className="mt-3 text-sm text-rose-300">{t("proposals.rejectedByOn", { name: proposal.approvalName ?? "", email: proposal.approvalEmail ?? "", date: formatDate(proposal.rejectedAt), reason: proposal.rejectionReason ?? "" })}</p>
          )}
          {proposal.revisionRequestedAt && (
            <p className="mt-3 text-sm text-orange-300">{t("proposals.revisionRequestedOn", { date: formatDate(proposal.revisionRequestedAt) })}</p>
          )}
          {proposal.clientComment && <p className="mt-3 text-sm text-slate-300">&ldquo;{proposal.clientComment}&rdquo;</p>}
          {Object.keys(proposal.selectedOptionsJson).length > 0 && (
            <p className="mt-3 text-xs text-slate-500">{t("proposals.optionsSelectedCount", { count: Object.keys(proposal.selectedOptionsJson).length })}</p>
          )}
        </div>
      )}

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h3 className="text-xl font-semibold text-white">{t("proposals.eventHistory")}</h3>
        <div className="mt-4 space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm">
              <span className="text-slate-300">{t(EVENT_TYPE_LABEL_KEYS[event.eventType])}</span>
              <span className="text-xs text-slate-500">{event.actorName ?? t(ACTOR_TYPE_LABEL_KEYS[event.actorType])} · {formatDate(event.createdAt)}</span>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-slate-500">{t("proposals.noEventsYet")}</p>}
        </div>
      </div>
    </div>
  );
}
