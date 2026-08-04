"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Link2 } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ConnectionDetail = {
  id: string;
  providerId: string;
  providerAccountId: string | null;
  status: string;
  connectedAt: string;
  lastSyncAt: string | null;
  disconnectedAt: string | null;
  lastErrorMessage: string | null;
  grantedScopesJson: unknown;
  provider: { id: string; displayName: string; familyDisplayName: string; connectionType: string } | null;
  isTestConnection: boolean;
  linkedProjects: { projectIntegrationId: string; projectId: string; projectName: string; projectReference: string; syncState: string }[];
  recentEvents: { id: string; eventType: string; status: string; summary: string; createdAt: string; actor: { fullName: string } | null }[];
};

const EVENT_LABELS: Record<string, string> = {
  CONNECTION_CREATED: "Connected", CONNECTION_REFRESHED: "Credentials refreshed", CONNECTION_REAUTH_REQUIRED: "Reconnect required",
  CONNECTION_DISCONNECTED: "Disconnected", CONNECTION_ERROR: "Connection error", PROJECT_LINKED: "Project linked",
  PROJECT_UNLINKED: "Project unlinked", SYNC_STARTED: "Synchronization started", SYNC_COMPLETED: "Synchronization completed", SYNC_FAILED: "Synchronization failed",
};

type PageProps = { params: Promise<{ connectionId: string }> };

export default function ConnectionDetailPage(props: PageProps) {
  const params = use(props.params);
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const data = await apiClient.get<ConnectionDetail>(`/api/integrations/connections/${params.connectionId}`, signal);
      setConnection(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [params.connectionId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm("Disconnect this account? Linked projects will keep their history, but nothing new can be synced until reconnected.")) return;
    setIsDisconnecting(true);
    setActionMessage(null);
    try {
      await apiClient.post(`/api/integrations/connections/${params.connectionId}/disconnect`);
      setActionMessage("Disconnected.");
      await load();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsDisconnecting(false);
    }
  }, [params.connectionId, load]);

  return (
    <div className="space-y-6">
      <Link href="/integrations/connections" className="inline-flex items-center gap-1 text-xs text-[#7B879C] hover:text-[#0B1630] dark:text-[#7F8DA6] dark:hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to Connected Accounts
      </Link>

      {loadError && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <p className="text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>
        </div>
      )}

      {connection && (
        <>
          <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#111D33]">
                  <Link2 className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{connection.provider?.familyDisplayName}</p>
                  <h1 className="text-xl font-semibold text-[#0B1630] dark:text-white">{connection.provider?.displayName ?? connection.providerId}</h1>
                </div>
              </div>
              <span className="rounded-full border border-[#D5E0EC] bg-[#EAF1F8] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]">
                {connection.status.replace(/_/g, " ")}
              </span>
            </div>

            {connection.isTestConnection && (
              <p className="mt-3 rounded-xl border border-amber-700/30 bg-amber-950/10 px-3 py-2 text-xs text-amber-300">
                Test connection — created by a platform owner to verify the connection management flow. Not a real provider account grant.
              </p>
            )}

            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              <Field term="Account" value={connection.providerAccountId ?? "—"} />
              <Field term="Connected" value={new Date(connection.connectedAt).toLocaleString()} />
              <Field term="Last sync" value={connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : "Never"} />
            </dl>

            {connection.lastErrorMessage && (
              <p className="mt-4 text-xs text-[#D84A4A] dark:text-rose-300">Last error: {connection.lastErrorMessage}</p>
            )}

            {actionMessage && <p className="mt-4 text-xs text-[#536078] dark:text-[#B8C4D8]">{actionMessage}</p>}

            <div className="mt-6 flex flex-wrap gap-2">
              {connection.status !== "DISCONNECTED" ? (
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={isDisconnecting}
                  className="rounded-2xl border border-rose-700/40 bg-rose-950/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/20 disabled:opacity-50"
                >
                  {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : (
                <span className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] px-4 py-2 text-sm text-[#7B879C] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#7F8DA6]">
                  Disconnected {connection.disconnectedAt ? new Date(connection.disconnectedAt).toLocaleDateString() : ""}
                </span>
              )}
              <button
                type="button"
                disabled
                title="Synchronization requires a live connector — not yet available"
                className="cursor-not-allowed rounded-2xl border border-[#D9E2EC] bg-white px-4 py-2 text-sm font-semibold text-[#B5C0CE] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#4A5A78]"
              >
                Sync now
              </button>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
            <h2 className="text-lg font-semibold text-[#0B1630] dark:text-white">Linked projects</h2>
            {connection.linkedProjects.length === 0 ? (
              <p className="mt-3 text-sm text-[#7B879C] dark:text-[#7F8DA6]">No Quantara projects are linked to this connection yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {connection.linkedProjects.map((link) => (
                  <li key={link.projectIntegrationId} className="flex items-center justify-between rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] px-4 py-3 text-sm dark:border-[#1E2A42] dark:bg-[#111D33]">
                    <div>
                      <p className="font-semibold text-[#0B1630] dark:text-white">{link.projectName}</p>
                      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{link.projectReference}</p>
                    </div>
                    <Link href={`/projects/${link.projectId}/integrations`} className="text-xs font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]">
                      Open project →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0B1630] dark:text-white">Recent history</h2>
              <Link href={`/integrations/history?connectionId=${connection.id}`} className="text-xs font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]">
                View all →
              </Link>
            </div>
            {connection.recentEvents.length === 0 ? (
              <p className="mt-3 text-sm text-[#7B879C] dark:text-[#7F8DA6]">No events recorded yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {connection.recentEvents.map((event) => (
                  <li key={event.id} className="relative border-l-2 border-[#0EA5E9]/30 pl-4 dark:border-[#22D3EE]/30">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#0EA5E9] dark:bg-[#22D3EE]" aria-hidden="true" />
                    <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{new Date(event.createdAt).toLocaleString()}</p>
                    <p className="text-sm font-semibold text-[#0B1630] dark:text-white">{EVENT_LABELS[event.eventType] ?? event.eventType}</p>
                    <p className="text-xs text-[#536078] dark:text-[#B8C4D8]">{event.summary}{event.actor ? ` · ${event.actor.fullName}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-3 dark:border-[#1E2A42] dark:bg-[#111D33]">
      <dt className="text-xs uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">{term}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#0B1630] dark:text-white">{value}</dd>
    </div>
  );
}
