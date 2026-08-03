import { Check } from "lucide-react";
import SectionHeader from "./section-header";
import EmptyState from "./empty-state";

export type TimelineProject = {
  name: string;
  status: string;
  fileCount: number;
  boqCount: number;
  documentCount: number;
};

const PROPOSAL_STATUSES = ["SENT", "CLIENT_APPROVED", "REVISION_REQUESTED", "REJECTED", "ARCHIVED"];
const APPROVAL_STATUSES = ["CLIENT_APPROVED", "ARCHIVED"];
const PAST_DRAFT_STATUSES = ["DRAFT", "ACTIVE"];

function deriveSteps(project: TimelineProject) {
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

export default function ConstructionTimeline({ project }: { project: TimelineProject | null }) {
  return (
    <section className="rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8">
      <SectionHeader title="Construction timeline" description={project ? `Real lifecycle progress for ${project.name}.` : "Lifecycle progress for your active project."} />
      {!project ? (
        <EmptyState message="No active project yet. Create a project to see its lifecycle here." />
      ) : (
        <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-4 sm:flex-nowrap">
          {deriveSteps(project).map((step, index, all) => (
            <li key={step.label} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    step.done
                      ? "border-[#159A6A] bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "border-[#D9E2EC] bg-[#EEF3F8] text-[#7B879C] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#7F8DA6]"
                  }`}
                >
                  {step.done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">{step.label}</span>
              </div>
              {index < all.length - 1 && (
                <span
                  className={`h-0.5 flex-1 rounded-full ${step.done ? "bg-[#159A6A]/40 dark:bg-emerald-400/40" : "bg-[#D9E2EC] dark:bg-[#1E2A42]"}`}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
