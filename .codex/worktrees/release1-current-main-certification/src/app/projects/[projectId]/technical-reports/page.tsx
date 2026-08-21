"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import type { Project } from "@/types/project";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type ReportTemplateSummary = {
  id: string;
  name: string;
  code: string;
  disciplineTag: string;
  isActive: boolean;
};

type GeneratedTechnicalReportView = {
  id: string;
  templateId: string;
  templateName: string;
  templateVersionNumber: number | null;
  name: string;
  status: "DRAFT" | "COMPLETED";
  fileName: string | null;
  fileSize: number | null;
  generatedByName: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectTechnicalReportsPage(props: PageProps) {
  const params = use(props.params);
  const [project, setProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<ReportTemplateSummary[]>([]);
  const [reports, setReports] = useState<GeneratedTechnicalReportView[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [reportName, setReportName] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const encodedProjectId = encodeURIComponent(params.projectId);
      const [projectData, templateData, reportData] = await Promise.all([
        apiClient.get<Project>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<ReportTemplateSummary[]>("/api/report-templates", signal),
        apiClient.get<GeneratedTechnicalReportView[]>(`/api/projects/${encodedProjectId}/technical-reports`, signal),
      ]);
      setProject(projectData);
      setTemplates(templateData);
      setReports(reportData);
      setSelectedTemplateId((current) => current || templateData[0]?.id || "");
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

  const createReport = useCallback(async () => {
    if (!selectedTemplateId) return;
    setActionError(null);
    setIsCreating(true);
    try {
      const created = await apiClient.post<GeneratedTechnicalReportView>(`/api/projects/${encodeURIComponent(params.projectId)}/technical-reports`, {
        templateId: selectedTemplateId,
        name: reportName.trim() || `${templates.find((t) => t.id === selectedTemplateId)?.name ?? "Technical report"} — ${project?.name ?? ""}`.trim(),
      });
      setReportName("");
      window.location.href = `/projects/${params.projectId}/technical-reports/${created.id}`;
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }, [params.projectId, project?.name, reportName, selectedTemplateId, templates]);

  const deleteReport = useCallback(async (reportId: string) => {
    setDeletingId(reportId);
    setActionError(null);
    try {
      await apiClient.delete(`/api/technical-reports/${encodeURIComponent(reportId)}`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }, [load]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading technical reports</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Technical reports unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This project could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Technical reports</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{project.name} technical reports</h2>
        <p className="mt-3 text-slate-400">
          Pick a report template, fill in the project-specific fields, and generate a Word document — the same structure every
          time, none of your source content invented.
        </p>
        <Link href="/templates" className="mt-4 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
          Manage report templates
        </Link>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h3 className="text-xl font-semibold text-white">Reports</h3>
          <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-semibold text-white">
                      <Link href={`/projects/${params.projectId}/technical-reports/${report.id}`} className="hover:underline">
                        {report.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {report.templateName}
                      {report.templateVersionNumber !== null && (
                        <span className="ml-1.5 text-xs text-slate-500">v{report.templateVersionNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={report.status === "COMPLETED" ? "text-emerald-300" : "text-slate-400"}>{report.status}</span>
                      {report.errorMessage && <p className="mt-1 max-w-[200px] text-xs text-rose-400">{report.errorMessage}</p>}
                    </td>
                    <td className="px-4 py-3">{formatFileSize(report.fileSize)}</td>
                    <td className="px-4 py-3">{formatDate(report.createdAt)}</td>
                    <td className="px-4 py-3">{report.generatedByName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {report.status === "COMPLETED" && (
                          <a
                            href={`/api/technical-reports/${encodeURIComponent(report.id)}/download`}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                          >
                            Download
                          </a>
                        )}
                        <Link
                          href={`/projects/${params.projectId}/technical-reports/${report.id}`}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => void deleteReport(report.id)}
                          disabled={deletingId === report.id}
                          className="rounded-xl border border-rose-900 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === report.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No technical reports have been created for this project yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">New report</p>

            {templates.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No report templates are available yet. <Link href="/templates" className="text-blue-400 hover:underline">Import one</Link> to get started.
              </p>
            ) : (
              <>
                <label className="mt-5 block text-sm text-slate-300">
                  <span className="text-slate-400">Template</span>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block text-sm text-slate-300">
                  <span className="text-slate-400">Report name (optional)</span>
                  <input
                    value={reportName}
                    onChange={(event) => setReportName(event.target.value)}
                    placeholder="Defaults to template + project name"
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void createReport()}
                  disabled={!selectedTemplateId || isCreating}
                  className="mt-6 w-full rounded-2xl border border-slate-700 bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? "Creating…" : "Create report"}
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
