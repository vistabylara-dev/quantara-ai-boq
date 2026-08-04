"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { renderEmailTemplate, type EmailTemplateVariables } from "@/lib/email/render-email-template";
import {
  renderTechnicalReportEmailTemplate,
  type TechnicalReportEmailVariables,
} from "@/lib/email/render-technical-report-email-template";

type EmailTemplateCategory = "BOQ" | "TECHNICAL_REPORT" | "GENERAL";

type EmailTemplateView = {
  id: string;
  name: string;
  code: string;
  category: EmailTemplateCategory;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  language: string;
  isDefault: boolean;
  isActive: boolean;
};

type Draft = {
  name: string;
  code: string;
  category: EmailTemplateCategory;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  language: "English" | "Arabic";
};

const EMPTY_DRAFT: Draft = { name: "", code: "", category: "GENERAL", subject: "", bodyHtml: "", bodyText: "", language: "English" };

const CATEGORY_SECTIONS: { key: EmailTemplateCategory; label: string; hint: string }[] = [
  { key: "BOQ", label: "BOQ / Proposal", hint: "Used when sending a client proposal." },
  { key: "TECHNICAL_REPORT", label: "Technical Report", hint: "Used when sending a generated technical report." },
  { key: "GENERAL", label: "General", hint: "Not tied to a specific send flow." },
];

const SAMPLE_VARIABLES: EmailTemplateVariables = {
  clientName: "John Carter",
  clientCompany: "Carter Holdings LLC",
  projectName: "Marina Tower Fit-Out",
  projectReference: "PRJ-1042",
  boqReference: "PRJ-1042-R02",
  revision: "R02",
  proposalValidityDate: "15 Sep 2026",
  companyName: "Quantara Interiors LLC",
  senderName: "Sara Al Mansoori",
  senderEmail: "sara@quantara-interiors.example",
  secureReviewUrl: "https://app.quantara.example/proposal/sample-token",
  documentList: "PROPOSAL — PRJ-1042-R02-proposal.pdf\nSCHEDULE — PRJ-1042-R02-schedule.pdf",
  grandTotal: "482,650.00",
  currency: "AED",
};

const SAMPLE_TECHNICAL_REPORT_VARIABLES: TechnicalReportEmailVariables = {
  clientName: "John Carter",
  clientCompany: "Carter Holdings LLC",
  projectName: "Marina Tower Fit-Out",
  projectReference: "PRJ-1042",
  companyName: "Quantara Interiors LLC",
  companyPhone: "+971 4 000 0000",
  companyWebsite: "https://quantara-interiors.example",
  senderName: "Sara Al Mansoori",
  senderEmail: "sara@quantara-interiors.example",
  senderTitle: "Technical Director",
  reportReference: "PRJ-1042-TR-A1B2C3D4",
  revision: "0",
  issueDate: "15 Sep 2026",
  secureReportUrl: "https://app.quantara.example/technical-report/sample-token",
  sectionList: "01 Executive Summary\n02 Scope of Assessment\n03 Technical Observations",
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplateView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isInstallingStarters, setIsInstallingStarters] = useState(false);
  const [starterNotice, setStarterNotice] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<EmailTemplateView[]>("/api/email-templates?includeInactive=true", signal);
      setTemplates(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const startCreate = useCallback(() => {
    setEditingId("new");
    setDraft(EMPTY_DRAFT);
  }, []);

  const startEdit = useCallback((template: EmailTemplateView) => {
    setEditingId(template.id);
    setDraft({
      name: template.name,
      code: template.code,
      category: template.category,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      language: template.language === "Arabic" ? "Arabic" : "English",
    });
  }, []);

  const save = useCallback(async () => {
    if (!editingId || !draft) return;
    setIsSaving(true);
    setActionError(null);
    try {
      if (editingId === "new") {
        await apiClient.post("/api/email-templates", draft);
      } else {
        await apiClient.put(`/api/email-templates/${encodeURIComponent(editingId)}`, draft);
      }
      setEditingId(null);
      setDraft(null);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [draft, editingId, load]);

  const duplicate = useCallback(async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiClient.post(`/api/email-templates/${encodeURIComponent(id)}/duplicate`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const setDefault = useCallback(async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiClient.post(`/api/email-templates/${encodeURIComponent(id)}/default`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const installTechnicalReportStarters = useCallback(async () => {
    setIsInstallingStarters(true);
    setActionError(null);
    setStarterNotice(null);
    try {
      const result = await apiClient.post<{ created: EmailTemplateView[]; skipped: number }>("/api/email-templates/starter/technical-report");
      await load();
      if (result.created.length > 0) {
        setStarterNotice(`Added ${result.created.length} technical report template(s)${result.skipped > 0 ? ` (${result.skipped} already installed)` : ""}.`);
      } else {
        setStarterNotice("Technical report templates are already installed.");
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsInstallingStarters(false);
    }
  }, [load]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiClient.put(`/api/email-templates/${encodeURIComponent(id)}/active`, { isActive: !isActive });
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }, [load]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading email templates</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Email templates unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
      </div>
    );
  }

  const previewTemplate = templates.find((t) => t.id === previewId) ?? null;
  const rendered = previewTemplate
    ? (() => {
        try {
          if (previewTemplate.category === "TECHNICAL_REPORT") {
            return renderTechnicalReportEmailTemplate({
              subject: previewTemplate.subject,
              bodyHtml: previewTemplate.bodyHtml,
              bodyText: previewTemplate.bodyText,
              variables: SAMPLE_TECHNICAL_REPORT_VARIABLES,
            });
          }
          return renderEmailTemplate({ subject: previewTemplate.subject, bodyHtml: previewTemplate.bodyHtml, bodyText: previewTemplate.bodyText, variables: SAMPLE_VARIABLES });
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Email templates</h1>
            <p className="mt-3 text-slate-400">Manage the client-facing email templates used when sending proposals and technical reports — grouped by category so the right template always shows up in the right place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void installTechnicalReportStarters()}
              disabled={isInstallingStarters}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {isInstallingStarters ? "Adding…" : "Add technical report templates"}
            </button>
            <button type="button" onClick={startCreate} className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">
              New template
            </button>
          </div>
        </div>
      </div>

      {starterNotice && (
        <div className="rounded-[28px] border border-emerald-900 bg-emerald-950/30 p-5 text-sm text-emerald-200" role="status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{starterNotice}</p>
            <button type="button" onClick={() => setStarterNotice(null)} className="rounded-2xl border border-emerald-800 px-3 py-2 font-semibold hover:bg-emerald-900/40">
              Dismiss
            </button>
          </div>
        </div>
      )}

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

      {CATEGORY_SECTIONS.map((section) => {
        const sectionTemplates = templates.filter((t) => t.category === section.key);
        return (
          <div key={section.key} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{section.label}</h2>
              <p className="text-xs text-slate-500">{section.hint}</p>
            </div>
            {sectionTemplates.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">No templates in this category yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sectionTemplates.map((template) => (
                  <div key={template.id} className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{template.language}</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{template.name}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {template.isDefault && <span className="rounded-full bg-blue-950/60 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-blue-300">Default</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] ${template.isActive ? "bg-emerald-950/60 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                          {template.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">{template.subject}</p>
                    <p className="mt-2 text-xs text-slate-500">{template.code}</p>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setPreviewId(template.id)} className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                        Preview
                      </button>
                      <button type="button" onClick={() => startEdit(template)} className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                        Edit
                      </button>
                      <button type="button" onClick={() => void duplicate(template.id)} disabled={busyId === template.id} className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                        Duplicate
                      </button>
                      {!template.isDefault && (
                        <button type="button" onClick={() => void setDefault(template.id)} disabled={busyId === template.id} className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                          Set default
                        </button>
                      )}
                      <button type="button" onClick={() => void toggleActive(template.id, template.isActive)} disabled={busyId === template.id} className="rounded-2xl border border-rose-900 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50">
                        {template.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Preview — {previewTemplate.name}</h3>
              <button type="button" onClick={() => setPreviewId(null)} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Close</button>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Rendered with sample data</p>
            {rendered ? (
              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-500">Subject</p>
                <p className="text-white">{rendered.subject}</p>
                <p className="mt-3 text-xs text-slate-500">HTML preview</p>
                <iframe title="template-preview" srcDoc={rendered.bodyHtml} className="mt-2 h-96 w-full rounded-xl border border-slate-800 bg-white" />
                {rendered.unknownTokens.length > 0 && (
                  <p className="mt-3 text-xs text-amber-300">Unrecognized token(s): {rendered.unknownTokens.join(", ")}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-rose-300">This template is missing a required variable and cannot be rendered.</p>
            )}
          </div>
        </div>
      )}

      {editingId && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h3 className="text-xl font-semibold text-white">{editingId === "new" ? "New email template" : "Edit email template"}</h3>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Code (lowercase, dashes)</span>
                <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} disabled={editingId !== "new"} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-50" />
              </label>
            </div>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Category — which send flow can use this template</span>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as EmailTemplateCategory })}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                {CATEGORY_SECTIONS.map((section) => (
                  <option key={section.key} value={section.key}>{section.label}</option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Subject</span>
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Language</span>
              <select value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as "English" | "Arabic" })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500">
                <option value="English">English</option>
                <option value="Arabic">Arabic</option>
              </select>
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">HTML body ({"{{variable}}"} tokens supported)</span>
              <textarea value={draft.bodyHtml} onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })} rows={8} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-xs text-white outline-none focus:border-blue-500" />
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Plain-text body</span>
              <textarea value={draft.bodyText} onChange={(e) => setDraft({ ...draft, bodyText: e.target.value })} rows={6} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-xs text-white outline-none focus:border-blue-500" />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setEditingId(null); setDraft(null); }} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={isSaving || !draft.name.trim() || !draft.code.trim() || !draft.subject.trim() || !draft.bodyHtml.trim() || !draft.bodyText.trim()}
                className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
