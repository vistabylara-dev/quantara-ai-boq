"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, File, Folder, HardDrive, Loader2, Unplug } from "lucide-react";
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

  const isConnected = provider.connection !== null && provider.connection.status !== "DISCONNECTED";

  const [folderStack, setFolderStack] = useState<{ id: string | undefined; name: string }[]>([{ id: undefined, name: "My Drive" }]);
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1];

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
    setFolderStack((stack) => [...stack, { id: entry.id, name: entry.name }]);
  };

  const goBack = () => {
    setFolderStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  };

  const handleDisconnect = async () => {
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
          <h1 className="mt-4 text-xl font-semibold text-[#0B1630] dark:text-white">Connect Google Drive</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#536078] dark:text-[#B8C4D8]">
            Read-only access to browse your Drive folders and files. Quantara never writes, deletes, or modifies anything in your Drive.
          </p>
          <a
            href="/api/integrations/google-drive/connect"
            className="mt-6 inline-flex rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
          >
            Connect with Google
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
              disabled={isDisconnecting}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
            >
              <Unplug className="h-3.5 w-3.5" aria-hidden="true" /> {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>

          {folderStack.length > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="mt-4 inline-flex items-center gap-1 text-xs text-[#0284C7] hover:underline dark:text-[#22D3EE]"
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
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => entry.isFolder && openFolder(entry)}
                  disabled={!entry.isFolder}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[#EEF3F8] disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-[#111D33]"
                >
                  <span className="flex items-center gap-2 truncate">
                    {entry.isFolder ? (
                      <Folder className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
                    ) : (
                      <File className="h-4 w-4 shrink-0 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
                    )}
                    <span className="truncate text-[#0B1630] dark:text-white">{entry.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-[#7B879C] dark:text-[#7F8DA6]">{entry.isFolder ? "" : formatBytes(entry.sizeBytes)}</span>
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            Importing a selected file into a project is coming next — browsing is live today.
          </p>
        </div>
      )}
    </div>
  );
}
