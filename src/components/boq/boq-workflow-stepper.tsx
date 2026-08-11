"use client";

import {
  describeWorkflowStepReason,
  summarizeWorkflowGuidance,
  WORKFLOW_STEP_ACTIONS,
  type NextStepAction,
  type WorkflowStep,
} from "@/lib/workflow/boq-workflow-state";

/**
 * Guided BOQ measurement workflow (Release 1), spec section 1 — the visible
 * Sources -> Extraction -> Dimensions -> Calculation -> BOQ Review ->
 * Validation -> Output stepper, plus the "what should I do next" card.
 * Purely presentational: all status logic lives in boq-workflow-state.ts so
 * it stays testable without a DOM.
 */

const STATUS_STYLES: Record<WorkflowStep["status"], { dot: string; text: string; label: string }> = {
  COMPLETE: { dot: "bg-emerald-500", text: "text-emerald-300", label: "Complete" },
  CURRENT: { dot: "bg-blue-500", text: "text-blue-300", label: "Current" },
  NEEDS_ATTENTION: { dot: "bg-amber-500", text: "text-amber-300", label: "Needs attention" },
  NOT_STARTED: { dot: "bg-slate-700", text: "text-slate-500", label: "Not started" },
  NOT_REQUIRED: { dot: "bg-slate-600", text: "text-slate-400", label: "Not required" },
};

export type BoqWorkflowStepperProps = {
  steps: WorkflowStep[];
  nextAction: NextStepAction;
  onAction: (action: NonNullable<NextStepAction["ctaAction"]>) => void;
};

export function BoqWorkflowStepper({ steps, nextAction, onAction }: BoqWorkflowStepperProps) {
  const guidance = summarizeWorkflowGuidance(steps, nextAction);

  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
      <p className="text-sm uppercase tracking-[0.28em] text-slate-500">BOQ Workflow</p>
      <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-4">
        {steps.map((step, index) => {
          const style = STATUS_STYLES[step.status];
          const reason = describeWorkflowStepReason(step.status);
          return (
            <li key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAction(WORKFLOW_STEP_ACTIONS[step.id])}
                title={reason}
                aria-label={`${step.label} — ${style.label}. ${reason}`}
                className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-left transition-colors hover:border-blue-600/60 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">{step.label}</span>
                  <span className={`text-[0.65rem] uppercase tracking-wide ${style.text}`}>{style.label}</span>
                </div>
              </button>
              {index < steps.length - 1 && <span className="text-slate-700" aria-hidden="true">&rarr;</span>}
            </li>
          );
        })}
      </ol>

      <div
        role="status"
        aria-label="What should I do next"
        className="mt-6 rounded-3xl border border-blue-900/40 bg-blue-950/20 p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">What should I do next?</p>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-slate-500">Current stage</dt>
            <dd className="text-sm font-semibold text-white">{guidance.currentStage?.label ?? "Not started"}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-slate-500">Why</dt>
            <dd className="text-sm text-slate-200">{guidance.why}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-200">
            <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">Do this now: </span>
            {guidance.doThisNow}
          </p>
          {nextAction.ctaAction && (
            <button
              type="button"
              onClick={() => onAction(nextAction.ctaAction as NonNullable<NextStepAction["ctaAction"]>)}
              className="shrink-0 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {nextAction.ctaLabel}
            </button>
          )}
        </div>

        {guidance.afterThat && (
          <p className="mt-3 text-xs text-slate-500">
            <span className="uppercase tracking-wide">After that: </span>
            {guidance.afterThat.label}
          </p>
        )}
      </div>
    </div>
  );
}
