"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Link2, Plug } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { getProviderById } from "@/lib/integrations/provider-registry";
import IntegrationsTabs from "../integrations-tabs";

type ConnectionRow = {
  id: string;
  providerId: string;
  providerAccountId: string | null;
  status: string;
  connectedAt: string;
  lastSyncAt: string | null;
  disconnectedAt: string | null;
  lastErrorMessage: string | null;
};

const STATUS_TONES: Record<string, string> = {
  CONNECTED: "border-emerald-700/40 bg-emerald-950/40 text-emerald-300",
  REAUTH_REQUIRED: "border-amber-700/40 bg-amber-950/40 text-amber-300",
  SYNCING: "border-sky-700/40 bg-sky-950/40 text-sky-300",
  DEGRADED: "border-amber-700/40 bg-amber-950/40 text-amber-300",
  DISCONNECTED: "border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]",
  ERROR: "border-rose-700/40 bg-rose-950/40 text-rose-300",
};

export default function ConnectedAccountsPage() {
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const data = await apiClient.get<ConnectionRow[]>("/api/integrations/connections", signal);
      setConnections(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <Link2 className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#7F8DA6]">Integrations</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Connected accounts</h1>
          </div>
        </div>
      </header>

      <IntegrationsTabs />

      {loadError && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <p className="text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>
        </div>
      )}

      {connections && connections.length === 0 && (
        <div className="rounded-[32px] border border-dashed border-[#D9E2EC] bg-[#EEF3F8] p-10 text-center dark:border-[#1E2A42] dark:bg-[#111D33]">
          <Plug className="mx-auto h-8 w-8 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-[#0B1630] dark:text-white">No connected accounts yet</p>
          <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Every provider is still Coming Soon, plugin-required, or file-import only — nothing can be connected yet.</p>
          <Link href="/integrations" className="mt-4 inline-flex rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
            Browse Integrations
          </Link>
        </div>
      )}

      {connections && connections.length > 0 && (
        <div className="overflow-x-auto rounded-[32px] border border-[#D9E2EC] bg-white dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
              <tr>
                <th className="px-5 py-4">Provider</th>
                <th className="px-5 py-4">Account</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Connected</th>
                <th className="px-5 py-4">Last sync</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {connections.map((connection) => {
                const provider = getProviderById(connection.providerId);
                return (
                  <tr key={connection.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                    <td className="px-5 py-4 font-semibold">{provider?.displayName ?? connection.providerId}</td>
                    <td className="px-5 py-4 text-[#536078] dark:text-[#B8C4D8]">{connection.providerAccountId ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_TONES[connection.status] ?? STATUS_TONES.DISCONNECTED}`}>
                        {connection.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#536078] dark:text-[#B8C4D8]">{new Date(connection.connectedAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-[#536078] dark:text-[#B8C4D8]">{connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleDateString() : "Never"}</td>
                    <td className="px-5 py-4">
                      <Link href={`/integrations/connections/${connection.id}`} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
