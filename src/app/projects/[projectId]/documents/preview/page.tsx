"use client";

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import type { BOQ } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type DocumentTemplateSummary = {
  id: string;
  name: string;
  isDefault: boolean;
};

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ boqId?: string; templateId?: string; audience?: string }>;
};

export default function DocumentPreviewPage(props: PageProps) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  const [project, setProject] = useState<Project | null>(null);
  const [boqs, setBoqs] = useState<BOQ[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);
  const [selectedBoqId, setSelectedBoqId] = useState(searchParams.boqId ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(searchParams.templateId ?? "");
  const [selectedAudience, setSelectedAudience] = useState<"INTERNAL" | "CLIENT">(
    searchParams.audience === "INTERNAL" ? "INTERNAL" : "CLIENT",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const encodedProjectId = encodeURIComponent(params.projectId);
    Promise.all([
      apiClient.get<Project>(`/api/projects/${encodedProjectId}`, controller.signal),
      apiClient.get<BOQ[]>(`/api/projects/${encodedProjectId}/boqs`, controller.signal),
      apiClient.get<DocumentTemplateSummary[]>("/api/templates", controller.signal),
    ])
      .then(([projectData, revisions, templateData]) => {
        setProject(projectData);
        setBoqs(revisions);
        setTemplates(templateData);
        setSelectedBoqId((current) => current || revisions[0]?.id || "");
        setSelectedTemplateId((current) => current || templateData.find((t) => t.isDefault)?.id || templateData[0]?.id || "");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(getApiErrorMessage(error));
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [params.projectId]);

  const previewUrl = useMemo(() => {
    if (!selectedBoqId || !selectedTemplateId) return null;
    const query = new URLSearchParams({ boqId: selectedBoqId, templateId: selectedTemplateId, audience: selectedAudience });
    return `/api/projects/${encodeURIComponent(params.projectId)}/documents/preview-html?${query.toString()}`;
  }, [params.projectId, selectedAudience, selectedBoqId, selectedTemplateId]);

  const handlePrint = useCallback(() => {
    iframeRef.current?.contentWindow?.print();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading preview</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Preview unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This project could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Printable preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{project.name}</h2>
            <p className="mt-2 text-sm text-slate-400">Light, print-safe layout independent of the app theme.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedBoqId}
              onChange={(event) => setSelectedBoqId(event.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {boqs.map((boq) => (
                <option key={boq.id} value={boq.id}>{boq.revision} · {boq.status}</option>
              ))}
            </select>
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <select
              value={selectedAudience}
              onChange={(event) => setSelectedAudience(event.target.value as "INTERNAL" | "CLIENT")}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              <option value="CLIENT">Client view</option>
              <option value="INTERNAL">Internal view</option>
            </select>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!previewUrl}
              className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-white">
        {previewUrl ? (
          <iframe ref={iframeRef} src={previewUrl} title="Document preview" className="h-[1200px] w-full border-0" />
        ) : (
          <div className="p-8 text-center text-slate-500">Select a revision and template to preview.</div>
        )}
      </div>
    </div>
  );
}
