"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import type { BOQ } from "@/types/boq";
import type { Project } from "@/types/project";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { CommercialUnlockPanel } from "@/components/commercial/commercial-unlock-panel";
import type { CommercialAccessDecision } from "@/lib/commercial/commercial-types";
import { GuideTip } from "@/components/guidance/guide-tip";
import { useLocale } from "@/lib/i18n/locale-provider";

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
  const { locale, t } = useLocale();
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

  const [commercialDecision, setCommercialDecision] = useState<{ boqId: string; decision: CommercialAccessDecision } | null>(null);
  const [isCheckingUnlock, setIsCheckingUnlock] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [generatedOk, setGeneratedOk] = useState(false);

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
    const query = new URLSearchParams({ boqId: selectedBoqId, templateId: selectedTemplateId, audience: selectedAudience, locale });
    return `/api/projects/${encodeURIComponent(params.projectId)}/documents/preview-html?${query.toString()}`;
  }, [locale, params.projectId, selectedAudience, selectedBoqId, selectedTemplateId]);

  const handlePrint = useCallback(() => {
    iframeRef.current?.contentWindow?.print();
  }, []);

  const selectedBoq = useMemo(() => boqs.find((boq) => boq.id === selectedBoqId) ?? null, [boqs, selectedBoqId]);

  const downloadCleanVersion = useCallback(async () => {
    const boqId = selectedBoqId;
    if (!boqId || !selectedTemplateId) return;
    setDownloadError(null);
    setCommercialDecision(null);
    setGeneratedOk(false);
    setIsCheckingUnlock(true);
    try {
      const decision = await apiClient.get<CommercialAccessDecision>(
        `/api/boqs/${encodeURIComponent(boqId)}/commercial-requirements`,
      );
      if (decision.status !== "ALLOW") {
        // Pair the decision with the boqId it was actually resolved for —
        // if the user changes the BOQ selector while this request is
        // in-flight, the panel must stay aligned with the manifest
        // fingerprint instead of silently using the now-current selection.
        setCommercialDecision({ boqId, decision });
        return;
      }
      await apiClient.post(`/api/projects/${encodeURIComponent(params.projectId)}/documents/generate`, {
        boqId,
        templateId: selectedTemplateId,
        documentType: "PDF",
        audience: selectedAudience,
      });
      setGeneratedOk(true);
    } catch (error) {
      setDownloadError(getApiErrorMessage(error));
    } finally {
      setIsCheckingUnlock(false);
    }
  }, [params.projectId, selectedAudience, selectedBoqId, selectedTemplateId]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("preview.loadingPreview")}</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("preview.previewUnavailable")}</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? t("preview.projectLoadFailed")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("preview.title")}</p>
              <GuideTip
                title={t("preview.helpTitle")}
                shortDescription={t("preview.helpShort")}
                whatQuantaraDoes={t("preview.helpQuantara")}
                whatProfessionalCanDo={t("preview.helpProfessional")}
                cta={selectedBoq && previewUrl && !isCheckingUnlock ? {
                  label: t("preview.downloadCleanVersion"),
                  onAction: () => {
                    const downloadButton = document.getElementById("clean-download-button");
                    downloadButton?.scrollIntoView({ behavior: "smooth", block: "center" });
                    downloadButton?.focus({ preventScroll: true });
                  },
                } : undefined}
                ariaLabel={t("preview.helpAriaLabel")}
              />
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">{project.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{t("preview.printSafeLayout")}</p>
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
              onPointerDown={(event) => {
                if (templates.length === 0) {
                  event.preventDefault();
                  window.location.assign("/templates");
                }
              }}
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
              <option value="CLIENT">{t("preview.clientView")}</option>
              <option value="INTERNAL">{t("preview.internalView")}</option>
            </select>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!previewUrl}
              className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("preview.print")}
            </button>
          </div>
        </div>

        {selectedBoq && (
          <div className="mt-6 flex flex-wrap items-center gap-6 rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t("preview.sections")}</p>
              <p className="text-lg font-semibold text-white">{selectedBoq.sections.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t("preview.items")}</p>
              <p className="text-lg font-semibold text-white">{selectedBoq.sections.reduce((sum, s) => sum + s.items.length, 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t("preview.grandTotal")}</p>
              <p className="text-lg font-semibold text-white" dir="ltr">
                {project.currency} {selectedBoq.totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="ms-auto">
              <button
                id="clean-download-button"
                type="button"
                onClick={() => void downloadCleanVersion()}
                disabled={isCheckingUnlock || !previewUrl}
                className="rounded-2xl border border-slate-700 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCheckingUnlock ? t("preview.checking") : t("preview.downloadCleanVersion")}
              </button>
            </div>
          </div>
        )}

        {downloadError && <p className="mt-3 text-xs text-rose-300">{downloadError}</p>}
        {generatedOk && (
          <p className="mt-3 text-xs text-emerald-300">
            {t("preview.generating")}{" "}
            <Link href={`/projects/${encodeURIComponent(params.projectId)}/documents`} className="underline hover:text-emerald-200">
              {t("preview.viewInDocuments")} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">{"→"}</span>
            </Link>
          </p>
        )}
      </div>

      {commercialDecision && (
        <CommercialUnlockPanel
          boqId={commercialDecision.boqId}
          decision={commercialDecision.decision}
          onWorkSaved={() => setDownloadError(null)}
        />
      )}

      <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-white">
        {previewUrl ? (
          <iframe ref={iframeRef} src={previewUrl} title={t("preview.documentPreviewIframeTitle")} className="h-[1200px] w-full border-0" />
        ) : !selectedTemplateId && selectedBoqId ? (
          <Link href="/templates" className="block p-8 text-center text-slate-500 no-underline">
            {t("preview.selectRevisionAndTemplate")}
          </Link>
        ) : (
          <div className="p-8 text-center text-slate-500">{t("preview.selectRevisionAndTemplate")}</div>
        )}
      </div>
    </div>
  );
}
