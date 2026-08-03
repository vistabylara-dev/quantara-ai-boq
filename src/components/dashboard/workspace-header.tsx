import { ArrowRight, FileCheck2, Plus, Upload } from "lucide-react";
import Link from "next/link";
import ProjectIntelligenceVisual from "@/components/visuals/project-intelligence-visual";
import StatusBadge, { type StatusTone } from "./status-badge";

export type CurrentProject = {
  id: string;
  name: string;
  reference: string;
  status: string;
  client: { name: string; companyName: string | null } | null;
};

const TODAY_LABEL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

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
  const firstName = (userName || userEmail).split(" ")[0];
  const uploadHref = currentProject ? `/projects/${currentProject.id}/files` : "/imports";
  const boqHref = currentProject ? `/projects/${currentProject.id}/boq` : "/projects/new";

  return (
    <header className="relative overflow-hidden rounded-[32px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326]">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#8CA0BE]">{TODAY_LABEL} · {companyName}</p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#08152E] dark:text-white sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-[#536078] dark:text-[#8CA0BE]">
            {recentUpdatesCount > 0
              ? `${recentUpdatesCount} of your most recent projects updated in the last 7 days.`
              : "Your AI construction command center, ready when you are."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge label={planLabel} tone={planTone} />
            <StatusBadge label="Systems operational" tone="success" />
          </div>

          {currentProject ? (
            <div className="mt-6 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">Current active project</p>
                <StatusBadge label={currentProject.status} tone="info" />
              </div>
              <p className="mt-2 text-xl font-semibold text-[#08152E] dark:text-white">{currentProject.name}</p>
              <p className="mt-1 text-sm text-[#536078] dark:text-[#8CA0BE]">
                {currentProject.reference} · {currentProject.client?.companyName || currentProject.client?.name || "No client assigned"}
              </p>
              <Link
                href={`/projects/${currentProject.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0077B6] hover:underline dark:text-[#21C7F3]"
              >
                Open project
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-[#D5E0EC] dark:border-[#20304D] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">Current active project</p>
              <p className="mt-2 text-sm text-[#536078] dark:text-[#8CA0BE]">
                No active project yet. Create your first project to start building a BOQ.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/projects/new"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white transition-transform hover:opacity-90 hover:-translate-y-0.5 dark:bg-[#21C7F3] dark:text-[#040A16] motion-reduce:hover:translate-y-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Project
            </Link>
            <Link
              href={uploadHref}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] px-4 py-2 text-sm font-semibold text-[#08152E] dark:text-[#F4F8FF] transition-transform hover:bg-[#EAF1F8] dark:hover:bg-[#101D34] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Drawing
            </Link>
            <Link
              href={boqHref}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] px-4 py-2 text-sm font-semibold text-[#08152E] dark:text-[#F4F8FF] transition-transform hover:bg-[#EAF1F8] dark:hover:bg-[#101D34] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              Create BOQ
            </Link>
          </div>

          <p className="mt-5 text-sm text-[#536078] dark:text-[#8CA0BE]">
            Signed in as <span className="font-semibold text-[#08152E] dark:text-white">{userName || userEmail}</span>
            <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{userRole}</span>
          </p>
        </div>

        <div className="relative hidden aspect-square items-center justify-center lg:flex" aria-hidden="true">
          <div className="absolute inset-0 rounded-[28px] bg-[#EAF1F8] dark:bg-[#040A16]" />
          <ProjectIntelligenceVisual className="relative h-full w-full text-[#20304D] dark:text-[#20304D]" />
        </div>
      </div>
    </header>
  );
}
