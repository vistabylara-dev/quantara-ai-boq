"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type TemplateStyleConfig = {
  direction: "ltr" | "rtl";
  coverStyle: "light" | "dark" | "none";
  primaryColor: string;
  accentColor: string;
  showLogo: boolean;
  showPageNumbers: boolean;
  footerText: string;
  watermarkDraftText: string;
};

type TemplateContentConfig = {
  showCoverPage: boolean;
  showCompanyInfo: boolean;
  showProjectInfo: boolean;
  showTermsSection: boolean;
  showExclusionsSection: boolean;
  showSignatureSection: boolean;
  showInternalCostFieldsToClient: boolean;
  denseTechnicalTable: boolean;
  columns: {
    specification: boolean;
    roomOrZone: boolean;
    drawingReference: boolean;
    notes: boolean;
    brandModel: boolean;
  };
};

type TemplateView = {
  id: string;
  industryKey: string | null;
  industryName: string | null;
  name: string;
  code: string;
  type: string;
  description: string;
  styleConfig: TemplateStyleConfig;
  contentConfig: TemplateContentConfig;
  isDefault: boolean;
  isActive: boolean;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; footerText: string; primaryColor: string; accentColor: string; content: TemplateContentConfig; showLogo: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<TemplateView[]>("/api/templates?includeInactive=true", signal);
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

  const industries = useMemo(() => {
    const set = new Set(templates.map((t) => t.industryName).filter((name): name is string => Boolean(name)));
    return Array.from(set);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (industryFilter === "all") return templates;
    if (industryFilter === "global") return templates.filter((t) => !t.industryName);
    return templates.filter((t) => t.industryName === industryFilter);
  }, [templates, industryFilter]);

  const startEdit = useCallback((template: TemplateView) => {
    setEditingId(template.id);
    setDraft({
      name: template.name,
      footerText: template.styleConfig.footerText,
      primaryColor: template.styleConfig.primaryColor,
      accentColor: template.styleConfig.accentColor,
      showLogo: template.styleConfig.showLogo,
      content: template.contentConfig,
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !draft) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await apiClient.put(`/api/templates/${encodeURIComponent(editingId)}`, {
        name: draft.name,
        styleConfig: { footerText: draft.footerText, primaryColor: draft.primaryColor, accentColor: draft.accentColor, showLogo: draft.showLogo },
        contentConfig: draft.content,
      });
      setEditingId(null);
      setDraft(null);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [draft, editingId, load]);

  const setDefault = useCallback(async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiClient.post(`/api/templates/${encodeURIComponent(id)}/default`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiClient.put(`/api/templates/${encodeURIComponent(id)}/active`, { isActive: !isActive });
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const duplicate = useCallback(async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiClient.post(`/api/templates/${encodeURIComponent(id)}/duplicate`);
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
        <p className="text-lg font-semibold text-white">Loading templates</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Templates unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Templates</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Document templates</h1>
        <p className="mt-3 text-slate-400">Manage the document layouts used for BOQ generation. Click Preview to see how each one actually looks.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIndustryFilter("all")}
            className={`rounded-full px-4 py-2 text-sm ${industryFilter === "all" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setIndustryFilter("global")}
            className={`rounded-full px-4 py-2 text-sm ${industryFilter === "global" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
          >
            All industries
          </button>
          {industries.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setIndustryFilter(name)}
              className={`rounded-full px-4 py-2 text-sm ${industryFilter === name ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
            >
              {name}
            </button>
          ))}
        </div>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
            <div
              aria-hidden="true"
              className="mb-4 overflow-hidden rounded-2xl border border-slate-800"
            >
              {template.styleConfig.coverStyle !== "none" && (
                <div
                  className="flex h-10 items-center gap-2 px-3"
                  style={{
                    backgroundColor: template.styleConfig.coverStyle === "dark" ? template.styleConfig.primaryColor : "#0F172A",
                    flexDirection: template.styleConfig.direction === "rtl" ? "row-reverse" : "row",
                  }}
                >
                  {template.styleConfig.showLogo && (
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: template.styleConfig.accentColor }} />
                  )}
                  <span className="h-1.5 w-12 rounded-full bg-white/40" />
                </div>
              )}
              <div className="space-y-1.5 bg-slate-950 p-3">
                <span
                  className="block h-1.5 rounded-full bg-slate-700"
                  style={{ width: "60%", marginLeft: template.styleConfig.direction === "rtl" ? "auto" : undefined }}
                />
                {Array.from({ length: template.contentConfig.denseTechnicalTable ? 4 : 3 }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="flex gap-1"
                    style={{ flexDirection: template.styleConfig.direction === "rtl" ? "row-reverse" : "row" }}
                  >
                    <span className="h-1 flex-[2] rounded-full bg-slate-800" />
                    <span className="h-1 flex-1 rounded-full bg-slate-800" />
                    {template.contentConfig.denseTechnicalTable && <span className="h-1 flex-1 rounded-full bg-slate-800" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{template.type.replace(/_/g, " ")}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{template.name}</h3>
              </div>
              <div className="flex flex-col items-end gap-1">
                {template.isDefault && <span className="rounded-full bg-blue-950/60 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-blue-300">Default</span>}
                <span className={`rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] ${template.isActive ? "bg-emerald-950/60 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                  {template.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-400">{template.description}</p>
            <p className="mt-2 text-xs text-slate-500">{template.industryName ?? "All industries"} · {template.code}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={`/api/templates/${encodeURIComponent(template.id)}/preview-html`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Preview
              </a>
              <button
                type="button"
                onClick={() => startEdit(template)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void duplicate(template.id)}
                disabled={busyId === template.id}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                Duplicate
              </button>
              {!template.isDefault && (
                <button
                  type="button"
                  onClick={() => void setDefault(template.id)}
                  disabled={busyId === template.id}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  Set default
                </button>
              )}
              <button
                type="button"
                onClick={() => void toggleActive(template.id, template.isActive)}
                disabled={busyId === template.id}
                className="rounded-2xl border border-rose-900 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50"
              >
                {template.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingId && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h3 className="text-xl font-semibold text-white">Edit template</h3>

            <label className="mt-5 block text-sm text-slate-300">
              <span className="text-slate-400">Name</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Footer text</span>
              <input
                value={draft.footerText}
                onChange={(event) => setDraft({ ...draft, footerText: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Primary colour</span>
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-800 bg-slate-900"
                />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Accent colour</span>
                <input
                  type="color"
                  value={draft.accentColor}
                  onChange={(event) => setDraft({ ...draft, accentColor: event.target.value })}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-800 bg-slate-900"
                />
              </label>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Visibility</p>
              {([
                ["showLogo", "Logo"],
                ["showCoverPage_content", "Cover page"],
                ["showCompanyInfo", "Company info"],
                ["showProjectInfo", "Project / client info"],
                ["showTermsSection", "Terms section"],
                ["showExclusionsSection", "Exclusions section"],
                ["showSignatureSection", "Signature section"],
                ["showInternalCostFieldsToClient", "Show internal cost to client audience"],
              ] as const).map(([key, label]) => {
                const checked = key === "showLogo" ? draft.showLogo : key === "showCoverPage_content" ? draft.content.showCoverPage : draft.content[key as keyof TemplateContentConfig] as boolean;
                return (
                  <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (key === "showLogo") setDraft({ ...draft, showLogo: event.target.checked });
                        else if (key === "showCoverPage_content") setDraft({ ...draft, content: { ...draft.content, showCoverPage: event.target.checked } });
                        else setDraft({ ...draft, content: { ...draft.content, [key]: event.target.checked } });
                      }}
                      className="h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Columns</p>
              {(["specification", "roomOrZone", "drawingReference", "notes", "brandModel"] as const).map((key) => (
                <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2">
                  <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <input
                    type="checkbox"
                    checked={draft.content.columns[key]}
                    onChange={(event) => setDraft({ ...draft, content: { ...draft.content, columns: { ...draft.content.columns, [key]: event.target.checked } } })}
                    className="h-4 w-4"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setEditingId(null); setDraft(null); }}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={isSaving}
                className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
