"use client";

import type { ProjectRow } from "../../types/dashboard";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function RecentProjects({ projects }: { projects: ProjectRow[] }) {
  const t = useTranslations();
  return (
    <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-start text-sm text-slate-300">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-6 py-4">{t("dashboardComponents.recentProjects.project")}</th>
              <th className="px-6 py-4">{t("dashboardComponents.recentProjects.stage")}</th>
              <th className="px-6 py-4">{t("dashboardComponents.recentProjects.confidence")}</th>
              <th className="px-6 py-4">{t("dashboardComponents.recentProjects.status")}</th>
              <th className="px-6 py-4">{t("dashboardComponents.recentProjects.updated")}</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.projectId} className="border-t border-slate-800 bg-slate-950 hover:bg-slate-900">
                <td className="px-6 py-4">
                  <p className="font-semibold text-white">{project.name}</p>
                  <p className="text-xs text-slate-500">{project.projectId}</p>
                </td>
                <td className="px-6 py-4 text-slate-300">{project.stage}</td>
                <td className="px-6 py-4 text-slate-300">{project.confidence}</td>
                <td className="px-6 py-4 text-slate-300">{project.status}</td>
                <td className="px-6 py-4 text-slate-300">{project.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
