"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Boxes,
  Building,
  Building2,
  Calculator,
  ClipboardList,
  Cloud,
  Cog,
  Cpu,
  FileEdit,
  FolderOpen,
  GitMerge,
  Globe,
  HardDrive,
  HardHat,
  Package,
  PenTool,
  Plug,
  Route,
  Search,
  Shapes,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import IntegrationsTabs from "./integrations-tabs";
import { withProjectContext, ProjectContextBanner, useProjectContext } from "./project-context";
import type { TranslateFn } from "@/lib/i18n/translate";

const ICONS: Record<string, LucideIcon> = {
  Box, Boxes, Building, Building2, Calculator, ClipboardList, Cloud, Cog, Cpu,
  FileEdit, FolderOpen, GitMerge, Globe, HardDrive, HardHat, Package, PenTool,
  Route, Shapes, Sparkles, Wrench,
};

type Provider = {
  id: string;
  providerFamily: string;
  familyDisplayName: string;
  displayName: string;
  category: string;
  categoryLabel: string;
  connectionType: string;
  status: string;
  shortPurpose: string;
  description: string;
  supportedData: string[];
  plannedData: string[];
  recommendedOrder: number | null;
  icon: string;
  isIndependentIntegration: boolean;
  entitled: boolean;
  connection: {
    id: string;
    status: string;
    providerAccountId: string | null;
    connectedAt: string;
    lastSyncAt: string | null;
    lastErrorMessage: string | null;
  } | null;
};

type Entitlements = {
  source: string;
  planType: string;
  maxActiveConnections: number | null;
  allowedProviderFamilies: string[] | "all";
};

type ProvidersResponse = {
  providers: Provider[];
  categories: Record<string, string>;
  entitlements: Entitlements;
};

function statusLabel(t: TranslateFn, status: string): string {
  const labels: Record<string, string> = {
    AVAILABLE: t("integrations.statusAvailable"),
    BETA: t("integrations.statusBeta"),
    REQUIRES_PLUGIN: t("integrations.statusRequiresPlugin"),
    FILE_IMPORT_ONLY: t("integrations.statusFileImportOnly"),
    COMING_SOON: t("integrations.statusComingSoon"),
    CONNECTED: t("integrations.statusConnected"),
    REAUTH_REQUIRED: t("integrations.statusReauthRequired"),
    SYNCING: t("integrations.statusSyncing"),
    DEGRADED: t("integrations.statusDegraded"),
    DISCONNECTED: t("integrations.statusDisconnected"),
    ERROR: t("integrations.statusError"),
  };
  return labels[status] ?? status;
}

const STATUS_TONES: Record<string, string> = {
  AVAILABLE: "border-emerald-700/40 bg-emerald-950/40 text-emerald-300",
  BETA: "border-sky-700/40 bg-sky-950/40 text-sky-300",
  REQUIRES_PLUGIN: "border-amber-700/40 bg-amber-950/40 text-amber-300",
  FILE_IMPORT_ONLY: "border-amber-700/40 bg-amber-950/40 text-amber-300",
  COMING_SOON: "border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]",
  CONNECTED: "border-emerald-700/40 bg-emerald-950/40 text-emerald-300",
  ERROR: "border-rose-700/40 bg-rose-950/40 text-rose-300",
};

function actionLabel(t: TranslateFn, provider: Provider): string {
  if (provider.connection && provider.connection.status !== "DISCONNECTED") return t("integrations.actionConfigure");
  if (provider.status === "COMING_SOON") return t("integrations.actionComingSoon");
  if (provider.status === "FILE_IMPORT_ONLY") return t("integrations.actionImportFile");
  if (provider.status === "REQUIRES_PLUGIN") return t("integrations.actionDownloadConnector");
  return t("integrations.actionConnect", { family: provider.familyDisplayName });
}

export default function IntegrationsMarketplace() {
  const t = useTranslations();
  const projectContext = useProjectContext();
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await apiClient.get<ProvidersResponse>("/api/integrations/providers", signal);
      setData(result);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.providers.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (statusFilter === "CONNECTED" && !p.connection) return false;
      if (statusFilter && statusFilter !== "CONNECTED" && p.status !== statusFilter) return false;
      if (q && !`${p.displayName} ${p.familyDisplayName} ${p.shortPurpose}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, categoryFilter, statusFilter]);

  const connected = filtered.filter((p) => p.connection);
  const recommended = filtered.filter((p) => p.recommendedOrder !== null).sort((a, b) => (a.recommendedOrder ?? 0) - (b.recommendedOrder ?? 0));
  const byCategory = useMemo(() => {
    if (!data) return [] as { key: string; label: string; providers: Provider[] }[];
    return Object.entries(data.categories).map(([key, label]) => ({
      key,
      label,
      providers: filtered.filter((p) => p.category === key),
    })).filter((group) => group.providers.length > 0);
  }, [data, filtered]);

  const selectedProvider = data?.providers.find((p) => p.id === selectedProviderId) ?? null;
  const autodeskConnection = data?.providers.find((p) => p.id === "autodesk")?.connection ?? null;

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <div className="animate-pulse space-y-4" aria-live="polite" aria-busy="true">
          <div className="h-8 w-96 rounded bg-[#EEF3F8] dark:bg-[#111D33]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-3xl bg-[#EEF3F8] dark:bg-[#111D33]" />)}
          </div>
        </div>
        <p className="sr-only">{t("integrations.loadingMarketplace")}</p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <p className="text-lg font-semibold text-[#0B1630] dark:text-white">{t("integrations.unavailable")}</p>
        <p className="mt-2 text-sm text-[#D84A4A] dark:text-rose-300">{loadError ?? t("integrations.unavailableFallback")}</p>
        <button type="button" onClick={() => void load()} className="mt-6 rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
          {t("integrations.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <Plug className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#7F8DA6]">{t("integrations.eyebrow")}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white sm:text-3xl">{t("integrations.title")}</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-[#536078] dark:text-[#B8C4D8]">
          {t("integrations.marketplaceAvailability")}
        </p>
        <p className="mt-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
          {t("integrations.independenceNote")}
        </p>
      </header>

      {projectContext && <ProjectContextBanner context={projectContext} />}

      <IntegrationsTabs />

      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <Search className="h-4 w-4 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("integrations.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-[#0B1630] outline-none dark:text-white"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#0B1630] outline-none dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
        >
          <option value="">{t("integrations.allCategories")}</option>
          {Object.entries(data.categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#0B1630] outline-none dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
        >
          <option value="">{t("integrations.allStatuses")}</option>
          <option value="CONNECTED">{t("integrations.statusConnected")}</option>
          <option value="AVAILABLE">{t("integrations.statusAvailable")}</option>
          <option value="BETA">{t("integrations.statusBeta")}</option>
          <option value="REQUIRES_PLUGIN">{t("integrations.statusRequiresPlugin")}</option>
          <option value="FILE_IMPORT_ONLY">{t("integrations.statusFileImportOnly")}</option>
          <option value="COMING_SOON">{t("integrations.statusComingSoon")}</option>
        </select>
      </div>

      <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] px-4 py-3 text-xs text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#8CA0BE]">
        {t("integrations.planPrefix")} <span className="font-semibold text-[#0B1630] dark:text-white">{data.entitlements.planType}</span>
        {data.entitlements.source === "owner-override" && <span className="ml-2 rounded-full bg-[#D6A84B]/20 px-2 py-0.5 text-[#8A6316] dark:text-[#E0B25C]">{t("integrations.ownerOverride")}</span>}
        {" · "}
        {data.entitlements.maxActiveConnections === null ? t("integrations.unlimitedConnections") : t("integrations.upToConnections", { count: data.entitlements.maxActiveConnections, plural: data.entitlements.maxActiveConnections === 1 ? "" : "s" })}
      </div>

      {connected.length > 0 && (
        <ProviderSection title={t("integrations.sectionConnected")} providers={connected} onSelect={setSelectedProviderId} />
      )}

      {recommended.length > 0 && !categoryFilter && !statusFilter && !search && (
        <ProviderSection title={t("integrations.sectionRecommended")} providers={recommended} onSelect={setSelectedProviderId} />
      )}

      {byCategory.map((group) => (
        <ProviderSection key={group.key} title={group.label} providers={group.providers} onSelect={setSelectedProviderId} />
      ))}

      {filtered.length === 0 && (
        <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-10 text-center dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <p className="text-sm text-[#7B879C] dark:text-[#7F8DA6]">{t("integrations.noProviders")}</p>
        </div>
      )}

      {selectedProvider && (
        <ProviderDetailDrawer
          provider={selectedProvider}
          projectContext={projectContext}
          autodeskConnection={autodeskConnection}
          onClose={() => setSelectedProviderId(null)}
        />
      )}
    </div>
  );
}

function ProviderSection({ title, providers, onSelect }: { title: string; providers: Provider[]; onSelect: (id: string) => void }) {
  return (
    <section aria-label={title} className="rounded-[32px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426] sm:p-8">
      <h2 className="text-lg font-semibold text-[#0B1630] dark:text-white">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} onSelect={onSelect} />)}
      </div>
    </section>
  );
}

function ProviderCard({ provider, onSelect }: { provider: Provider; onSelect: (id: string) => void }) {
  const t = useTranslations();
  const Icon = ICONS[provider.icon] ?? Plug;
  const displayStatus = provider.connection ? provider.connection.status : provider.status;
  const isAutodeskLocked = provider.providerFamily === "autodesk" && !provider.entitled;
  const isDisabledAction = (provider.status === "COMING_SOON" && !provider.connection) || isAutodeskLocked;

  return (
    <button
      type="button"
      onClick={() => onSelect(provider.id)}
      className="flex flex-col items-start rounded-3xl border border-[#D9E2EC] bg-[#EEF3F8] p-5 text-left transition hover:border-[#0EA5E9]/60 dark:border-[#1E2A42] dark:bg-[#111D33] dark:hover:border-[#22D3EE]/60"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D9E2EC] bg-white dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <Icon className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${STATUS_TONES[displayStatus] ?? STATUS_TONES.COMING_SOON}`}>
          {statusLabel(t, displayStatus)}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#0B1630] dark:text-white">{provider.displayName}</p>
      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{provider.familyDisplayName}</p>
      <p className="mt-2 text-xs text-[#536078] dark:text-[#B8C4D8]">{provider.shortPurpose}</p>
      <span
        aria-disabled={isDisabledAction}
        className={`mt-4 inline-flex rounded-xl border px-3 py-1.5 text-xs font-semibold ${
          isDisabledAction
            ? "cursor-not-allowed border-[#D9E2EC] bg-white text-[#B5C0CE] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#4A5A78]"
            : "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0284C7] dark:border-[#22D3EE] dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]"
        }`}
      >
        {isAutodeskLocked ? "Business plan required" : actionLabel(t, provider)}
      </span>
    </button>
  );
}

function ProviderDetailDrawer({
  provider,
  projectContext,
  autodeskConnection,
  onClose,
}: {
  provider: Provider;
  projectContext: ReturnType<typeof useProjectContext>;
  autodeskConnection: Provider["connection"];
  onClose: () => void;
}) {
  const t = useTranslations();
  const Icon = ICONS[provider.icon] ?? Plug;
  const isPlugin = provider.connectionType === "PLUGIN_DESKTOP";
  const isAutodeskFamily = provider.providerFamily === "autodesk";
  const hasAutodeskConnection = Boolean(autodeskConnection && autodeskConnection.status !== "DISCONNECTED");

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-[32px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426] sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#111D33]">
              <Icon className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{provider.familyDisplayName}</p>
              <h2 className="text-xl font-semibold text-[#0B1630] dark:text-white">{provider.displayName}</h2>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_TONES[provider.status] ?? STATUS_TONES.COMING_SOON}`}>
            {statusLabel(t, provider.status)}
          </span>
        </div>

        <p className="mt-4 text-sm text-[#536078] dark:text-[#B8C4D8]">{provider.description}</p>

        {provider.isIndependentIntegration && (
          <p className="mt-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            {t("integrations.independentIntegrationNote", { family: provider.familyDisplayName })}
          </p>
        )}

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <DetailField term={t("integrations.detailCategory")} value={provider.categoryLabel} />
          <DetailField term={t("integrations.detailConnectionMethod")} value={provider.connectionType.replace(/_/g, " ")} />
          <DetailField term={t("integrations.detailEntitled")} value={provider.entitled ? t("integrations.detailEntitledYes") : t("integrations.detailEntitledNo")} />
          <DetailField term={t("integrations.detailConnection")} value={provider.connection ? statusLabel(t, provider.connection.status) : t("integrations.detailNotConnected")} />
        </dl>

        {provider.supportedData.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">{t("integrations.supportsToday")}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {provider.supportedData.map((d) => (
                <li key={d} className="rounded-full border border-[#D9E2EC] bg-[#EEF3F8] px-3 py-1 text-xs text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#F7FAFC]">{d}</li>
              ))}
            </ul>
          </div>
        )}

        {provider.plannedData.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">{t("integrations.planned")}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {provider.plannedData.map((d) => (
                <li key={d} className="rounded-full border border-dashed border-[#D9E2EC] px-3 py-1 text-xs text-[#7B879C] dark:border-[#1E2A42] dark:text-[#7F8DA6]">{d}</li>
              ))}
            </ul>
          </div>
        )}

        {isPlugin && (
          <div className="mt-5 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 text-xs text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#8CA0BE]">
            {t("integrations.pluginNote")}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {isAutodeskFamily && provider.entitled && (
            <a
              href={withProjectContext(
                hasAutodeskConnection ? "/integrations/autodesk/connect" : "/api/integrations/autodesk/connect",
                projectContext,
              )}
              className="rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
            >
              {hasAutodeskConnection
                ? t("integrations.autodesk.browseAction")
                : t("integrations.actionConnect", { family: "Autodesk" })}
            </a>
          )}
          {isAutodeskFamily && !provider.entitled && (
            <div className="w-full rounded-2xl border border-amber-700/40 bg-amber-950/10 p-4 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Business plan required</p>
              <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">
                AutoCAD / Autodesk integration is included with Quantara Business.
              </p>
              <Link
                href="/settings/subscription?priceCode=business_monthly"
                className="mt-3 inline-flex rounded-xl border border-amber-600 bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500"
              >
                Upgrade to Business
              </Link>
            </div>
          )}
          <Link
            href={withProjectContext(`/integrations/${provider.id}`, projectContext)}
            className="rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9]/10 px-4 py-2 text-sm font-semibold text-[#0284C7] hover:bg-[#0EA5E9]/20 dark:border-[#22D3EE] dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]"
          >
            {t("integrations.viewFullDetails")}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#D9E2EC] bg-white px-4 py-2 text-sm font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
          >
            {t("integrations.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-3 dark:border-[#1E2A42] dark:bg-[#111D33]">
      <dt className="text-xs uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">{term}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#0B1630] dark:text-white">{value}</dd>
    </div>
  );
}
