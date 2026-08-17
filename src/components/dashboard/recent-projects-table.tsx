"use client";

import Link from "next/link";
import type { Project } from "@/types/project";
import { formatDate } from "@/lib/formatting/dates";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function RecentProjectsTable({ projects }: { projects: Project[] }) {
  const t = useTranslations();
  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900">
      <table className="min-w-full text-start text-sm text-slate-300">
        <thead className="bg-slate-950 text-slate-400">
          <tr>
            <th className="px-6 py-4">{t("dashboardComponents.recentProjectsTable.project")}</th>
            <th className="px-6 py-4">{t("dashboardComponents.recentProjectsTable.industry")}</th>
            <th className="px-6 py-4">{t("dashboardComponents.recentProjectsTable.status")}</th>
            <th className="px-6 py-4">{t("dashboardComponents.recentProjectsTable.updated")}</th>
            <th className="px-6 py-4">{t("dashboardComponents.recentProjectsTable.action")}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-t border-slate-800 hover:bg-slate-900">
              <td className="px-6 py-4">
                <p className="font-semibold text-white">{project.name}</p>
                <p className="text-xs text-slate-500">{project.reference}</p>
              </td>
              <td className="px-6 py-4 text-slate-300">{project.industryId.replace(/-/g, " ")}</td>
              <td className="px-6 py-4 text-slate-300">{project.status}</td>
              <td className="px-6 py-4 text-slate-300">{formatDate(project.updatedAt)}</td>
              <td className="px-6 py-4">
                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  {t("dashboardComponents.shared.open")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
