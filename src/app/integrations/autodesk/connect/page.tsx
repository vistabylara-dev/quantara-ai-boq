"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, File, Folder, HardDrive, Loader2, Unplug } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { useProjectContext, withProjectContext } from "../../project-context";

type AutodeskRuntimeStatus = {
  configured: boolean;
  redirectUri: string | null;
  missingConfiguration: string[];
  connectionStatus: "NOT_CONFIGURED" | "NOT_CONNECTED" | "CONNECTED" | "REAUTH_REQUIRED" | "UNAVAILABLE";
};

type NamedEntry = {
  id: string;
  name: string;
  type: string;
};

type AutodeskContentEntry = {
  id: string;
  name: string;
  type: "folder" | "file";
  isFolder: boolean;
  isFile: boolean;
  isDwg: boolean;
};

type QuantaraProjectOption = {
  id: string;
  databaseId: string;
  reference: string;
  name: string;
};

type AutodeskCandidateResult = {
  candidatesCreated: number;
};

type AnalysisSuccess = {
  candidatesCreated: number;
  project: QuantaraProjectOption;
};

type FolderTrail = { id: string | undefined; name: string };

function ApiError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-rose-700/40 bg-rose-950/10 px-3 py-2 text-sm text-[#D84A4A] dark:bg-rose-950/40 dark:text-rose-300">
      {message}
    </p>
  );
}

export default function AutodeskConnectPage() {
  return (
    <Suspense fallback={null}>
      <AutodeskConnectPageContent />
    </Suspense>
  );
}

function AutodeskConnectPageContent() {
  const t = useTranslations();
  const projectContext = useProjectContext();
  const contextProjectId = projectContext?.projectId ?? null;
  const [runtimeStatus, setRuntimeStatus] = useState<AutodeskRuntimeStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [hubs, setHubs] = useState<NamedEntry[]>([]);
  const [projects, setProjects] = useState<NamedEntry[]>([]);
  const [entries, setEntries] = useState<AutodeskContentEntry[]>([]);
  const [hubId, setHubId] = useState("");
  const [autodeskProjectId, setAutodeskProjectId] = useState("");
  const [folderTrail, setFolderTrail] = useState<FolderTrail[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [selectedDwg, setSelectedDwg] = useState<AutodeskContentEntry | null>(null);
  const [quantaraProjects, setQuantaraProjects] = useState<QuantaraProjectOption[] | null>(null);
  const [quantaraProjectId, setQuantaraProjectId] = useState("");
  const [isQuantaraProjectsLoading, setIsQuantaraProjectsLoading] = useState(false);
  const [quantaraProjectsError, setQuantaraProjectsError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSuccess, setAnalysisSuccess] = useState<AnalysisSuccess | null>(null);

  const currentFolder = folderTrail[folderTrail.length - 1];
  const isConnected = runtimeStatus?.connectionStatus === "CONNECTED";
  const needsReconnect = runtimeStatus?.connectionStatus === "REAUTH_REQUIRED";

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const status = await apiClient.get<AutodeskRuntimeStatus>("/api/integrations/autodesk/status", signal);
      setRuntimeStatus(status);
      setLoadError(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

  const loadHubs = useCallback(async (signal?: AbortSignal) => {
    setIsBrowsing(true);
    setBrowseError(null);
    try {
      const result = await apiClient.get<{ hubs: NamedEntry[] }>("/api/integrations/autodesk/hubs", signal);
      setHubs(result.hubs);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBrowseError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsBrowsing(false);
    }
  }, []);

  const loadProjects = useCallback(async (nextHubId: string, signal?: AbortSignal) => {
    setIsBrowsing(true);
    setBrowseError(null);
    try {
      const result = await apiClient.get<{ projects: NamedEntry[] }>(
        `/api/integrations/autodesk/projects?hubId=${encodeURIComponent(nextHubId)}`,
        signal,
      );
      setProjects(result.projects);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBrowseError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsBrowsing(false);
    }
  }, []);

  const loadContents = useCallback(async (
    nextHubId: string,
    nextProjectId: string,
    folderId: string | undefined,
    signal?: AbortSignal,
  ) => {
    setIsBrowsing(true);
    setBrowseError(null);
    try {
      const params = new URLSearchParams({ hubId: nextHubId, projectId: nextProjectId });
      if (folderId) params.set("folderId", folderId);
      const result = await apiClient.get<{ entries: AutodeskContentEntry[] }>(
        `/api/integrations/autodesk/contents?${params.toString()}`,
        signal,
      );
      setEntries(result.entries);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBrowseError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsBrowsing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStatus(controller.signal);
    const queryError = new URLSearchParams(window.location.search).get("connectError");
    if (queryError) setConnectError(t("integrations.autodesk.connectionError"));
    return () => controller.abort();
  }, [loadStatus, t]);

  useEffect(() => {
    if (!isConnected) return;
    const controller = new AbortController();
    void loadHubs(controller.signal);
    return () => controller.abort();
  }, [isConnected, loadHubs]);

  useEffect(() => {
    if (!isConnected || !hubId) return;
    const controller = new AbortController();
    void loadProjects(hubId, controller.signal);
    return () => controller.abort();
  }, [hubId, isConnected, loadProjects]);

  useEffect(() => {
    if (!isConnected || !hubId || !autodeskProjectId) return;
    const controller = new AbortController();
    void loadContents(hubId, autodeskProjectId, currentFolder?.id, controller.signal);
    return () => controller.abort();
  }, [autodeskProjectId, currentFolder?.id, hubId, isConnected, loadContents]);

  const selectedHub = useMemo(() => hubs.find((hub) => hub.id === hubId) ?? null, [hubId, hubs]);
  const selectedAutodeskProject = useMemo(
    () => projects.find((project) => project.id === autodeskProjectId) ?? null,
    [autodeskProjectId, projects],
  );
  const selectedQuantaraProject = useMemo(
    () => quantaraProjects?.find((project) => project.id === quantaraProjectId) ?? null,
    [quantaraProjectId, quantaraProjects],
  );

  const clearDwgAnalysis = () => {
    setSelectedDwg(null);
    setAnalysisError(null);
    setAnalysisSuccess(null);
  };

  const resetFolders = () => {
    setFolderTrail([{ id: undefined, name: t("integrations.autodesk.files") }]);
    setEntries([]);
    clearDwgAnalysis();
  };

  const chooseHub = (nextHubId: string) => {
    setHubId(nextHubId);
    setAutodeskProjectId("");
    setProjects([]);
    resetFolders();
  };

  const chooseAutodeskProject = (nextProjectId: string) => {
    setAutodeskProjectId(nextProjectId);
    resetFolders();
  };

  const openFolder = (entry: AutodeskContentEntry) => {
    if (!entry.isFolder) return;
    clearDwgAnalysis();
    setFolderTrail((trail) => [...trail, { id: entry.id, name: entry.name }]);
  };

  const goBack = () => {
    clearDwgAnalysis();
    setFolderTrail((trail) => (trail.length > 1 ? trail.slice(0, -1) : trail));
  };

  const loadQuantaraProjects = useCallback(async () => {
    setIsQuantaraProjectsLoading(true);
    setQuantaraProjectsError(null);
    try {
      const result = await apiClient.get<QuantaraProjectOption[]>("/api/projects");
      setQuantaraProjects(result);
      setQuantaraProjectId((current) => {
        if (result.some((project) => project.id === current)) return current;
        if (contextProjectId && result.some((project) => project.id === contextProjectId)) return contextProjectId;
        return result.length === 1 ? result[0].id : "";
      });
    } catch (error) {
      setQuantaraProjectsError(getApiErrorMessage(error));
    } finally {
      setIsQuantaraProjectsLoading(false);
    }
  }, [contextProjectId]);

  useEffect(() => {
    if (
      isConnected
      && contextProjectId
      && quantaraProjects === null
      && !isQuantaraProjectsLoading
      && !quantaraProjectsError
    ) {
      void loadQuantaraProjects();
    }
  }, [contextProjectId, isConnected, isQuantaraProjectsLoading, loadQuantaraProjects, quantaraProjects, quantaraProjectsError]);

  const selectDwg = (entry: AutodeskContentEntry) => {
    if (!entry.isDwg || isAnalyzing) return;
    setSelectedDwg(entry);
    setAnalysisError(null);
    setAnalysisSuccess(null);
    if (quantaraProjects === null && !isQuantaraProjectsLoading) void loadQuantaraProjects();
  };

  const analyzeDwg = async () => {
    if (!selectedDwg || !selectedQuantaraProject || !autodeskProjectId || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisSuccess(null);
    try {
      const result = await apiClient.post<AutodeskCandidateResult>(
        `/api/projects/${encodeURIComponent(selectedQuantaraProject.id)}/integrations/autodesk/extract`,
        { autodeskProjectId, itemId: selectedDwg.id },
      );
      setAnalysisSuccess({ candidatesCreated: result.candidatesCreated, project: selectedQuantaraProject });
    } catch (error) {
      setAnalysisError(getApiErrorMessage(error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const disconnect = async () => {
    if (isDisconnecting || !window.confirm(t("integrations.autodesk.disconnectConfirm"))) return;
    setIsDisconnecting(true);
    setBrowseError(null);
    try {
      await apiClient.post("/api/integrations/autodesk/disconnect", {});
      setRuntimeStatus((current) => current && { ...current, connectionStatus: "NOT_CONNECTED" });
      setHubs([]);
      setProjects([]);
      setEntries([]);
      setHubId("");
      setAutodeskProjectId("");
      setFolderTrail([]);
      clearDwgAnalysis();
    } catch (error) {
      setBrowseError(getApiErrorMessage(error));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const connectAction = needsReconnect ? t("integrations.autodesk.reconnectAction") : t("integrations.autodesk.connectAction");

  return (
    <div className="space-y-6">
      <Link href="/integrations/autodesk" className="inline-flex items-center gap-1 text-xs text-[#7B879C] hover:text-[#0B1630] dark:text-[#7F8DA6] dark:hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {t("integrations.autodesk.backToProvider")}
      </Link>

      {loadError && <ApiError message={loadError} />}
      {connectError && <ApiError message={connectError} />}

      {!runtimeStatus && !loadError && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 text-center dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#0EA5E9]" aria-hidden="true" />
          <p className="mt-3 text-sm text-[#536078] dark:text-[#8CA0BE]">{t("integrations.autodesk.loading")}</p>
        </div>
      )}

      {runtimeStatus?.connectionStatus === "NOT_CONFIGURED" && (
        <section className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <h1 className="text-xl font-bold text-[#0B1630] dark:text-white">{t("integrations.autodesk.configurationRequiredTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#536078] dark:text-[#8CA0BE]">{t("integrations.autodesk.configurationRequiredBody")}</p>
        </section>
      )}

      {runtimeStatus?.connectionStatus === "UNAVAILABLE" && (
        <section className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <h1 className="text-xl font-bold text-[#0B1630] dark:text-white">{t("integrations.autodesk.unavailableTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#536078] dark:text-[#8CA0BE]">{t("integrations.autodesk.unavailableBody")}</p>
          <button type="button" onClick={() => void loadStatus()} className="mt-5 rounded-2xl border border-[#D9E2EC] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:border-[#1E2A42] dark:text-white">
            {t("integrations.tryAgain")}
          </button>
        </section>
      )}

      {runtimeStatus && !isConnected && runtimeStatus.connectionStatus !== "NOT_CONFIGURED" && runtimeStatus.connectionStatus !== "UNAVAILABLE" && (
        <section className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <h1 className="text-xl font-bold text-[#0B1630] dark:text-white">
            {needsReconnect ? t("integrations.autodesk.reconnectTitle") : t("integrations.autodesk.connectTitle")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#536078] dark:text-[#8CA0BE]">
            {needsReconnect ? t("integrations.autodesk.reconnectBody") : t("integrations.autodesk.connectBody")}
          </p>
          <a href={withProjectContext("/api/integrations/autodesk/connect", projectContext)} className="mt-5 inline-flex min-h-10 items-center rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
            {connectAction}
          </a>
          <p className="mt-5 max-w-3xl rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 text-sm text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#8CA0BE]">
            {t("integrations.autodesk.dwgLimitation")}
          </p>
        </section>
      )}

      {isConnected && (
        <section className="rounded-[32px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("integrations.statusConnected")}
              </p>
              <h1 className="mt-2 text-xl font-bold text-[#0B1630] dark:text-white">Autodesk</h1>
              <p className="mt-1 text-sm text-[#536078] dark:text-[#8CA0BE]">{t("integrations.autodesk.connectBody")}</p>
            </div>
            <button type="button" onClick={() => void disconnect()} disabled={isDisconnecting} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[#D9E2EC] px-4 py-2 text-sm font-semibold text-[#0B1630] disabled:opacity-50 dark:border-[#1E2A42] dark:text-white">
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Unplug className="h-4 w-4" aria-hidden="true" />}
              {isDisconnecting ? t("integrations.autodesk.disconnecting") : t("integrations.autodesk.disconnect")}
            </button>
          </div>

          <p className="mt-6 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 text-sm text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#8CA0BE]">
            {t("integrations.autodesk.dwgLimitation")}
          </p>

          {browseError && <div className="mt-5"><ApiError message={browseError} /></div>}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-[#0B1630] dark:text-white">
              {t("integrations.autodesk.hub")}
              <select value={hubId} onChange={(event) => chooseHub(event.target.value)} disabled={isBrowsing} className="mt-2 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm font-normal text-[#0B1630] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">
                <option value="">{t("integrations.autodesk.selectHub")}</option>
                {hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#0B1630] dark:text-white">
              {t("integrations.autodesk.project")}
              <select value={autodeskProjectId} onChange={(event) => chooseAutodeskProject(event.target.value)} disabled={!hubId || isBrowsing} className="mt-2 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm font-normal text-[#0B1630] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">
                <option value="">{t("integrations.autodesk.selectProject")}</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
          </div>

          {isBrowsing && <p className="mt-5 flex items-center gap-2 text-sm text-[#536078] dark:text-[#8CA0BE]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("integrations.autodesk.loading")}</p>}
          {!isBrowsing && isConnected && hubs.length === 0 && <p className="mt-5 text-sm text-[#536078] dark:text-[#8CA0BE]">{t("integrations.autodesk.emptyHubs")}</p>}
          {!isBrowsing && hubId && projects.length === 0 && <p className="mt-5 text-sm text-[#536078] dark:text-[#8CA0BE]">{t("integrations.autodesk.emptyProjects")}</p>}

          {selectedHub && selectedAutodeskProject && (
            <div className="mt-8 rounded-2xl border border-[#D9E2EC] p-4 dark:border-[#1E2A42]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]"><HardDrive className="h-3.5 w-3.5" aria-hidden="true" /> {selectedHub.name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0B1630] dark:text-white">{selectedAutodeskProject.name}</p>
                  <p className="mt-1 truncate text-xs text-[#7B879C] dark:text-[#7F8DA6]">{folderTrail.map((folder) => folder.name).join(" / ")}</p>
                </div>
                {folderTrail.length > 1 && (
                  <button type="button" onClick={goBack} className="inline-flex items-center gap-1 rounded-xl border border-[#D9E2EC] px-3 py-2 text-sm font-semibold text-[#0B1630] dark:border-[#1E2A42] dark:text-white">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("integrations.autodesk.back")}
                  </button>
                )}
              </div>

              {!isBrowsing && entries.length === 0 && <p className="mt-5 text-sm text-[#536078] dark:text-[#8CA0BE]">{t("integrations.autodesk.emptyFolder")}</p>}
              <ul className="mt-4 divide-y divide-[#D9E2EC] dark:divide-[#1E2A42]">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {entry.isFolder ? <Folder className="h-4 w-4 shrink-0 text-[#0EA5E9]" aria-hidden="true" /> : <File className="h-4 w-4 shrink-0 text-[#7B879C]" aria-hidden="true" />}
                      <span className="truncate text-sm font-medium text-[#0B1630] dark:text-white">{entry.name}</span>
                      {entry.isDwg && <span className="shrink-0 rounded-full border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 px-2 py-0.5 text-xs font-semibold text-[#087DAE] dark:text-[#67E8F9]">{t("integrations.autodesk.dwgLabel")}</span>}
                    </div>
                    {entry.isFolder ? (
                      <button type="button" onClick={() => openFolder(entry)} className="shrink-0 rounded-xl border border-[#D9E2EC] px-3 py-2 text-xs font-semibold text-[#0B1630] dark:border-[#1E2A42] dark:text-white">{t("integrations.autodesk.openFolder")}</button>
                    ) : entry.isDwg ? (
                      <button type="button" onClick={() => selectDwg(entry)} disabled={isAnalyzing} className="shrink-0 rounded-xl border border-[#0EA5E9] px-3 py-2 text-xs font-semibold text-[#087DAE] hover:bg-[#0EA5E9]/10 disabled:opacity-50 dark:border-[#22D3EE] dark:text-[#67E8F9]">
                        {selectedDwg?.id === entry.id ? t("integrations.autodesk.selected") : t("integrations.autodesk.selectDwg")}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>

              {selectedDwg && (
                <div className="mt-5 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-5 dark:border-[#1E2A42] dark:bg-[#111D33]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">{t("integrations.autodesk.selectedDwg")}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#0B1630] dark:text-white">{selectedDwg.name}</p>

                  <div className="mt-4">
                    <label htmlFor="autodesk-quantara-project" className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">
                      {t("integrations.autodesk.selectQuantaraProject")}
                    </label>

                    {isQuantaraProjectsLoading ? (
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#7B879C] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#7F8DA6]">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("integrations.autodesk.loadingProjects")}
                      </div>
                    ) : quantaraProjectsError ? (
                      <div className="mt-2 rounded-xl border border-rose-700/40 bg-rose-950/10 p-3 text-sm text-[#D84A4A] dark:bg-rose-950/40 dark:text-rose-300">
                        <p>{quantaraProjectsError}</p>
                        <button type="button" onClick={() => void loadQuantaraProjects()} className="mt-2 text-xs font-semibold underline">
                          {t("integrations.tryAgain")}
                        </button>
                      </div>
                    ) : quantaraProjects?.length === 0 ? (
                      <div className="mt-2 rounded-xl border border-dashed border-[#D9E2EC] bg-white p-4 text-sm text-[#536078] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#B8C4D8]">
                        <p>{t("integrations.autodesk.createProjectFirst")}</p>
                        <Link href="/projects/new" className="mt-2 inline-flex font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]">
                          {t("integrations.autodesk.createProject")}
                        </Link>
                      </div>
                    ) : quantaraProjects ? (
                      <select
                        id="autodesk-quantara-project"
                        value={quantaraProjectId}
                        onChange={(event) => {
                          setQuantaraProjectId(event.target.value);
                          setAnalysisError(null);
                          setAnalysisSuccess(null);
                        }}
                        disabled={isAnalyzing}
                        className="mt-2 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
                      >
                        <option value="">{t("integrations.autodesk.selectQuantaraProjectPrompt")}</option>
                        {quantaraProjects.map((project) => (
                          <option key={project.databaseId} value={project.id}>{project.name} — {project.reference}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  {analysisError && <div className="mt-4"><ApiError message={analysisError} /></div>}

                  {analysisSuccess ? (
                    <div aria-live="polite" className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-950/10 p-4 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <p className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("integrations.autodesk.reviewCandidatesCreated", { count: analysisSuccess.candidatesCreated })}
                      </p>
                      <Link href={`/projects/${encodeURIComponent(analysisSuccess.project.id)}/extractions`} className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                        {t("integrations.autodesk.reviewExtraction")}
                      </Link>
                    </div>
                  ) : quantaraProjects && quantaraProjects.length > 0 ? (
                    <button type="button" onClick={() => void analyzeDwg()} disabled={!selectedQuantaraProject || isAnalyzing} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
                      {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {isAnalyzing ? t("integrations.autodesk.readingDrawing") : t("integrations.autodesk.analyzeForBoq")}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
