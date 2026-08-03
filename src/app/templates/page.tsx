"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import ExecutiveTemplateThumbnail from "@/components/visuals/executive-template-thumbnail";
import ContractorTemplateThumbnail from "@/components/visuals/contractor-template-thumbnail";
import ConsultantTemplateThumbnail from "@/components/visuals/consultant-template-thumbnail";
import EmptyStateIllustration from "@/components/visuals/empty-state-illustration";

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

type Archetype = "executive" | "contractor" | "consultant";

const ARCHETYPE_BY_TYPE: Record<string, Archetype> = {
  EXECUTIVE_PREMIUM: "executive",
  CORPORATE_TECHNICAL: "contractor",
  MEP_TENDER: "contractor",
  FURNITURE_CATALOGUE: "contractor",
  ARABIC_FORMAL: "consultant",
};

const ARCHETYPE_META: Record<Archetype, { label: string; audience: string; style: string; card: string; thumbnail: (props: { className?: string }) => JSX.Element }> = {
  executive: {
    label: "Executive BOQ",
    audience: "Executives & commercial stakeholders",
    style: "Minimal cover, restrained gold accents, concise commercial totals",
    card: "border-[#C99A3D]/30 hover:border-[#C99A3D]/60 dark:border-[#DDB35E]/25 dark:hover:border-[#DDB35E]/50",
    thumbnail: ExecutiveTemplateThumbnail,
  },
  contractor: {
    label: "Detailed Contractor BOQ",
    audience: "Contractors & site delivery teams",
    style: "Item-dense technical table, labor and material detail, industrial cyan/teal accents",
    card: "border-[#009FE3]/30 hover:border-[#009FE3]/60 dark:border-[#21C7F3]/25 dark:hover:border-[#21C7F3]/50",
    thumbnail: ContractorTemplateThumbnail,
  },
  consultant: {
    label: "Consultant BOQ",
    audience: "Consultants & regulatory review",
    style: "Formal structure, revision control, signature sections, deep navy and gold",
    card: "border-[#20304D]/60 hover:border-[#DDB35E]/50 dark:border-[#20304D] dark:hover:border-[#DDB35E]/40",
    thumbnail: ConsultantTemplateThumbnail,
  },
};

const AVAILABLE_FORMATS = ["CSV", "XLSX", "PDF", "DOCX", "HTML"];

function keySections(content: TemplateContentConfig): string[] {
  const sections: string[] = [];
  if (content.showCoverPage) sections.push("Cover page");
  if (content.showCompanyInfo) sections.push("Company info");
  if (content.showProjectInfo) sections.push("Project & client info");
  if (content.showTermsSection || content.showExclusionsSection) sections.push("Terms & exclusions");
  if (content.showSignatureSection) sections.push("Signature section");
  if (content.denseTechnicalTable) sections.push("Dense technical table");
  return sections.length > 0 ? sections : ["Standard BOQ layout"];
}

const panel = "rounded-[28px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-6 sm:p-8";
const pill = "rounded-full px-4 py-2 text-sm font-medium transition-colors";

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
  const [previewTemplate, setPreviewTemplate] = useState<TemplateView | null>(null);

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

  useEffect(() => {
    if (!previewTemplate) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewTemplate(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [previewTemplate]);

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
      <div className={panel}>
        <p className="text-lg font-semibold text-[#08152E] dark:text-white">Loading templates</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={panel}>
        <p className="text-lg font-semibold text-[#08152E] dark:text-white">Templates unavailable</p>
        <p className="mt-2 text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className={panel}>
        <p className="text-sm uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#8CA0BE]">Template gallery</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#08152E] dark:text-white">BOQ document templates</h1>
        <p className="mt-3 max-w-2xl text-[#536078] dark:text-[#8CA0BE]">
          Three archetypes, one financial engine. Executive summaries for stakeholders, item-dense
          layouts for contractors, and formal structured reports for consultants — pick the one that
          matches who is reading it.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIndustryFilter("all")}
            className={`${pill} ${industryFilter === "all" ? "bg-[#009FE3] text-white dark:bg-[#21C7F3] dark:text-[#040A16]" : "border border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] hover:bg-white dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE] dark:hover:bg-[#091326]"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setIndustryFilter("global")}
            className={`${pill} ${industryFilter === "global" ? "bg-[#009FE3] text-white dark:bg-[#21C7F3] dark:text-[#040A16]" : "border border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] hover:bg-white dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE] dark:hover:bg-[#091326]"}`}
          >
            All industries
          </button>
          {industries.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setIndustryFilter(name)}
              className={`${pill} ${industryFilter === name ? "bg-[#009FE3] text-white dark:bg-[#21C7F3] dark:text-[#040A16]" : "border border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] hover:bg-white dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE] dark:hover:bg-[#091326]"}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="rounded-[28px] border border-rose-300 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{actionError}</p>
            <button type="button" onClick={() => setActionError(null)} className="rounded-2xl border border-rose-400 px-3 py-2 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-1 text-lg font-semibold text-[#08152E] dark:text-white">BOQ templates</h2>
        <p className="mb-4 text-sm text-[#7B879C] dark:text-[#8CA0BE]">Used when generating a Bill of Quantities document for a project.</p>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className={panel}>
          <div className="flex flex-col items-center py-6 text-center">
            <div className="h-24 w-36 text-[#0077B6] dark:text-[#21C7F3]">
              <EmptyStateIllustration className="h-full w-full" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#08152E] dark:text-white">No templates in this filter</p>
            <p className="mt-1 text-sm text-[#7B879C] dark:text-[#8CA0BE]">Choose a different industry filter, or check back once templates are configured.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => {
            const archetype = ARCHETYPE_BY_TYPE[template.type] ?? "contractor";
            const meta = ARCHETYPE_META[archetype];
            const Thumbnail = meta.thumbnail;
            return (
              <div key={template.id} className={`rounded-[28px] border-2 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-[#091326] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${meta.card}`}>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(template)}
                  className="block w-full overflow-hidden rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009FE3] dark:focus-visible:outline-[#21C7F3]"
                  aria-label={`Preview ${template.name}`}
                >
                  <Thumbnail className="h-40 w-full" />
                </button>

                <div className="mt-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#8CA0BE]">{meta.label}</p>
                    <h3 className="mt-1 text-lg font-semibold text-[#08152E] dark:text-white">{template.name}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {template.isDefault && (
                      <span className="rounded-full bg-[#009FE3]/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-[#0077B6] dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]">
                        Selected
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] ${template.isActive ? "bg-[#159A6A]/10 text-[#159A6A] dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-[#EAF1F8] text-[#7B879C] dark:bg-[#101D34] dark:text-[#8CA0BE]"}`}>
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-xs text-[#536078] dark:text-[#8CA0BE]">{meta.audience}</p>
                <p className="mt-2 text-sm text-[#536078] dark:text-[#8CA0BE]">{template.description || meta.style}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {keySections(template.contentConfig).map((section) => (
                    <span key={section} className="rounded-full border border-[#D5E0EC] bg-[#EAF1F8] px-2 py-0.5 text-[10px] text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]">
                      {section}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#7B879C] dark:text-[#8CA0BE]">
                  Formats: {AVAILABLE_FORMATS.join(", ")}
                </p>
                <p className="mt-1 text-xs text-[#7B879C] dark:text-[#8CA0BE]">{template.industryName ?? "All industries"} · {template.code}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(template)}
                    className="rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-3 py-2 text-xs font-semibold text-[#08152E] hover:bg-white dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#F4F8FF] dark:hover:bg-[#091326]"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(template)}
                    className="rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-3 py-2 text-xs font-semibold text-[#08152E] hover:bg-white dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#F4F8FF] dark:hover:bg-[#091326]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void duplicate(template.id)}
                    disabled={busyId === template.id}
                    className="rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-3 py-2 text-xs font-semibold text-[#08152E] hover:bg-white disabled:opacity-50 dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#F4F8FF] dark:hover:bg-[#091326]"
                  >
                    Duplicate
                  </button>
                  {!template.isDefault && (
                    <button
                      type="button"
                      onClick={() => void setDefault(template.id)}
                      disabled={busyId === template.id}
                      className="rounded-2xl border border-[#009FE3]/40 bg-[#009FE3]/10 px-3 py-2 text-xs font-semibold text-[#0077B6] hover:bg-[#009FE3]/20 disabled:opacity-50 dark:border-[#21C7F3]/40 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3] dark:hover:bg-[#21C7F3]/20"
                    >
                      Select
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void toggleActive(template.id, template.isActive)}
                    disabled={busyId === template.id}
                    className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
                  >
                    {template.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="mb-1 text-lg font-semibold text-[#08152E] dark:text-white">Technical report templates</h2>
        <p className="mb-4 text-sm text-[#7B879C] dark:text-[#8CA0BE]">Used when generating an inspection technical report. Not available yet.</p>
      </div>

      <div className={panel}>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="h-20 w-32 text-[#7B879C] dark:text-[#8CA0BE]">
            <EmptyStateIllustration className="h-full w-full" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#08152E] dark:text-white">Coming soon</p>
          <p className="mt-2 max-w-sm text-sm text-[#7B879C] dark:text-[#8CA0BE]">
            Technical report generation hasn&apos;t been built yet. Once it is, its templates will appear in this section automatically.
          </p>
        </div>
      </div>

      {previewTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview: ${previewTemplate.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[#D5E0EC] bg-white dark:border-[#20304D] dark:bg-[#091326]">
            <div className="flex items-center justify-between border-b border-[#D5E0EC] px-6 py-4 dark:border-[#20304D]">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{ARCHETYPE_META[ARCHETYPE_BY_TYPE[previewTemplate.type] ?? "contractor"].label}</p>
                <h3 className="text-lg font-semibold text-[#08152E] dark:text-white">{previewTemplate.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                aria-label="Close preview"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D5E0EC] text-[#536078] hover:bg-[#EAF1F8] dark:border-[#20304D] dark:text-[#8CA0BE] dark:hover:bg-[#101D34]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <iframe
              src={`/api/templates/${encodeURIComponent(previewTemplate.id)}/preview-html`}
              title={`Preview of ${previewTemplate.name}`}
              className="h-full w-full flex-1 bg-white"
            />
          </div>
        </div>
      )}

      {editingId && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[32px] border border-[#D5E0EC] bg-white p-8 dark:border-[#20304D] dark:bg-[#091326]">
            <h3 className="text-xl font-semibold text-[#08152E] dark:text-white">Edit template</h3>

            <label className="mt-5 block text-sm text-[#536078] dark:text-[#8CA0BE]">
              <span>Name</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-4 py-3 text-[#08152E] outline-none focus:border-[#009FE3] dark:border-[#20304D] dark:bg-[#101D34] dark:text-white dark:focus:border-[#21C7F3]"
              />
            </label>

            <label className="mt-4 block text-sm text-[#536078] dark:text-[#8CA0BE]">
              <span>Footer text</span>
              <input
                value={draft.footerText}
                onChange={(event) => setDraft({ ...draft, footerText: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-4 py-3 text-[#08152E] outline-none focus:border-[#009FE3] dark:border-[#20304D] dark:bg-[#101D34] dark:text-white dark:focus:border-[#21C7F3]"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="block text-sm text-[#536078] dark:text-[#8CA0BE]">
                <span>Primary colour</span>
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] dark:border-[#20304D] dark:bg-[#101D34]"
                />
              </label>
              <label className="block text-sm text-[#536078] dark:text-[#8CA0BE]">
                <span>Accent colour</span>
                <input
                  type="color"
                  value={draft.accentColor}
                  onChange={(event) => setDraft({ ...draft, accentColor: event.target.value })}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] dark:border-[#20304D] dark:bg-[#101D34]"
                />
              </label>
            </div>

            <div className="mt-5 space-y-2 text-sm text-[#536078] dark:text-[#8CA0BE]">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#8CA0BE]">Visibility</p>
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
                  <label key={key} className="flex items-center justify-between rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-4 py-2 dark:border-[#20304D] dark:bg-[#101D34]">
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

            <div className="mt-5 space-y-2 text-sm text-[#536078] dark:text-[#8CA0BE]">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#8CA0BE]">Columns</p>
              {(["specification", "roomOrZone", "drawingReference", "notes", "brandModel"] as const).map((key) => (
                <label key={key} className="flex items-center justify-between rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-4 py-2 dark:border-[#20304D] dark:bg-[#101D34]">
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
                className="rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] px-4 py-2 text-sm font-semibold text-[#08152E] hover:bg-white dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#F4F8FF] dark:hover:bg-[#091326]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={isSaving}
                className="rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#21C7F3] dark:text-[#040A16]"
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
