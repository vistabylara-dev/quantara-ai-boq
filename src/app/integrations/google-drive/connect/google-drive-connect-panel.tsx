"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, ExternalLink, File, Folder, HardDrive, Loader2, Unplug } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ProviderDetail = {
  connection: { status: string; connectedAt: string; lastSyncAt: string | null } | null;
};

type DriveEntry = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  sizeBytes: number | null;
  modifiedTime: string;
  webViewLink: string | null;
  canImport: boolean;
  unsupportedReason: string | null;
};

type ProjectOption = {
  id: string;
  databaseId: string;
  reference: string;
  name: string;
};

type DriveImportResult = {
  file: {
    id: string;
    originalName: string;
  };
  duplicateOfFileId: string | null;
};

type ImportSuccess = {
  fileName: string;
  project: ProjectOption;
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GoogleDriveConnectPanel({ provider }: { provider: ProviderDetail }) {
  const searchParams = useSearchParams();
  const connectError = searchParams.get("connectError");
  const justConnected = searchParams.get("connected") === "1";

  const connectionNeedsReconnect = provider.connection !== null
    && ["ERROR", "REAUTH_REQUIRED"].includes(provider.connection.status);
  const isConnected = provider.connection !== null
    && !["DISCONNECTED", "ERROR", "REAUTH_REQUIRED"].includes(provider.connection.status);

  const [folderStack, setFolderStack] = useState<{ id: string | undefined; name: string }[]>([{ id: undefined, name: "My Drive" }]);
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveEntry | null>(null);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);

  const currentFolder = folderStack[folderStack.length - 1];
  const selectedProject = projects?.find((project) => project.id === selectedProjectId) ?? null;

  const loadEntries = useCallback(async (folderId: string | undefined, signal?: AbortSignal) => {
    setIsLoading(true);
    setBrowseError(null);
    try {
      const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
      const result = await apiClient.get<{ entries: DriveEntry[] }>(`/api/integrations/google-drive/files${query}`, signal);
      setEntries(result.entries);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBrowseError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const controller = new AbortController();
    void loadEntries(currentFolder.id, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, currentFolder.id]);

  const openFolder = (entry: DriveEntry) => {
    setSelectedFile(null);
    setImportError(null);
    setImportSuccess(null);
    setFolderStack((stack) => [...stack, { id: entry.id, name: entry.name }]);
  };

  const goBack = () => {
    if (isImporting) return;
    setSelectedFile(null);
    setImportError(null);
    setImportSuccess(null);
    setFolderStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  };

  const loadProjects = useCallback(async () => {
    setIsProjectsLoading(true);
    setProjectsError(null);
    try {
      const result = await apiClient.get<ProjectOption[]>("/api/projects");
      setProjects(result);
      setSelectedProjectId((current) => {
        if (result.some((project) => project.id === current)) return current;
        return result.length === 1 ? result[0].id : "";
      });
    } catch (error) {
      setProjectsError(getApiErrorMessage(error));
    } finally {
      setIsProjectsLoading(false);
    }
  }, []);

  const selectFile = (entry: DriveEntry) => {
    if (isImporting) return;
    setSelectedFile(entry);
    setImportError(null);
    setImportSuccess(null);
    if (projects === null && !isProjectsLoading) void loadProjects();
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedProject || isImporting) return;

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const result = await apiClient.post<DriveImportResult>("/api/integrations/google-drive/import", {
        googleFileId: selectedFile.id,
        projectId: selectedProject.id,
      });
      setImportSuccess({
        fileName: result.file.originalName || selectedFile.name,
        project: selectedProject,
      });
    } catch (error) {
      setImportError(getApiErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  };

  const handleDisconnect = async () => {
    if (isImporting) return;
    if (!window.confirm("Disconnect Google Drive? You can reconnect at any time.")) return;
    setIsDisconnecting(true);
    try {
      await apiClient.post("/api/integrations/google-drive/disconnect", {});
      window.location.reload();
    } catch (error) {
      setBrowseError(getApiErrorMessage(error));
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
      {connectError && (
        <div className="mb-6 rounded-2xl border border-rose-700/40 bg-rose-950/10 px-4 py-3 text-sm text-[#D84A4A] dark:bg-rose-950/40 dark:text-rose-300">
          {connectError}
        </div>
      )}
      {justConnected && !connectError && (
        <div className="mb-6 rounded-2xl border border-emerald-700/40 bg-emerald-950/10 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Google Drive connected successfully.
        </div>
      )}

      {!isConnected ? (
        <div className="text-center">
          <HardDrive className="mx-auto h-8 w-8 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-[#0B1630] dark:text-white">
            {connectionNeedsReconnect ? "Reconnect Google Drive" : "Connect Google Drive"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#536078] dark:text-[#B8C4D8]">
            {connectionNeedsReconnect
              ? "Your Google authorization has expired or needs attention. Reconnect to resume secure, read-only browsing and import."
              : "Read-only access to browse your Drive folders and files. Quantara never writes, deletes, or modifies anything in your Drive."}
          </p>
          <a
            href="/api/integrations/google-drive/connect"
            className="mt-6 inline-flex rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
          >
            {connectionNeedsReconnect ? "Reconnect with Google" : "Connect with Google"}
          </a>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#111D33]">
                <HardDrive className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Google Drive — Connected</p>
                <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Browsing: {currentFolder.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={isDisconnecting || isImporting}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
            >
              <Unplug className="h-3.5 w-3.5" aria-hidden="true" /> {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>

          {folderStack.length > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={isImporting}
              className="mt-4 inline-flex items-center gap-1 text-xs text-[#0284C7] hover:underline disabled:opacity-50 dark:text-[#22D3EE]"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
            </button>
          )}

          {browseError && (
            <div className="mt-4 rounded-2xl border border-rose-700/40 bg-rose-950/10 px-4 py-3 text-sm text-[#D84A4A] dark:bg-rose-950/40 dark:text-rose-300">
              {browseError}
            </div>
          )}

          {isLoading ? (
            <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-[#7B879C] dark:text-[#7F8DA6]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#D9E2EC] rounded-2xl border border-[#D9E2EC] dark:divide-[#1E2A42] dark:border-[#1E2A42]">
              {entries.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-[#7B879C] dark:text-[#7F8DA6]">This folder is empty.</p>
              )}
              {entries.map((entry) => {
                if (entry.isFolder) {
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => openFolder(entry)}
                      disabled={isImporting}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[#EEF3F8] disabled:opacity-50 dark:hover:bg-[#111D33]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Folder className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
                        <span className="truncate text-[#0B1630] dark:text-white">{entry.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-[#0284C7] dark:text-[#22D3EE]">Open folder</span>
                    </button>
                  );
                }

                const isSelected = selectedFile?.id === entry.id;
                return (
                  <div key={entry.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${isSelected ? "bg-[#EEF3F8] dark:bg-[#111D33]" : ""}`}>
                    <span className="flex min-w-0 items-center gap-2">
                      <File className="h-4 w-4 shrink-0 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#0B1630] dark:text-white">{entry.name}</span>
                        <span className="block truncate text-xs text-[#7B879C] dark:text-[#7F8DA6]">{entry.mimeType}</span>
                        {!entry.canImport && entry.unsupportedReason ? (
                          <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">{entry.unsupportedReason}</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{formatBytes(entry.sizeBytes)}</span>
                      {!entry.canImport ? (
                        <span
                          className="rounded-xl border border-[#D9E2EC] px-3 py-1.5 text-xs text-[#7B879C] dark:border-[#1E2A42] dark:text-[#7F8DA6]"
                          title={entry.unsupportedReason ?? "This file cannot be imported."}
                        >
                          Not supported
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectFile(entry)}
                          disabled={isImporting}
                          className="rounded-xl border border-[#0EA5E9] px-3 py-1.5 text-xs font-semibold text-[#0284C7] hover:bg-[#0EA5E9]/10 disabled:opacity-50 dark:border-[#22D3EE] dark:text-[#22D3EE]"
                        >
                          {isSelected ? "Selected" : "Select"}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedFile && (
            <div className="mt-5 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-5 dark:border-[#1E2A42] dark:bg-[#111D33]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">Selected Drive file</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#0B1630] dark:text-white">{selectedFile.name}</p>
                  <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">
                    {selectedFile.mimeType} · {formatBytes(selectedFile.sizeBytes)}
                  </p>
                </div>
                {selectedFile.webViewLink && (
                  <a
                    href={selectedFile.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]"
                  >
                    View in Drive <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="google-drive-project" className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">
                  Destination project
                </label>

                {isProjectsLoading ? (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#7B879C] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#7F8DA6]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading projects…
                  </div>
                ) : projectsError ? (
                  <div className="mt-2 rounded-xl border border-rose-700/40 bg-rose-950/10 p-3 text-sm text-[#D84A4A] dark:bg-rose-950/40 dark:text-rose-300">
                    <p>{projectsError}</p>
                    <button type="button" onClick={() => void loadProjects()} className="mt-2 text-xs font-semibold underline">
                      Try again
                    </button>
                  </div>
                ) : projects?.length === 0 ? (
                  <div className="mt-2 rounded-xl border border-dashed border-[#D9E2EC] bg-white p-4 text-sm text-[#536078] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#B8C4D8]">
                    <p>Create a Quantara project before importing this file.</p>
                    <Link href="/projects/new" className="mt-2 inline-flex font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]">
                      Create a project
                    </Link>
                  </div>
                ) : projects ? (
                  <select
                    id="google-drive-project"
                    value={selectedProjectId}
                    onChange={(event) => {
                      setSelectedProjectId(event.target.value);
                      setImportError(null);
                      setImportSuccess(null);
                    }}
                    disabled={isImporting}
                    className="mt-2 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
                  >
                    <option value="">Select a project…</option>
                    {projects.map((project) => (
                      <option key={project.databaseId} value={project.id}>{project.name} — {project.reference}</option>
                    ))}
                  </select>
                ) : null}
              </div>

              {importError && (
                <p role="alert" className="mt-4 rounded-xl border border-rose-700/40 bg-rose-950/10 px-3 py-2 text-sm text-[#D84A4A] dark:bg-rose-950/40 dark:text-rose-300">
                  {importError}
                </p>
              )}

              {importSuccess && (
                <div aria-live="polite" className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-950/10 p-4 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {importSuccess.fileName} imported successfully.
                  </p>
                  <p className="mt-1 text-xs">Destination: {importSuccess.project.name} ({importSuccess.project.reference})</p>
                  <Link
                    href={`/projects/${encodeURIComponent(importSuccess.project.id)}/files`}
                    className="mt-3 inline-flex font-semibold hover:underline"
                  >
                    Open project files →
                  </Link>
                </div>
              )}

              {!importSuccess && projects && projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={!selectedProject || isImporting}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {isImporting ? "Importing…" : `Import into ${selectedProject?.name ?? "project"}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
