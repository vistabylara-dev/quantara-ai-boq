"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import IndustryEngineCard from "@/components/industries/industry-engine-card";
import type { IndustryEngine } from "@/types/industry";
import { useTranslations } from "@/lib/i18n/locale-provider";

/**
 * Shape returned by GET /api/industries (src/lib/repositories/industry-repository.ts
 * listIndustryEngines) — company-scoped, RBAC-enforced by getCurrentActor().
 * configJson carries the full IndustryEngine payload (see prisma/seed.ts
 * seedIndustries(), which seeds it from src/config/industries at company
 * bootstrap time), so this page never touches the static demo config.
 */
type ApiIndustry = {
  id: string;
  databaseId: string;
  companyIndustryEngineId: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  enabled: boolean;
  configJson: unknown;
};

function toIndustryEngine(item: ApiIndustry): IndustryEngine {
  const config = (item.configJson ?? {}) as Partial<IndustryEngine>;
  return {
    id: item.key,
    name: item.name,
    description: item.description,
    shortName: config.shortName ?? item.name,
    icon: config.icon ?? "layers",
    status: item.enabled ? "active" : "inactive",
    supportedUnits: config.supportedUnits ?? [],
    boqSections: config.boqSections ?? [],
    requiredFields: config.requiredFields ?? [],
    calculationTypes: config.calculationTypes ?? [],
    validationRules: config.validationRules ?? [],
    documentLabels: config.documentLabels ?? {},
    dashboardMetrics: config.dashboardMetrics ?? [],
  };
}

export default function IndustriesPage() {
  const t = useTranslations();
  const [industries, setIndustries] = useState<ApiIndustry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ApiIndustry[]>("/api/industries", signal);
      setIndustries(data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleToggle = async (item: ApiIndustry) => {
    setActionError(null);
    setTogglingKey(item.key);
    try {
      await apiClient.patch(`/api/industries/${item.key}`, { enabled: !item.enabled });
      await load();
    } catch (toggleError) {
      setActionError(getApiErrorMessage(toggleError));
    } finally {
      setTogglingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("industries.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[32px] border border-rose-900 bg-rose-950/40 p-8 text-rose-200">
        <p className="text-lg font-semibold">{t("industries.loadError")}</p>
        <p className="mt-2 text-sm text-rose-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 rounded-2xl border border-rose-700 bg-rose-900 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
        >
          {t("industries.retry")}
        </button>
      </div>
    );
  }

  if (industries.length === 0) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("industries.emptyTitle")}</p>
        <p className="mt-2 text-sm text-slate-400">{t("industries.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("industries.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{t("industries.title")}</h1>
        <p className="mt-3 text-slate-400">{t("industries.subtitle")}</p>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">{actionError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {industries.map((item) => (
          <div key={item.key} className="space-y-3">
            <IndustryEngineCard industry={toIndustryEngine(item)} />
            <button
              type="button"
              onClick={() => void handleToggle(item)}
              disabled={togglingKey === item.key}
              className={`w-full rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                item.enabled
                  ? "border-emerald-800 bg-emerald-950 text-emerald-300 hover:bg-emerald-900"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {togglingKey === item.key
                ? t("industries.updating")
                : item.enabled
                  ? t("industries.disableAction")
                  : t("industries.enableAction")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
