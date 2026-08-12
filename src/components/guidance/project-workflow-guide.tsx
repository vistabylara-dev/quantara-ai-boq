"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { GuideTip, type GuideTipAction } from "@/components/guidance/guide-tip";
import { getGuideStageDefinition } from "@/lib/guidance/guide-registry";
import { getGuideStageHref } from "@/lib/guidance/guide-navigation";
import type {
  ProjectWorkflowResult,
  ProjectWorkflowStage,
  ProjectWorkflowStageState,
} from "@/lib/guidance/project-workflow";

const stateLabel: Record<ProjectWorkflowStageState, string> = {
  COMPLETE: "Complete",
  CURRENT: "Current",
  NEEDS_ATTENTION: "Needs attention",
  NOT_STARTED: "Not started",
};

const stateClasses: Record<ProjectWorkflowStageState, string> = {
  COMPLETE: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
  CURRENT: "border-[#009FE3]/40 bg-[#009FE3]/10 text-[#0077B6] dark:border-[#21C7F3]/40 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]",
  NEEDS_ATTENTION: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
  NOT_STARTED: "border-[#D5E0EC] bg-[#EAF1F8] text-[#7B879C] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#7F8DA6]",
};

function getCurrentStage(stages: ProjectWorkflowStage[]): ProjectWorkflowStage | null {
  return (
    stages.find((stage) => stage.state === "NEEDS_ATTENTION")
    ?? stages.find((stage) => stage.state === "CURRENT")
    ?? [...stages].reverse().find((stage) => stage.state === "COMPLETE")
    ?? null
  );
}

function focusProjectOverview() {
  const overview = document.getElementById("project-overview-section");
  overview?.scrollIntoView({ behavior: "smooth", block: "start" });
  overview?.focus({ preventScroll: true });
}

export function ProjectWorkflowGuide({ workflow }: { workflow: ProjectWorkflowResult }) {
  const currentStage = getCurrentStage(workflow.stages);
  const totalStages = workflow.stages.length;

  return (
    <section
      aria-labelledby="project-workflow-guide-title"
      className="rounded-[28px] border border-[#D5E0EC] bg-white p-6 text-[#08152E] dark:border-[#20304D] dark:bg-[#091326] dark:text-white sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0077B6] dark:text-[#21C7F3]">Where am I?</p>
          <h2 id="project-workflow-guide-title" className="mt-2 text-2xl font-semibold">
            Project intelligence guide
          </h2>
          <p className="mt-2 text-sm text-[#536078] dark:text-[#8CA0BE]">
            {currentStage ? `Current focus: ${currentStage.label}.` : "No current workflow stage is available."}
            {" "}The recommendation never blocks another valid workspace.
          </p>
        </div>
        <p className="text-sm font-medium text-[#536078] dark:text-[#8CA0BE]">
          {workflow.completedStageCount} of {totalStages} stages complete
        </p>
      </div>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-[#DCE7F2] dark:bg-[#17253D]"
        role="progressbar"
        aria-label="Project workflow completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={workflow.progressPercentage}
        aria-valuetext={`${workflow.completedStageCount} of ${totalStages} stages complete`}
      >
        <div
          className="h-full rounded-full bg-[#009FE3] transition-[width] dark:bg-[#21C7F3]"
          style={{ width: `${workflow.progressPercentage}%` }}
        />
      </div>

      <ol className="mt-6 grid gap-2 sm:grid-cols-3 xl:grid-cols-9" aria-label="Project workflow stages">
        {workflow.stages.map((stage, index) => {
          const definition = getGuideStageDefinition(stage.id);
          const cta: GuideTipAction = stage.id === "PROJECT_SETUP"
            ? { label: definition.suggestedActionLabel, onAction: focusProjectOverview }
            : {
                label: definition.suggestedActionLabel,
                href: getGuideStageHref(stage.id, workflow.projectId),
              };
          return (
            <li
              key={stage.id}
              aria-current={stage.state === "CURRENT" || stage.state === "NEEDS_ATTENTION" ? "step" : undefined}
              className={`relative min-h-32 rounded-2xl border p-3 ${stateClasses[stage.state]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">Step {index + 1}</span>
                <GuideTip
                  title={definition.title}
                  shortDescription={`${definition.shortDescription} ${definition.professionalPurpose}`}
                  whatQuantaraDoes={definition.whatQuantaraDoes}
                  whatProfessionalCanDo={definition.whatUserCanDo}
                  cta={cta}
                  ariaLabel={`Open guidance for ${definition.title}`}
                />
              </div>
              <p className="mt-2 text-sm font-semibold leading-5">{stage.label}</p>
              <p className="mt-1 text-[11px] font-medium">{stateLabel[stage.state]}</p>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#D5E0EC] bg-[#F7FAFD] p-5 dark:border-[#20304D] dark:bg-[#101D34]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#7F8DA6]">
            What has Quantara done?
          </p>
          {workflow.factualSummary.length > 0 ? (
            <ul className="mt-3 space-y-2" aria-label="Factual project processing summary">
              {workflow.factualSummary.map((fact) => (
                <li key={fact} className="flex items-start gap-2 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
              No completed project activity is being claimed because the required project data is unavailable.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[#009FE3]/30 bg-[#009FE3]/5 p-5 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0077B6] dark:text-[#21C7F3]">
            Recommended next step
          </p>
          {workflow.nextStep ? (
            <>
              <p className="mt-3 text-sm font-semibold text-[#08152E] dark:text-white">{workflow.nextStep.ctaLabel}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7B879C] dark:text-[#7F8DA6]">Why</p>
              <p className="mt-1 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">{workflow.nextStep.message}</p>
              <Link
                href={workflow.nextStep.href}
                className="mt-4 inline-flex rounded-xl border border-[#009FE3] bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3] dark:border-[#21C7F3] dark:bg-[#21C7F3] dark:text-[#040A16] dark:focus-visible:outline-[#21C7F3]"
              >
                {workflow.nextStep.ctaLabel}
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
              Open an available project before continuing.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProjectWorkflowGuide;
