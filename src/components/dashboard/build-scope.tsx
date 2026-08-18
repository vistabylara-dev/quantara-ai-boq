"use client";

import { useTranslations } from "@/lib/i18n/locale-provider";

export default function BuildScope() {
  const t = useTranslations();
  const includedItems = [
    t("dashboardComponents.buildScope.included1"),
    t("dashboardComponents.buildScope.included2"),
    t("dashboardComponents.buildScope.included3"),
    t("dashboardComponents.buildScope.included4"),
    t("dashboardComponents.buildScope.included5"),
    t("dashboardComponents.buildScope.included6"),
  ];

  const excludedItems = [
    t("dashboardComponents.buildScope.excluded1"),
    t("dashboardComponents.buildScope.excluded2"),
    t("dashboardComponents.buildScope.excluded3"),
    t("dashboardComponents.buildScope.excluded4"),
    t("dashboardComponents.buildScope.excluded5"),
    t("dashboardComponents.buildScope.excluded6"),
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{t("dashboardComponents.buildScope.eyebrow")}</p>
        <h3 className="mt-3 text-lg font-semibold text-white">{t("dashboardComponents.buildScope.title")}</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold text-slate-200">{t("dashboardComponents.buildScope.includedLabel")}</p>
          <ul className="mt-3 space-y-3 text-sm text-slate-400">
            {includedItems.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold text-slate-200">{t("dashboardComponents.buildScope.excludedLabel")}</p>
          <ul className="mt-3 space-y-3 text-sm text-slate-400">
            {excludedItems.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-slate-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
