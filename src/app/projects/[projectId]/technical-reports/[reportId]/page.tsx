"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ReportDetailView = {
  id: string;
  projectId: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  name: string;
  status: "DRAFT" | "COMPLETED";
  sections: {
    templateName?: string;
    sections: { sectionCode: string; title: string }[];
  };
  placeholders: string[];
  fieldValues: Record<string, string>;
  fileName: string | null;
  errorMessage: string | null;
  hasActiveShareLink: boolean;
  shareExpiresAt: string | null;
};

type EmailTemplateOption = { id: string; name: string; code: string; isActive: boolean };

type PageProps = { params: Promise<{ projectId: string; reportId: string }> };

export default function TechnicalReportDetailPage(props: PageProps) {
  const params = use(props.params);
  const [report, setReport] = useState<ReportDetailView | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [attachShareLink, setAttachShareLink] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareRawToken, setShareRawToken] = useState<string | null>(null);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<ReportDetailView>(`/api/technical-reports/${encodeURIComponent(params.reportId)}`, signal);
      setReport(data);
      setValues(data.fieldValues);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.reportId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<EmailTemplateOption[]>("/api/email-templates?category=TECHNICAL_REPORT", controller.signal)
      .then((data) => {
        setEmailTemplates(data);
        setSelectedTemplateId((current) => current || data[0]?.id || "");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  const createShareLink = useCallback(async () => {
    setEmailError(null);
    setIsCreatingShareLink(true);
    try {
      const data = await apiClient.post<{ rawToken: string; secureUrl: string }>(`/api/technical-reports/${encodeURIComponent(params.reportId)}/share`);
      setShareUrl(data.secureUrl);
      setShareRawToken(data.rawToken);
      setReport((current) => (current ? { ...current, hasActiveShareLink: true } : current));
    } catch (error) {
      setEmailError(getApiErrorMessage(error));
    } finally {
      setIsCreatingShareLink(false);
    }
  }, [params.reportId]);

  const revokeShareLink = useCallback(async () => {
    setEmailError(null);
    setIsCreatingShareLink(true);
    try {
      await apiClient.post(`/api/technical-reports/${encodeURIComponent(params.reportId)}/share/revoke`);
      setShareUrl(null);
      setShareRawToken(null);
      setReport((current) => (current ? { ...current, hasActiveShareLink: false } : current));
    } catch (error) {
      setEmailError(getApiErrorMessage(error));
    } finally {
      setIsCreatingShareLink(false);
    }
  }, [params.reportId]);

  const sendReportEmail = useCallback(async () => {
    setEmailError(null);
    setEmailNotice(null);
    if (!selectedTemplateId) {
      setEmailError("Choose an email template first.");
      return;
    }
    if (!recipientEmail.trim() || !recipientName.trim()) {
      setEmailError("Recipient name and email are required.");
      return;
    }
    setIsSendingEmail(true);
    try {
      const data = await apiClient.post<{ status: string }>(`/api/technical-reports/${encodeURIComponent(params.reportId)}/email/send`, {
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim(),
        emailTemplateId: selectedTemplateId,
        ...(attachShareLink && shareRawToken ? { rawShareToken: shareRawToken } : {}),
      });
      setEmailNotice(data.status === "FAILED" ? "The email could not be delivered — check the email provider configuration." : "Report email sent.");
    } catch (error) {
      setEmailError(getApiErrorMessage(error));
    } finally {
      setIsSendingEmail(false);
    }
  }, [params.reportId, selectedTemplateId, recipientEmail, recipientName, attachShareLink, shareRawToken]);

  const saveValues = useCallback(async () => {
    setActionError(null);
    setIsSaving(true);
    try {
      const data = await apiClient.patch<ReportDetailView>(`/api/technical-reports/${encodeURIComponent(params.reportId)}`, { fieldValues: values });
      setReport(data);
      setValues(data.fieldValues);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [params.reportId, values]);

  const generate = useCallback(async () => {
    setActionError(null);
    setIsGenerating(true);
    try {
      // Persist whatever's currently in the form first, so generation always uses the latest
      // values even if the user hasn't clicked "Save fields" separately.
      await apiClient.patch(`/api/technical-reports/${encodeURIComponent(params.reportId)}`, { fieldValues: values });
      const data = await apiClient.post<ReportDetailView>(`/api/technical-reports/${encodeURIComponent(params.reportId)}/generate`, { documentType: "DOCX" });
      setReport(data);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }, [params.reportId, values]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading report</p>
      </div>
    );
  }

  if (loadError || !report) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Report unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This report could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <Link href={`/projects/${params.projectId}/technical-reports`} className="text-sm text-slate-400 hover:underline">
          ← Back to technical reports
        </Link>
        <p className="mt-3 text-sm uppercase tracking-[0.28em] text-slate-500">{report.templateName} · {report.templateCode}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{report.name}</h2>
        <p className="mt-3 text-slate-400">
          Fill in the fields below — they map directly onto the bracketed placeholders in the template. Anything left blank
          stays visible as a placeholder in the generated document rather than being guessed at.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Sections included: {report.sections.sections.map((s) => `${s.sectionCode} ${s.title}`).join(" · ")}
        </p>
      </div>

      {actionError && (
        <div className="rounded-[28px] border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{actionError}</p>
            <button type="button" onClick={() => setActionError(null)} className="rounded-2xl border border-rose-800 px-3 py-2 font-semibold hover:bg-rose-900/40">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {report.errorMessage && (
        <div className="rounded-[28px] border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200">
          Last generation attempt failed: {report.errorMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h3 className="text-xl font-semibold text-white">Fields ({report.placeholders.length})</h3>
          {report.placeholders.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">This template has no bracketed placeholders to fill in — it&apos;s ready to generate as-is.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {report.placeholders.map((placeholder) => (
                <label key={placeholder} className="block text-sm text-slate-300">
                  <span className="text-slate-400">{placeholder}</span>
                  <input
                    value={values[placeholder] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [placeholder]: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void saveValues()}
            disabled={isSaving}
            className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save fields"}
          </button>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Generate</p>
            <p className="mt-3 text-sm text-slate-400">
              Produces a Word document from the template with your field values merged in. Currently DOCX only.
            </p>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={isGenerating}
              className="mt-5 w-full rounded-2xl border border-slate-700 bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate DOCX"}
            </button>
            {report.status === "COMPLETED" && (
              <a
                href={`/api/technical-reports/${encodeURIComponent(report.id)}/download`}
                className="mt-3 block rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Download {report.fileName}
              </a>
            )}
          </section>

          {report.status === "COMPLETED" && (
            <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Secure client link</p>
              <p className="mt-3 text-sm text-slate-400">
                {report.hasActiveShareLink ? "An active link exists for this report." : "No active link yet."} Creating a new link invalidates any previous one.
              </p>
              {shareUrl && (
                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3">
                  <p className="break-all text-xs text-emerald-300">{shareUrl}</p>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(shareUrl)}
                    className="mt-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Copy link
                  </button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void createShareLink()}
                  disabled={isCreatingShareLink}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  {isCreatingShareLink ? "Working…" : report.hasActiveShareLink ? "Rotate link" : "Create link"}
                </button>
                {report.hasActiveShareLink && (
                  <button
                    type="button"
                    onClick={() => void revokeShareLink()}
                    disabled={isCreatingShareLink}
                    className="rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </section>
          )}

          {report.status === "COMPLETED" && (
            <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Send by email</p>

              {emailError && <p className="mt-3 text-sm text-rose-300">{emailError}</p>}
              {emailNotice && <p className="mt-3 text-sm text-emerald-300">{emailNotice}</p>}

              <label className="mt-4 block text-sm text-slate-300">
                <span className="text-slate-400">Email template</span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="">Select a template…</option>
                  {emailTemplates.filter((t) => t.isActive).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              {emailTemplates.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  No email templates yet — add the built-in technical report templates from Settings → Email templates.
                </p>
              )}

              <label className="mt-4 block text-sm text-slate-300">
                <span className="text-slate-400">Recipient name</span>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              </label>
              <label className="mt-4 block text-sm text-slate-300">
                <span className="text-slate-400">Recipient email</span>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              </label>

              <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={attachShareLink} onChange={(e) => setAttachShareLink(e.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-900" />
                Include the secure link (create one above first if the template uses it)
              </label>

              <button
                type="button"
                onClick={() => void sendReportEmail()}
                disabled={isSendingEmail}
                className="mt-5 w-full rounded-2xl border border-slate-700 bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSendingEmail ? "Sending…" : "Send report email"}
              </button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
