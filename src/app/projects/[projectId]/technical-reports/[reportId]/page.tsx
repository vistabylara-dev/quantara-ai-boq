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
};

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
        </aside>
      </div>
    </div>
  );
}
