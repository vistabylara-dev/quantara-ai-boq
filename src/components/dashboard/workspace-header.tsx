import { ArrowRight, FileCheck2, Plus, Upload } from "lucide-react";
import Link from "next/link";
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
    <header className="rounded-[32px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white/90 dark:bg-[#0B1426]/90 backdrop-blur-sm p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">{TODAY_LABEL} · {companyName}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0B1630] dark:text-white sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#536078] dark:text-[#B8C4D8]">
            {recentUpdatesCount > 0
              ? `${recentUpdatesCount} project${recentUpdatesCount === 1 ? "" : "s"} updated in the last 7 days.`
              : "Your construction workspace, ready when you are."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={planLabel} tone={planTone} />
          <StatusBadge label="Systems operational" tone="success" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {currentProject ? (
          <div className="rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">Current active project</p>
              <StatusBadge label={currentProject.status} tone="info" />
            </div>
            <p className="mt-2 text-xl font-semibold text-[#0B1630] dark:text-white">{currentProject.name}</p>
            <p className="mt-1 text-sm text-[#536078] dark:text-[#B8C4D8]">
              {currentProject.reference} · {currentProject.client?.companyName || currentProject.client?.name || "No client assigned"}
            </p>
            <Link
              href={`/projects/${currentProject.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0284C7] hover:underline dark:text-[#22D3EE]"
            >
              Open project
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#D9E2EC] dark:border-[#1E2A42] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">Current active project</p>
            <p className="mt-2 text-sm text-[#536078] dark:text-[#B8C4D8]">
              No active project yet. Create your first project to start building a BOQ.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <Link
            href="/projects/new"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#0EA5E9] dark:border-[#22D3EE] bg-[#0EA5E9] dark:bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-white dark:text-[#050B18] transition-transform hover:opacity-90 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Project
          </Link>
          <Link
            href={uploadHref}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:text-[#F7FAFC] transition-transform hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload Drawing
          </Link>
          <Link
            href={boqHref}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:text-[#F7FAFC] transition-transform hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
          >
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            Create BOQ
          </Link>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#D9E2EC] dark:border-[#1E2A42] pt-4 text-sm">
        <p className="text-[#536078] dark:text-[#B8C4D8]">
          Signed in as <span className="font-semibold text-[#0B1630] dark:text-white">{userName || userEmail}</span>
          <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{userRole}</span>
        </p>
      </div>
    </header>
  );
}
