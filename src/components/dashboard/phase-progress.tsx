"use client";

import { useTranslations } from "@/lib/i18n/locale-provider";

const statusClasses: Record<string, string> = {
  success: "bg-emerald-500 text-white",
  normal: "bg-slate-700 text-slate-200",
  planned: "bg-slate-800 text-slate-400",
};

export default function PhaseProgress() {
  const t = useTranslations();
  const phases = [
    { label: t("dashboardComponents.phaseProgress.phase1"), status: "success" },
    { label: t("dashboardComponents.phaseProgress.phase2"), status: "success" },
    { label: t("dashboardComponents.phaseProgress.phase3"), status: "success" },
    { label: t("dashboardComponents.phaseProgress.phase4"), status: "success" },
    { label: t("dashboardComponents.phaseProgress.phase5"), status: "success" },
    { label: t("dashboardComponents.phaseProgress.phase6"), status: "success" },
    { label: t("dashboardComponents.phaseProgress.phase7"), status: "normal" },
    { label: t("dashboardComponents.phaseProgress.phase8"), status: "planned" },
    { label: t("dashboardComponents.phaseProgress.phase9"), status: "planned" },
    { label: t("dashboardComponents.phaseProgress.phase10"), status: "planned" },
  ];

  return (
    <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("dashboardComponents.phaseProgress.eyebrow")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{t("dashboardComponents.phaseProgress.title")}</h2>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300">{t("dashboardComponents.phaseProgress.mvpStage")}</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {phases.map((phase) => (
          <div key={phase.label} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">{phase.label}</p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[phase.status]}`}>
              {phase.status === "planned"
                ? t("dashboardComponents.phaseProgress.planned")
                : phase.status === "success"
                  ? t("dashboardComponents.phaseProgress.complete")
                  : t("dashboardComponents.phaseProgress.available")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
