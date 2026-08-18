"use client";

import Link from "next/link";
import { formatDate } from "@/lib/formatting/dates";
import { useTranslations } from "@/lib/i18n/locale-provider";
import StatusBadge, { type StatusTone } from "./status-badge";

const PROJECT_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "default",
  ACTIVE: "success",
  NEEDS_REVIEW: "warning",
  INTERNALLY_APPROVED: "info",
  SENT: "info",
  CLIENT_APPROVED: "success",
  REVISION_REQUESTED: "warning",
  REJECTED: "error",
  ARCHIVED: "default",
};

const STATUS_PROGRESS_ORDER = ["DRAFT", "ACTIVE", "NEEDS_REVIEW", "INTERNALLY_APPROVED", "SENT", "CLIENT_APPROVED", "ARCHIVED"];

function statusProgress(status: string): { fraction: number; barClass: string } {
  if (status === "REVISION_REQUESTED") {
    return { fraction: 2 / (STATUS_PROGRESS_ORDER.length - 1), barClass: "bg-[#D98A16] dark:bg-[#FBBF24]" };
  }
  if (status === "REJECTED") {
    return { fraction: 4 / (STATUS_PROGRESS_ORDER.length - 1), barClass: "bg-[#D84A4A] dark:bg-[#F87171]" };
  }
  const index = STATUS_PROGRESS_ORDER.indexOf(status);
  const fraction = index === -1 ? 0 : index / (STATUS_PROGRESS_ORDER.length - 1);
  const barClass = status === "ARCHIVED" ? "bg-[#159A6A] dark:bg-emerald-400" : "bg-[#009FE3] dark:bg-[#21C7F3]";
  return { fraction, barClass };
}

export type RecentProject = {
  id: string;
  name: string;
  reference: string;
  status: string;
  updatedAt: string;
  client: { id: string; name: string; companyName: string | null } | null;
  boqCount: number;
  fileCount: number;
  documentCount: number;
};

export default function ProjectCard({ project }: { project: RecentProject }) {
  const t = useTranslations();
  const progress = statusProgress(project.status);
  const progressPercent = Math.round(progress.fraction * 100);
  return (
    <div className="rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B9C7D6] hover:shadow-md dark:hover:border-[#31405F] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#08152E] dark:text-white">{project.name}</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            {project.client?.companyName || project.client?.name || t("dashboardComponents.shared.noClientAssigned")}
          </p>
        </div>
        <StatusBadge label={project.status} tone={PROJECT_STATUS_TONE[project.status] ?? "default"} />
      </div>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#D5E0EC] dark:bg-[#20304D]"
        role="img"
        aria-label={t("dashboardComponents.projectCard.lifecycleProgress", { percent: progressPercent })}
      >
        <span className={`block h-full rounded-full ${progress.barClass}`} style={{ width: `${Math.max(6, progress.fraction * 100)}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#536078] dark:text-[#B8C4D8]">
        <span>
          {t(project.boqCount === 1 ? "dashboardComponents.projectCard.boqCountOne" : "dashboardComponents.projectCard.boqCountOther", { count: project.boqCount })}
        </span>
        <span>
          {t(project.fileCount === 1 ? "dashboardComponents.projectCard.fileCountOne" : "dashboardComponents.projectCard.fileCountOther", { count: project.fileCount })}
        </span>
        <span>
          {t(project.documentCount === 1 ? "dashboardComponents.projectCard.documentCountOne" : "dashboardComponents.projectCard.documentCountOther", { count: project.documentCount })}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{t("dashboardComponents.projectCard.updated", { date: formatDate(project.updatedAt) })}</p>
        <Link
          href={`/projects/${project.id}`}
          className="rounded-xl border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] px-3 py-1.5 text-xs font-semibold text-[#08152E] dark:text-[#F4F8FF] hover:bg-[#EAF1F8] dark:hover:bg-[#101D34]"
        >
          {t("dashboardComponents.shared.open")}
        </Link>
      </div>
    </div>
  );
}
