"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plug } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import IntegrationsTabs from "../integrations-tabs";

type ProviderDetail = {
  id: string;
  familyDisplayName: string;
  displayName: string;
  categoryLabel: string;
  connectionType: string;
  status: string;
  description: string;
  supportedData: string[];
  plannedData: string[];
  isIndependentIntegration: boolean;
  entitled: boolean;
  connection: { status: string; connectedAt: string; lastSyncAt: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available", BETA: "Beta", REQUIRES_PLUGIN: "Requires plugin", FILE_IMPORT_ONLY: "File import only",
  COMING_SOON: "Coming soon", CONNECTED: "Connected", REAUTH_REQUIRED: "Reconnect required", SYNCING: "Syncing",
  DEGRADED: "Degraded", DISCONNECTED: "Disconnected", ERROR: "Error",
};

function actionLabel(provider: ProviderDetail): string {
  if (provider.connection && provider.connection.status !== "DISCONNECTED") return "Configure";
  if (provider.status === "COMING_SOON") return "Coming Soon";
  if (provider.status === "FILE_IMPORT_ONLY") return "Import file";
  if (provider.status === "REQUIRES_PLUGIN") return "Download connector";
  return `Connect ${provider.familyDisplayName}`;
}

type PageProps = { params: Promise<{ providerId: string }> };

export default function ProviderDetailPage(props: PageProps) {
  const params = use(props.params);
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const data = await apiClient.get<ProviderDetail>(`/api/integrations/providers/${params.providerId}`, signal);
      setProvider(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [params.providerId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-6">
      <Link href="/integrations" className="inline-flex items-center gap-1 text-xs text-[#7B879C] hover:text-[#0B1630] dark:text-[#7F8DA6] dark:hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to Integrations
      </Link>
      <IntegrationsTabs />

      {loadError && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <p className="text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>
        </div>
      )}

      {!provider && !loadError && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <div className="h-40 animate-pulse rounded-2xl bg-[#EEF3F8] dark:bg-[#111D33]" aria-hidden="true" />
        </div>
      )}

      {provider && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#111D33]">
                <Plug className="h-6 w-6 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{provider.familyDisplayName}</p>
                <h1 className="text-2xl font-semibold text-[#0B1630] dark:text-white">{provider.displayName}</h1>
              </div>
            </div>
            <span className="rounded-full border border-[#D5E0EC] bg-[#EAF1F8] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]">
              {STATUS_LABELS[provider.connection?.status ?? provider.status] ?? provider.status}
            </span>
          </div>

          <p className="mt-4 max-w-2xl text-sm text-[#536078] dark:text-[#B8C4D8]">{provider.description}</p>

          {provider.isIndependentIntegration && (
            <p className="mt-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
              Independent integration — connection availability depends on your {provider.familyDisplayName} account and permissions.
            </p>
          )}

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-3 dark:border-[#1E2A42] dark:bg-[#111D33]">
              <dt className="text-xs uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">Category</dt>
              <dd className="mt-1 text-sm font-semibold text-[#0B1630] dark:text-white">{provider.categoryLabel}</dd>
            </div>
            <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-3 dark:border-[#1E2A42] dark:bg-[#111D33]">
              <dt className="text-xs uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">Connection method</dt>
              <dd className="mt-1 text-sm font-semibold text-[#0B1630] dark:text-white">{provider.connectionType.replace(/_/g, " ")}</dd>
            </div>
            <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-3 dark:border-[#1E2A42] dark:bg-[#111D33]">
              <dt className="text-xs uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">Entitled on your plan</dt>
              <dd className="mt-1 text-sm font-semibold text-[#0B1630] dark:text-white">{provider.entitled ? "Yes" : "Not on your current plan"}</dd>
            </div>
          </dl>

          {provider.connection && (
            <div className="mt-6 rounded-2xl border border-emerald-700/30 bg-emerald-950/10 p-4 text-sm dark:bg-emerald-950/20">
              <p className="font-semibold text-[#0B1630] dark:text-white">Connected since {new Date(provider.connection.connectedAt).toLocaleDateString()}</p>
              <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">
                {provider.connection.lastSyncAt ? `Last synced ${new Date(provider.connection.lastSyncAt).toLocaleString()}` : "No synchronization has run yet."}
              </p>
              <Link href="/integrations/connections" className="mt-3 inline-flex text-xs font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]">
                Manage this connection →
              </Link>
            </div>
          )}

          {provider.supportedData.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">Supports today</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {provider.supportedData.map((d) => (
                  <li key={d} className="rounded-full border border-[#D9E2EC] bg-[#EEF3F8] px-3 py-1 text-xs text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#F7FAFC]">{d}</li>
                ))}
              </ul>
            </div>
          )}

          {provider.plannedData.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">Planned</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {provider.plannedData.map((d) => (
                  <li key={d} className="rounded-full border border-dashed border-[#D9E2EC] px-3 py-1 text-xs text-[#7B879C] dark:border-[#1E2A42] dark:text-[#7F8DA6]">{d}</li>
                ))}
              </ul>
            </div>
          )}

          {provider.connectionType === "PLUGIN_DESKTOP" && (
            <div className="mt-6 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 text-xs text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#8CA0BE]">
              This provider connects through a desktop add-on/bridge, not an ordinary cloud login. A signed connector download will be available once this integration ships — there is nothing to install yet.
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            {!provider.connection && (
              <Link
                href={`/integrations/${provider.id}/connect`}
                className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] px-4 py-2 text-sm font-semibold text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#8CA0BE]"
              >
                {actionLabel(provider)}
              </Link>
            )}
            <Link
              href="/integrations"
              className="rounded-2xl border border-[#D9E2EC] bg-white px-4 py-2 text-sm font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
