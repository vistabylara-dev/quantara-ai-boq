import Link from "next/link";
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

function describeCompletedWork(workflow: ProjectWorkflowResult): string {
  if (!workflow.projectExists) {
    return "Project information is not available, so no workflow completion is being reported.";
  }
  if (workflow.fileCount === 0) {
    return "The project is set up. No project sources have been added yet.";
  }

  const sourceLabel = workflow.fileCount === 1 ? "project source is" : "project sources are";
  if (workflow.extractionSummary.total === 0) {
    return `${workflow.fileCount} ${sourceLabel} available. No extracted BOQ candidates are available yet.`;
  }

  const attentionLabel = workflow.extractionSummary.needsAttention === 1 ? "item requires" : "items require";
  return `${workflow.extractionSummary.total} candidates found. ${workflow.extractionSummary.reviewed} reviewed. ${workflow.extractionSummary.needsAttention} ${attentionLabel} attention.`;
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
            Project workflow
          </h2>
          <p className="mt-2 text-sm text-[#536078] dark:text-[#8CA0BE]">
            {currentStage ? `Current focus: ${currentStage.label}.` : "No current workflow stage is available."}
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
        {workflow.stages.map((stage, index) => (
          <li
            key={stage.id}
            aria-current={stage.state === "CURRENT" || stage.state === "NEEDS_ATTENTION" ? "step" : undefined}
            className={`rounded-2xl border p-3 ${stateClasses[stage.state]}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">Step {index + 1}</span>
            <p className="mt-1 text-sm font-semibold leading-5">{stage.label}</p>
            <p className="mt-1 text-[11px] font-medium">{stateLabel[stage.state]}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#D5E0EC] bg-[#F7FAFD] p-5 dark:border-[#20304D] dark:bg-[#101D34]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#7F8DA6]">
            What has Quantara done?
          </p>
          <p className="mt-3 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
            {describeCompletedWork(workflow)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#009FE3]/30 bg-[#009FE3]/5 p-5 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0077B6] dark:text-[#21C7F3]">
            What should I do next?
          </p>
          {workflow.nextStep ? (
            <>
              <p className="mt-3 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">{workflow.nextStep.message}</p>
              <Link
                href={workflow.nextStep.href}
                className="mt-4 inline-flex rounded-xl border border-[#009FE3] bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#009FE3]/40 dark:border-[#21C7F3] dark:bg-[#21C7F3] dark:text-[#040A16]"
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
