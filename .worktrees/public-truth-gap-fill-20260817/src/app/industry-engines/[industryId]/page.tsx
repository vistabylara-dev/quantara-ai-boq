"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { IndustryEngine } from "@/types/industry";

/**
 * Same API shape as src/app/industry-engines/page.tsx — GET /api/industries is a
 * company-scoped list (there's no single-industry GET route), so the detail
 * page fetches the list and looks up by key client-side rather than adding
 * a new backend route for one lookup. See industry-repository.ts.
 */
type ApiIndustry = {
  key: string;
  name: string;
  description: string;
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

type PageProps = {
  params: Promise<{ industryId: string }>;
};

export default function IndustryDetailPage(props: PageProps) {
  const { industryId } = use(props.params);
  const t = useTranslations();
  const [industry, setIndustry] = useState<IndustryEngine | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const data = await apiClient.get<ApiIndustry[]>("/api/industries", signal);
        const match = data.find((item) => item.key === industryId);
        setIndustry(match ? toIndustryEngine(match) : null);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(getApiErrorMessage(loadError));
      }
    },
    [industryId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#07111F] text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xl font-semibold text-white">{t("industries.loadError")}</p>
          <p className="mt-3 text-slate-400">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {t("industries.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (industry === undefined) {
    return (
      <div className="min-h-screen bg-[#07111F] text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8 text-slate-400">{t("industries.loading")}</div>
      </div>
    );
  }

  if (industry === null) {
    return (
      <div className="min-h-screen bg-[#07111F] text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xl font-semibold text-white">{t("industries.detail.notFoundTitle")}</p>
          <p className="mt-3 text-slate-400">{t("industries.detail.notFoundBody")}</p>
          <Link href="/industry-engines" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            {t("industries.detail.backToEngines")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{industry.shortName}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{t("industries.detail.engineTitle", { name: industry.name })}</h1>
            <p className="mt-3 max-w-2xl text-slate-400">{industry.description}</p>
          </div>
          <Link href="/projects/new" className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            {t("industries.detail.createProject")}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-lg font-semibold text-white">{t("industries.detail.supportedSections")}</h2>
            <div className="mt-4 grid gap-3">
              {industry.boqSections.map((section) => (
                <div key={section.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <p className="font-semibold text-white">{section.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{section.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-lg font-semibold text-white">{t("industries.detail.supportedUnits")}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {industry.supportedUnits.map((unit) => (
                  <span key={unit} className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300">
                    {unit}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-lg font-semibold text-white">{t("industries.detail.validationRules")}</h3>
              <ul className="mt-4 space-y-2 text-slate-400">
                {industry.validationRules.map((rule) => (
                  <li key={rule} className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
