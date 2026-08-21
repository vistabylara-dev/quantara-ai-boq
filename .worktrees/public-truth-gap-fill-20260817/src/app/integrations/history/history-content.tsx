"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { PROVIDER_REGISTRY, getProviderById } from "@/lib/integrations/provider-registry";
import IntegrationsTabs from "../integrations-tabs";

type EventRow = {
  id: string;
  providerId: string;
  eventType: string;
  status: string;
  summary: string;
  createdAt: string;
  actor: { fullName: string } | null;
};

type EventsResponse = { items: EventRow[]; total: number; page: number; pageSize: number };

const EVENT_LABELS: Record<string, string> = {
  CONNECTION_CREATED: "Connected", CONNECTION_REFRESHED: "Credentials refreshed", CONNECTION_REAUTH_REQUIRED: "Reconnect required",
  CONNECTION_DISCONNECTED: "Disconnected", CONNECTION_ERROR: "Connection error", PROJECT_LINKED: "Project linked",
  PROJECT_UNLINKED: "Project unlinked", SYNC_STARTED: "Synchronization started", SYNC_COMPLETED: "Synchronization completed", SYNC_FAILED: "Synchronization failed",
};

const STATUS_TONES: Record<string, string> = {
  success: "border-emerald-700/40 bg-emerald-950/40 text-emerald-300",
  failed: "border-rose-700/40 bg-rose-950/40 text-rose-300",
  info: "border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]",
};

export default function IntegrationsHistoryContent() {
  const searchParams = useSearchParams();
  const connectionIdFilter = searchParams.get("connectionId");
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (providerFilter) params.set("providerId", providerFilter);
      if (eventTypeFilter) params.set("eventType", eventTypeFilter);
      if (connectionIdFilter) params.set("connectionId", connectionIdFilter);
      const result = await apiClient.get<EventsResponse>(`/api/integrations/history?${params.toString()}`, signal);
      setData(result);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [providerFilter, eventTypeFilter, page, connectionIdFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <header className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <History className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#7F8DA6]">Integrations</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">History</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#536078] dark:text-[#B8C4D8]">
          Safe operational history for every connection, project link, and synchronization — never a token, secret, or raw provider payload.
        </p>
      </header>

      <IntegrationsTabs />

      {connectionIdFilter && (
        <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] px-4 py-3 text-xs text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#8CA0BE]">
          Filtered to one connection{data?.items[0] ? ` (${getProviderById(data.items[0].providerId)?.displayName ?? data.items[0].providerId})` : ""}.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select value={providerFilter} onChange={(e) => { setPage(1); setProviderFilter(e.target.value); }} className="rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#0B1630] outline-none dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">
          <option value="">All providers</option>
          {PROVIDER_REGISTRY.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
        <select value={eventTypeFilter} onChange={(e) => { setPage(1); setEventTypeFilter(e.target.value); }} className="rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#0B1630] outline-none dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">
          <option value="">All event types</option>
          {Object.entries(EVENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {loadError && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <p className="text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-[32px] border border-dashed border-[#D9E2EC] bg-[#EEF3F8] p-10 text-center dark:border-[#1E2A42] dark:bg-[#111D33]">
          <p className="text-sm text-[#7B879C] dark:text-[#7F8DA6]">No integration history yet — nothing has been connected, linked, or synchronized.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426] sm:p-8">
          <ol className="space-y-4">
            {data.items.map((event) => (
              <li key={event.id} className="relative border-l-2 border-[#0EA5E9]/30 pl-5 dark:border-[#22D3EE]/30">
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#0EA5E9] dark:bg-[#22D3EE]" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{new Date(event.createdAt).toLocaleString()}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${STATUS_TONES[event.status] ?? STATUS_TONES.info}`}>{event.status}</span>
                </div>
                <p className="text-sm font-semibold text-[#0B1630] dark:text-white">{EVENT_LABELS[event.eventType] ?? event.eventType}</p>
                <p className="text-xs text-[#536078] dark:text-[#B8C4D8]">{event.summary}{event.actor ? ` · ${event.actor.fullName}` : ""}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-center justify-between text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            <p>Page {data.page} of {lastPage} · {data.total} events</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-40 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]">Previous</button>
              <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-40 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
