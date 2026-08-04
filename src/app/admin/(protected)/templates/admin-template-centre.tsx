"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Mail, ClipboardList, LayoutTemplate } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type TemplateVersionStatus = "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED" | "RETIRED";

type VersionSummary = {
  id: string;
  versionNumber: number;
  status: TemplateVersionStatus;
  changeSummary: string;
  effectiveDate: string | null;
  retiredDate: string | null;
  createdAt: string;
  createdByUser?: { fullName: string; email: string } | null;
};

type ListRow = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  code: string;
  isActive: boolean;
  isDefault: boolean;
  versionCount: number;
  publishedVersion: VersionSummary | null;
  latestVersion: VersionSummary | null;
  usageCount: number;
  type?: string;
  category?: string;
  disciplineTag?: string;
};

type TemplateDetail = ListRow & { versions: VersionSummary[] };

type TemplateKind = "boq" | "technical-reports" | "email";

const ALLOWED_TRANSITIONS: Record<TemplateVersionStatus, TemplateVersionStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["PUBLISHED", "REVIEW"],
  PUBLISHED: ["RETIRED"],
  RETIRED: [],
};

const KIND_LABELS: Record<TemplateKind, string> = {
  boq: "BOQ Documents",
  "technical-reports": "Technical Reports",
  email: "Email",
};

const KIND_ICONS: Record<TemplateKind, typeof FileText> = {
  boq: FileText,
  "technical-reports": ClipboardList,
  email: Mail,
};

const panel = "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";

const STATUS_TONE: Record<TemplateVersionStatus, string> = {
  DRAFT: "text-[#7B879C] dark:text-[#7F8DA6]",
  REVIEW: "text-[#B4841F] dark:text-[#E0B25C]",
  APPROVED: "text-[#0284C7] dark:text-[#22D3EE]",
  PUBLISHED: "text-[#159A6A] dark:text-emerald-300",
  RETIRED: "text-[#D84A4A] dark:text-rose-300",
};

function StatusBadge({ status }: { status: TemplateVersionStatus }) {
  return <span className={`text-xs font-semibold uppercase tracking-wide ${STATUS_TONE[status]}`}>{status}</span>;
}

export default function AdminTemplateCentre() {
  const [kind, setKind] = useState<TemplateKind>("boq");
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const [draftForm, setDraftForm] = useState({ a: "", b: "", c: "", changeSummary: "" });
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);

  const loadList = useCallback(async (activeKind: TemplateKind, signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const data = await apiClient.get<ListRow[]>(`/api/admin/templates/${activeKind}`, signal);
      setRows(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSelectedId(null);
    setDetail(null);
    void loadList(kind, controller.signal);
    return () => controller.abort();
  }, [kind, loadList]);

  const loadDetail = useCallback(async (activeKind: TemplateKind, templateId: string, signal?: AbortSignal) => {
    setDetailError(null);
    try {
      const data = await apiClient.get<TemplateDetail>(`/api/admin/templates/${activeKind}/${templateId}`, signal);
      setDetail(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDetailError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void loadDetail(kind, selectedId, controller.signal);
    return () => controller.abort();
  }, [kind, selectedId, loadDetail]);

  const refreshAll = useCallback(async () => {
    await loadList(kind);
    if (selectedId) await loadDetail(kind, selectedId);
  }, [kind, selectedId, loadList, loadDetail]);

  const transition = useCallback(async (versionId: string, status: TemplateVersionStatus) => {
    setBusyVersionId(versionId);
    setActionMessage(null);
    try {
      await apiClient.patch(`/api/admin/templates/${kind}/versions/${versionId}`, { status });
      setActionMessage(`Version moved to ${status}.`);
      await refreshAll();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setBusyVersionId(null);
    }
  }, [kind, refreshAll]);

  const submitDraft = useCallback(async () => {
    if (!selectedId) return;
    setIsSubmittingDraft(true);
    setActionMessage(null);
    try {
      let body: Record<string, unknown>;
      if (kind === "boq") {
        body = {
          styleConfigJson: JSON.parse(draftForm.a || "{}"),
          contentConfigJson: JSON.parse(draftForm.b || "{}"),
          changeSummary: draftForm.changeSummary || undefined,
        };
      } else if (kind === "technical-reports") {
        body = {
          sectionsJson: JSON.parse(draftForm.a || "{}"),
          changeSummary: draftForm.changeSummary || undefined,
        };
      } else {
        body = {
          subject: draftForm.a,
          bodyHtml: draftForm.b,
          bodyText: draftForm.c,
          changeSummary: draftForm.changeSummary || undefined,
        };
      }
      await apiClient.post(`/api/admin/templates/${kind}/${selectedId}/versions`, body);
      setActionMessage("Draft version created.");
      setDraftForm({ a: "", b: "", c: "", changeSummary: "" });
      await refreshAll();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmittingDraft(false);
    }
  }, [kind, selectedId, draftForm, refreshAll]);

  const prefillFromVersion = useCallback((version: VersionSummary & { styleConfigJson?: unknown; contentConfigJson?: unknown; sectionsJson?: unknown; subject?: string; bodyHtml?: string; bodyText?: string }) => {
    if (kind === "boq") {
      setDraftForm({
        a: JSON.stringify(version.styleConfigJson ?? {}, null, 2),
        b: JSON.stringify(version.contentConfigJson ?? {}, null, 2),
        c: "",
        changeSummary: "",
      });
    } else if (kind === "technical-reports") {
      setDraftForm({ a: JSON.stringify(version.sectionsJson ?? {}, null, 2), b: "", c: "", changeSummary: "" });
    } else {
      setDraftForm({ a: version.subject ?? "", b: version.bodyHtml ?? "", c: version.bodyText ?? "", changeSummary: "" });
    }
  }, [kind]);

  const Icon = KIND_ICONS[kind];

  const totals = useMemo(() => {
    if (!rows) return { templates: 0, published: 0, unpublished: 0 };
    return {
      templates: rows.length,
      published: rows.filter((r) => r.publishedVersion).length,
      unpublished: rows.filter((r) => !r.publishedVersion).length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className={panel}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <LayoutTemplate className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">Quantara Platform Administration</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Template Centre</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#536078] dark:text-[#B8C4D8]">
          Owner-only, cross-company. Inspect every BOQ, technical report, and email template and its governed version history (DRAFT → REVIEW → APPROVED → PUBLISHED → RETIRED). Publishing a version never rewrites what an already-generated document or sent email points to.
        </p>
        <div className="mt-4 flex gap-2">
          {(Object.keys(KIND_LABELS) as TemplateKind[]).map((k) => {
            const KIcon = KIND_ICONS[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  kind === k
                    ? "border-[#0EA5E9] bg-[#0EA5E9] text-white dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
                    : "border-[#D9E2EC] bg-white text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
                }`}
              >
                <KIcon className="h-4 w-4" aria-hidden="true" />
                {KIND_LABELS[k]}
              </button>
            );
          })}
        </div>
      </header>

      {actionMessage && (
        <div className="rounded-2xl border border-[#D9E2EC] bg-white p-4 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">{actionMessage}</div>
      )}

      {loadError && (
        <div className={panel}>
          <p className="text-sm text-[#D84A4A] dark:text-rose-300">Templates unavailable: {loadError}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${panel} lg:col-span-3`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B1630] dark:text-white">
              <Icon className="mr-2 inline h-4 w-4" aria-hidden="true" />
              {KIND_LABELS[kind]} ({totals.templates})
            </p>
            <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{totals.published} published · {totals.unpublished} no published version</p>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
                <tr>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3">Usage</th>
                </tr>
              </thead>
              <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
                {rows?.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer border-t border-[#D9E2EC] dark:border-[#1E2A42] ${selectedId === row.id ? "bg-[#EEF3F8] dark:bg-[#111D33]" : "hover:bg-[#F7FAFC] dark:hover:bg-[#0F1B33]"}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{row.code}{row.isDefault ? " · default" : ""}{!row.isActive ? " · inactive" : ""}</p>
                    </td>
                    <td className="px-4 py-3">{row.companyName}</td>
                    <td className="px-4 py-3">
                      {row.publishedVersion ? (
                        <span className="text-[#159A6A] dark:text-emerald-300">v{row.publishedVersion.versionNumber}</span>
                      ) : (
                        <span className="text-[#D84A4A] dark:text-rose-300">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.usageCount}</td>
                  </tr>
                ))}
                {rows?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[#7B879C] dark:text-[#7F8DA6]">No {KIND_LABELS[kind].toLowerCase()} templates exist yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${panel} lg:col-span-2`}>
          <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Version history</p>
          {detailError && <p className="mt-2 text-sm text-[#D84A4A] dark:text-rose-300">{detailError}</p>}
          {!selectedId && <p className="mt-2 text-sm text-[#7B879C] dark:text-[#7F8DA6]">Select a template on the left to inspect its versions.</p>}
          {selectedId && detail && (
            <div className="mt-3 space-y-4">
              <div>
                <p className="font-semibold text-[#0B1630] dark:text-white">{detail.name}</p>
                <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{detail.companyName} · {detail.code} · used {detail.usageCount} time{detail.usageCount === 1 ? "" : "s"}</p>
              </div>
              <ul className="space-y-2">
                {detail.versions.map((v) => (
                  <li key={v.id} className="rounded-xl border border-[#D9E2EC] p-3 text-xs dark:border-[#1E2A42]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0B1630] dark:text-white">v{v.versionNumber}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    {v.changeSummary && <p className="mt-1 text-[#536078] dark:text-[#B8C4D8]">{v.changeSummary}</p>}
                    <p className="mt-1 text-[#7B879C] dark:text-[#7F8DA6]">
                      {v.createdByUser ? `${v.createdByUser.fullName} · ` : ""}
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ALLOWED_TRANSITIONS[v.status].map((next) => (
                        <button
                          key={next}
                          type="button"
                          disabled={busyVersionId === v.id}
                          onClick={() => void transition(v.id, next)}
                          className="rounded-lg border border-[#D9E2EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
                        >
                          {next === "REVIEW" ? "Submit for review" : next === "APPROVED" ? "Approve" : next === "PUBLISHED" ? "Publish" : next === "RETIRED" ? "Retire" : "Return to draft"}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => prefillFromVersion(v)}
                        className="rounded-lg border border-[#D9E2EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
                      >
                        Duplicate as new draft
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-dashed border-[#D9E2EC] p-3 dark:border-[#1E2A42]">
                <p className="text-xs font-semibold text-[#0B1630] dark:text-white">New draft version</p>
                {kind === "boq" && (
                  <>
                    <label className="mt-2 block text-[11px] text-[#7B879C] dark:text-[#7F8DA6]">Style config (JSON)</label>
                    <textarea value={draftForm.a} onChange={(e) => setDraftForm((f) => ({ ...f, a: e.target.value }))} rows={4} className="mt-1 w-full rounded-lg border border-[#D9E2EC] bg-white p-2 font-mono text-[11px] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
                    <label className="mt-2 block text-[11px] text-[#7B879C] dark:text-[#7F8DA6]">Content config (JSON)</label>
                    <textarea value={draftForm.b} onChange={(e) => setDraftForm((f) => ({ ...f, b: e.target.value }))} rows={4} className="mt-1 w-full rounded-lg border border-[#D9E2EC] bg-white p-2 font-mono text-[11px] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
                  </>
                )}
                {kind === "technical-reports" && (
                  <>
                    <label className="mt-2 block text-[11px] text-[#7B879C] dark:text-[#7F8DA6]">Sections (JSON)</label>
                    <textarea value={draftForm.a} onChange={(e) => setDraftForm((f) => ({ ...f, a: e.target.value }))} rows={6} className="mt-1 w-full rounded-lg border border-[#D9E2EC] bg-white p-2 font-mono text-[11px] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
                  </>
                )}
                {kind === "email" && (
                  <>
                    <label className="mt-2 block text-[11px] text-[#7B879C] dark:text-[#7F8DA6]">Subject</label>
                    <input value={draftForm.a} onChange={(e) => setDraftForm((f) => ({ ...f, a: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D9E2EC] bg-white p-2 text-xs dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
                    <label className="mt-2 block text-[11px] text-[#7B879C] dark:text-[#7F8DA6]">HTML body</label>
                    <textarea value={draftForm.b} onChange={(e) => setDraftForm((f) => ({ ...f, b: e.target.value }))} rows={4} className="mt-1 w-full rounded-lg border border-[#D9E2EC] bg-white p-2 font-mono text-[11px] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
                    <label className="mt-2 block text-[11px] text-[#7B879C] dark:text-[#7F8DA6]">Plain-text body</label>
                    <textarea value={draftForm.c} onChange={(e) => setDraftForm((f) => ({ ...f, c: e.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-[#D9E2EC] bg-white p-2 font-mono text-[11px] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
                  </>
                )}
                <label className="mt-2 block text-[11px] text-[#7B879C] dark:text-[#7F8DA6]">Change summary</label>
                <input value={draftForm.changeSummary} onChange={(e) => setDraftForm((f) => ({ ...f, changeSummary: e.target.value }))} className="mt-1 w-full rounded-lg border border-[#D9E2EC] bg-white p-2 text-xs dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
                <button
                  type="button"
                  disabled={isSubmittingDraft}
                  onClick={() => void submitDraft()}
                  className="mt-3 rounded-xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
                >
                  {isSubmittingDraft ? "Creating…" : "Create draft version"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
