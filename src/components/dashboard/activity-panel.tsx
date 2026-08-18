"use client";

import { useTranslations } from "@/lib/i18n/locale-provider";

export default function ActivityPanel() {
  const t = useTranslations();
  const activities = [
    { time: t("dashboardComponents.activityPanel.time1"), message: t("dashboardComponents.activityPanel.activity1") },
    { time: t("dashboardComponents.activityPanel.time2"), message: t("dashboardComponents.activityPanel.activity2") },
    { time: t("dashboardComponents.activityPanel.time3"), message: t("dashboardComponents.activityPanel.activity3") },
    { time: t("dashboardComponents.activityPanel.time4"), message: t("dashboardComponents.activityPanel.activity4") },
  ];

  return (
    <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("dashboardComponents.activityPanel.eyebrow")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{t("dashboardComponents.activityPanel.title")}</h2>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {activities.map((activity) => (
          <div key={activity.time} className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
            <p className="text-sm text-slate-400">{activity.time}</p>
            <p className="mt-2 text-sm text-white">{activity.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
