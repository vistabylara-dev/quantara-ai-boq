import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import ProjectIntelligenceVisualCompact from "@/components/visuals/project-intelligence-visual-compact";
import EmptyStateIllustration from "@/components/visuals/empty-state-illustration";
import { formatDate } from "@/lib/formatting/dates";
import SectionHeader from "./section-header";
import StatusBadge from "./status-badge";

export type IntelligenceProject = {
  id: string;
  name: string;
  reference: string;
  status: string;
  updatedAt: string;
  client: { name: string; companyName: string | null } | null;
  boqCount: number;
  fileCount: number;
  documentCount: number;
};

const PROPOSAL_STATUSES = ["SENT", "CLIENT_APPROVED", "REVISION_REQUESTED", "REJECTED", "ARCHIVED"];
const APPROVAL_STATUSES = ["CLIENT_APPROVED", "ARCHIVED"];
const PAST_DRAFT_STATUSES = ["DRAFT", "ACTIVE"];

function deriveLifecycle(project: IntelligenceProject) {
  return [
    { label: "Project", done: true },
    { label: "Upload", done: project.fileCount > 0 },
    { label: "BOQ", done: project.boqCount > 0 },
    { label: "Revision", done: !PAST_DRAFT_STATUSES.includes(project.status) },
    { label: "Proposal", done: PROPOSAL_STATUSES.includes(project.status) },
    { label: "Approval", done: APPROVAL_STATUSES.includes(project.status) },
    { label: "Completed", done: project.status === "ARCHIVED" },
  ];
}

function recommendedAction(project: IntelligenceProject): { text: string; href: string } | null {
  if (project.fileCount === 0) {
    return { text: "Upload your first drawing to begin extraction.", href: `/projects/${project.id}/files` };
  }
  if (project.boqCount === 0) {
    return { text: "Create a BOQ from your uploaded drawings.", href: `/projects/${project.id}/boq` };
  }
  if (project.status === "REVISION_REQUESTED") {
    return { text: "Address the client's requested revisions.", href: `/projects/${project.id}/boq` };
  }
  if (["DRAFT", "ACTIVE", "NEEDS_REVIEW"].includes(project.status)) {
    return { text: "Continue refining your bill of quantities.", href: `/projects/${project.id}/boq` };
  }
  if (project.status === "INTERNALLY_APPROVED") {
    return { text: "Send the proposal to your client.", href: `/projects/${project.id}/proposals` };
  }
  if (project.status === "CLIENT_APPROVED") {
    return { text: "Export final documents for handover.", href: `/projects/${project.id}/documents` };
  }
  if (project.status === "SENT") {
    return null;
  }
  return null;
}

export default function ProjectIntelligencePanel({ project }: { project: IntelligenceProject | null }) {
  if (!project) {
    return (
      <section className="rounded-[28px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-6 sm:p-8">
        <SectionHeader title="Project intelligence" description="Real-time lifecycle tracking for your active project." />
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#D5E0EC] dark:border-[#20304D] px-6 py-10 text-center">
          <div className="h-24 w-36 text-[#0077B6] dark:text-[#21C7F3]">
            <EmptyStateIllustration className="h-full w-full" />
          </div>
          <p className="mt-2 text-sm font-semibold text-[#08152E] dark:text-white">No active project yet</p>
          <p className="mt-1 max-w-sm text-sm text-[#7B879C] dark:text-[#8CA0BE]">
            Once you create a project, this panel will track its real lifecycle — drawings, BOQ, revisions, proposal, and approval — as it happens.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
          >
            Create first project
          </Link>
        </div>
      </section>
    );
  }

  const lifecycle = deriveLifecycle(project);
  const action = recommendedAction(project);

  return (
    <section className="rounded-[28px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">Project intelligence</p>
            <StatusBadge label={project.status} tone="info" />
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-[#08152E] dark:text-white">{project.name}</h2>
          <p className="mt-1 text-sm text-[#536078] dark:text-[#8CA0BE]">
            {project.reference} · {project.client?.companyName || project.client?.name || "No client assigned"}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-4 text-sm sm:max-w-sm">
            <div>
              <p className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">BOQs</p>
              <p className="mt-1 text-lg font-semibold text-[#08152E] dark:text-white">{project.boqCount}</p>
            </div>
            <div>
              <p className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">Files</p>
              <p className="mt-1 text-lg font-semibold text-[#08152E] dark:text-white">{project.fileCount}</p>
            </div>
            <div>
              <p className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">Documents</p>
              <p className="mt-1 text-lg font-semibold text-[#08152E] dark:text-white">{project.documentCount}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-[#7B879C] dark:text-[#8CA0BE]">Last updated {formatDate(project.updatedAt)}</p>
        </div>

        <div className="hidden h-32 w-32 shrink-0 text-[#D5E0EC] dark:text-[#20304D] lg:block" aria-hidden="true">
          <ProjectIntelligenceVisualCompact className="h-full w-full" />
        </div>
      </div>

      <ol className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-4 border-t border-[#D5E0EC] pt-6 dark:border-[#20304D] sm:flex-nowrap">
        {lifecycle.map((step, index, all) => (
          <li key={step.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-2 text-center">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  step.done
                    ? "border-[#159A6A] bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-[#D5E0EC] bg-[#EAF1F8] text-[#7B879C] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]"
                }`}
              >
                {step.done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className="text-xs font-medium text-[#536078] dark:text-[#8CA0BE]">{step.label}</span>
            </div>
            {index < all.length - 1 && (
              <span
                className={`h-0.5 flex-1 rounded-full ${step.done ? "bg-[#159A6A]/40 dark:bg-emerald-400/40" : "bg-[#D5E0EC] dark:bg-[#20304D]"}`}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>

      {action && (
        <Link
          href={action.href}
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[#009FE3]/30 bg-[#009FE3]/5 px-5 py-4 text-sm transition-colors hover:bg-[#009FE3]/10 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5 dark:hover:bg-[#21C7F3]/10"
        >
          <span>
            <span className="font-semibold text-[#08152E] dark:text-white">Next recommended action: </span>
            <span className="text-[#536078] dark:text-[#8CA0BE]">{action.text}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
