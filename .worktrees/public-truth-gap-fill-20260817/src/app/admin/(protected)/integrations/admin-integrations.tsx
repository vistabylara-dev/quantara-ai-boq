"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Plug } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type AdminProvider = {
  id: string;
  displayName: string;
  familyDisplayName: string;
  category: string;
  status: string;
  seeded: boolean;
  isActive: boolean;
  connectionCounts: Record<string, number>;
};

type AdminProvidersResponse = { providers: AdminProvider[]; totalConnections: number };

type AdminConnection = {
  id: string;
  companyId: string;
  companyName: string;
  isTestCompany: boolean;
  providerId: string;
  providerAccountId: string | null;
  status: string;
  connectedAt: string;
  lastSyncAt: string | null;
  disconnectedAt: string | null;
  lastErrorMessage: string | null;
  isTestConnection: boolean;
};

const panel = "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";

export default function AdminIntegrations() {
  const [providers, setProviders] = useState<AdminProvidersResponse | null>(null);
  const [connections, setConnections] = useState<AdminConnection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [testProviderId, setTestProviderId] = useState("");
  const [isCreatingTest, setIsCreatingTest] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const [providersData, connectionsData] = await Promise.all([
        apiClient.get<AdminProvidersResponse>("/api/admin/integrations/providers", signal),
        apiClient.get<AdminConnection[]>("/api/admin/integrations/connections", signal),
      ]);
      setProviders(providersData);
      setConnections(connectionsData);
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

  const toggleActive = useCallback(async (provider: AdminProvider) => {
    setBusyProviderId(provider.id);
    setActionMessage(null);
    try {
      await apiClient.patch(`/api/admin/integrations/providers/${provider.id}`, { isActive: !provider.isActive });
      setActionMessage(`${provider.displayName} ${provider.isActive ? "deactivated" : "activated"}.`);
      await load();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setBusyProviderId(null);
    }
  }, [load]);

  const createTestConnection = useCallback(async () => {
    if (!testProviderId) return;
    setIsCreatingTest(true);
    setActionMessage(null);
    try {
      await apiClient.post("/api/admin/integrations/test-connections", { providerId: testProviderId });
      setActionMessage(`Test connection created for ${testProviderId}.`);
      setTestProviderId("");
      await load();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsCreatingTest(false);
    }
  }, [testProviderId, load]);

  if (loadError) {
    return (
      <div className={panel}>
        <p className="text-sm text-[#D84A4A] dark:text-rose-300">Admin integrations unavailable: {loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className={panel}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <Plug className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">Quantara Platform Administration</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Integrations</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#536078] dark:text-[#B8C4D8]">
          Owner-only. Provider registry status, cross-company connection health (safe fields only — no tokens), and a test-connection tool for verifying the connection management lifecycle before any live connector ships.
        </p>
      </header>

      {actionMessage && (
        <div className="rounded-2xl border border-[#D9E2EC] bg-white p-4 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">{actionMessage}</div>
      )}

      <section className={panel}>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-[#B4841F] dark:text-[#E0B25C]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Create a test connection</p>
        </div>
        <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
          Creates a real ExternalConnection row for your own company, clearly marked as a test fixture — not a live provider grant. Use it to exercise disconnect, project linking, and history end to end.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={testProviderId} onChange={(e) => setTestProviderId(e.target.value)} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">
            <option value="">Select a provider…</option>
            {providers?.providers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <button
            type="button"
            disabled={!testProviderId || isCreatingTest}
            onClick={() => void createTestConnection()}
            className="rounded-xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
          >
            {isCreatingTest ? "Creating…" : "Create test connection"}
          </button>
        </div>
      </section>

      <section className={panel}>
        <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Provider registry ({providers?.providers.length ?? 0})</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Family</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Seeded</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Connections</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {providers?.providers.map((provider) => (
                <tr key={provider.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                  <td className="px-4 py-3 font-semibold">{provider.displayName}</td>
                  <td className="px-4 py-3">{provider.familyDisplayName}</td>
                  <td className="px-4 py-3">{provider.category.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">{provider.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">{provider.seeded ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{provider.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">{Object.entries(provider.connectionCounts).map(([status, count]) => `${status}: ${count}`).join(", ") || "0"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={!provider.seeded || busyProviderId === provider.id}
                      onClick={() => void toggleActive(provider)}
                      className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
                    >
                      {provider.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={panel}>
        <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Cross-company connections ({connections?.length ?? 0})</p>
        <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Safe fields only — no credentials or tokens are ever shown here.</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Connected</th>
                <th className="px-4 py-3">Test?</th>
              </tr>
            </thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {connections?.map((connection) => (
                <tr key={connection.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                  <td className="px-4 py-3">{connection.companyName}{connection.isTestCompany ? " (test company)" : ""}</td>
                  <td className="px-4 py-3">{connection.providerId}</td>
                  <td className="px-4 py-3">{connection.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">{new Date(connection.connectedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{connection.isTestConnection ? "Yes" : "No"}</td>
                </tr>
              ))}
              {connections?.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#7B879C] dark:text-[#7F8DA6]">No connections exist yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
