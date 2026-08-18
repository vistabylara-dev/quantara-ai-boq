"use client";

import { ArrowRight, FileCheck2, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/locale-provider";
import StatusBadge, { type StatusTone } from "./status-badge";

const HERO_IMAGE = `/images/dashboard/${encodeURIComponent("Gemini_Generated_Image_jo3u1mjo3u1mjo3u.png")}`;

export type CurrentProject = {
  id: string;
  name: string;
  reference: string;
  status: string;
  client: { name: string; companyName: string | null } | null;
};

const TODAY_LABEL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

/**
 * Pure href resolvers, exported separately so navigation-target regressions can be unit-tested
 * without rendering React. "Upload Drawing" must always resolve to the purpose-built drawing
 * uploader — never /imports (CSV/XLSX spreadsheet importer) or the legacy /files
 * extraction-preview page. See docs/upload-workflow-contract.md and
 * tests/workspace-header-navigation.test.ts, added after a production PDF upload was misrouted
 * through /imports because this exact button pointed there when no project was active.
 */
export function resolveUploadDrawingHref(currentProject: CurrentProject | null): string {
  return currentProject ? `/projects/${currentProject.id}/drawings` : "/projects/new";
}

export function resolveBoqHref(currentProject: CurrentProject | null): string {
  return currentProject ? `/projects/${currentProject.id}/boq` : "/projects/new";
}

export default function WorkspaceHeader({
  companyName,
  userName,
  userEmail,
  userRole,
  planLabel,
  planTone,
  currentProject,
  recentUpdatesCount,
}: {
  companyName: string;
  userName: string;
  userEmail: string;
  userRole: string;
  planLabel: string;
  planTone: StatusTone;
  currentProject: CurrentProject | null;
  recentUpdatesCount: number;
}) {
  const t = useTranslations();
  const firstName = (userName || userEmail).split(" ")[0];
  const uploadHref = resolveUploadDrawingHref(currentProject);
  const boqHref = resolveBoqHref(currentProject);

  return (
    <header className="relative overflow-hidden rounded-[32px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326]">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#8CA0BE]">{TODAY_LABEL} · {companyName}</p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#08152E] dark:text-white sm:text-4xl">
            {t("dashboardComponents.workspaceHeader.welcomeBack", { name: firstName })}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-[#536078] dark:text-[#8CA0BE]">
            {recentUpdatesCount > 0
              ? t("dashboardComponents.workspaceHeader.recentUpdates", { count: recentUpdatesCount })
              : t("dashboardComponents.workspaceHeader.readyWhenYouAre")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge label={planLabel} tone={planTone} />
          </div>

          {currentProject ? (
            <div className="mt-6 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{t("dashboardComponents.workspaceHeader.currentActiveProject")}</p>
                <StatusBadge label={currentProject.status} tone="info" />
              </div>
              <p className="mt-2 text-xl font-semibold text-[#08152E] dark:text-white">{currentProject.name}</p>
              <p className="mt-1 text-sm text-[#536078] dark:text-[#8CA0BE]">
                {currentProject.reference} · {currentProject.client?.companyName || currentProject.client?.name || t("dashboardComponents.shared.noClientAssigned")}
              </p>
              <Link
                href={`/projects/${currentProject.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0077B6] hover:underline dark:text-[#21C7F3]"
              >
                {t("dashboardComponents.workspaceHeader.openProject")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-[#D5E0EC] dark:border-[#20304D] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{t("dashboardComponents.workspaceHeader.currentActiveProject")}</p>
              <p className="mt-2 text-sm text-[#536078] dark:text-[#8CA0BE]">
                {t("dashboardComponents.workspaceHeader.noActiveProjectYet")}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/projects/new"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white transition-transform hover:opacity-90 hover:-translate-y-0.5 dark:bg-[#21C7F3] dark:text-[#040A16] motion-reduce:hover:translate-y-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("dashboardComponents.workspaceHeader.createProject")}
            </Link>
            <Link
              href={uploadHref}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] px-4 py-2 text-sm font-semibold text-[#08152E] dark:text-[#F4F8FF] transition-transform hover:bg-[#EAF1F8] dark:hover:bg-[#101D34] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t("dashboardComponents.workspaceHeader.uploadDrawing")}
            </Link>
            <Link
              href={boqHref}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] px-4 py-2 text-sm font-semibold text-[#08152E] dark:text-[#F4F8FF] transition-transform hover:bg-[#EAF1F8] dark:hover:bg-[#101D34] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              {t("dashboardComponents.workspaceHeader.createBoq")}
            </Link>
          </div>

          <p className="mt-5 text-sm text-[#536078] dark:text-[#8CA0BE]">
            {t("dashboardComponents.workspaceHeader.signedInAs")} <span className="font-semibold text-[#08152E] dark:text-white">{userName || userEmail}</span>
            <span className="ms-2 text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{userRole}</span>
          </p>
        </div>

        <div className="relative hidden aspect-square items-center justify-center overflow-hidden rounded-[28px] lg:flex" aria-hidden="true">
          <div className="absolute inset-0 bg-[#EAF1F8] dark:bg-[#040A16]" />
          <img src={HERO_IMAGE} alt="" width={1600} height={872} loading="lazy" className="relative h-full w-full object-cover" />
        </div>
      </div>
    </header>
  );
}
