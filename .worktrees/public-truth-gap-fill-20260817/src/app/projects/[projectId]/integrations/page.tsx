"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import { Link2, Plug } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { getProviderById } from "@/lib/integrations/provider-registry";

type ProjectIntegration = {
  id: string;
  externalConnectionId: string;
  externalProjectId: string | null;
  externalFolderId: string | null;
  externalFileId: string | null;
  externalModelId: string | null;
  syncState: string;
  createdAt: string;
};

type ConnectionOption = { id: string; providerId: string; providerAccountId: string | null; status: string };

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectIntegrationsPage(props: PageProps) {
  const params = use(props.params);
  const [links, setLinks] = useState<ProjectIntegration[] | null>(null);
  const [connections, setConnections] = useState<ConnectionOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [externalProjectId, setExternalProjectId] = useState("");
  const [externalFolderId, setExternalFolderId] = useState("");
  const [externalFileId, setExternalFileId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyUnlinkId, setBusyUnlinkId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const [linkData, connectionData] = await Promise.all([
        apiClient.get<ProjectIntegration[]>(`/api/projects/${params.projectId}/integrations`, signal),
        apiClient.get<ConnectionOption[]>("/api/integrations/connections", signal),
      ]);
      setLinks(linkData);
      setConnections(connectionData.filter((c) => c.status === "CONNECTED"));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [params.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleLink = useCallback(async () => {
    if (!selectedConnectionId) return;
    setIsLinking(true);
    setActionMessage(null);
    try {
      await apiClient.post(`/api/projects/${params.projectId}/integrations`, {
        externalConnectionId: selectedConnectionId,
        externalProjectId: externalProjectId || undefined,
        externalFolderId: externalFolderId || undefined,
        externalFileId: externalFileId || undefined,
      });
      setActionMessage("Source linked.");
      setExternalProjectId("");
      setExternalFolderId("");
      setExternalFileId("");
      await load();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsLinking(false);
    }
  }, [params.projectId, selectedConnectionId, externalProjectId, externalFolderId, externalFileId, load]);

  const handleUnlink = useCallback(async (linkId: string) => {
    if (!window.confirm("Unlink this source from the project?")) return;
    setBusyUnlinkId(linkId);
    setActionMessage(null);
    try {
      await apiClient.delete(`/api/projects/${params.projectId}/integrations/${linkId}`);
      setActionMessage("Source unlinked.");
      await load();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setBusyUnlinkId(null);
    }
  }, [params.projectId, load]);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <Link2 className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#7F8DA6]">Project workspace</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Integrations</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-[#536078] dark:text-[#B8C4D8]">
          Link an external project, model, folder, or file to this Quantara project. Connect a provider first from the company Integrations page, then link it here.
        </p>

        {loadError && <p className="mt-4 text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>}
        {actionMessage && <p className="mt-4 text-sm text-[#536078] dark:text-[#B8C4D8]">{actionMessage}</p>}

        {connections && connections.length === 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-[#D9E2EC] bg-[#EEF3F8] p-10 text-center dark:border-[#1E2A42] dark:bg-[#111D33]">
            <Plug className="mx-auto h-8 w-8 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[#0B1630] dark:text-white">No connected accounts yet</p>
            <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
              No provider is connected for this company yet, so nothing can be linked to this project.
            </p>
            <Link
              href="/integrations"
              className="mt-4 inline-flex rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
            >
              Browse Integrations
            </Link>
          </div>
        )}

        {connections && connections.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-5 dark:border-[#1E2A42] dark:bg-[#111D33]">
            <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Link a source</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select value={selectedConnectionId} onChange={(e) => setSelectedConnectionId(e.target.value)} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">
                <option value="">Select a connected account…</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{getProviderById(c.providerId)?.displayName ?? c.providerId} — {c.providerAccountId}</option>
                ))}
              </select>
              <input value={externalProjectId} onChange={(e) => setExternalProjectId(e.target.value)} placeholder="External project ID (optional)" className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
              <input value={externalFolderId} onChange={(e) => setExternalFolderId(e.target.value)} placeholder="External folder ID (optional)" className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
              <input value={externalFileId} onChange={(e) => setExternalFileId(e.target.value)} placeholder="External file/model ID (optional)" className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white" />
            </div>
            <button
              type="button"
              disabled={!selectedConnectionId || isLinking}
              onClick={() => void handleLink()}
              className="mt-3 rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
            >
              {isLinking ? "Linking…" : "Link source"}
            </button>
          </div>
        )}

        {links && links.length > 0 && (
          <ul className="mt-6 space-y-3">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 text-sm dark:border-[#1E2A42] dark:bg-[#111D33]">
                <div>
                  <p className="font-semibold text-[#0B1630] dark:text-white">{link.externalModelId ?? link.externalFileId ?? link.externalFolderId ?? link.externalProjectId ?? "Linked source"}</p>
                  <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Sync state: {link.syncState.replace(/_/g, " ")}</p>
                </div>
                <button
                  type="button"
                  disabled={busyUnlinkId === link.id}
                  onClick={() => void handleUnlink(link.id)}
                  className="rounded-xl border border-rose-700/40 bg-rose-950/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/20 disabled:opacity-50"
                >
                  {busyUnlinkId === link.id ? "Unlinking…" : "Unlink"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
