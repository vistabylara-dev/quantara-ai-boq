"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { ArrowRight, Mic, TriangleAlert } from "lucide-react";
import type { VoiceCommandProposal, VoiceDimensionValue } from "@/lib/voice/voice-types";

export function applyConfirmedDimensionVoiceProposal<T extends VoiceDimensionValue>(
  current: T[],
  dimensionKey: string,
  newValue: number,
): T[] {
  return current.map((dimension) =>
    dimension.key === dimensionKey
      ? {
          ...dimension,
          value: newValue,
          source: "manual_professional_input",
          confidence: 100,
          reviewStatus: "MANUAL_ENTRY",
        }
      : dimension,
  );
}

export type VoiceCalculationImpact = {
  oldValue: number | null;
  newValue: number | null;
  unit: string;
  oldFormula?: string | null;
  newFormula?: string | null;
};

export type VoiceProposalCardProps = {
  proposal: VoiceCommandProposal;
  fieldLabel?: string;
  confirmationScope: "LOCAL_DIMENSION" | "PERSISTED_BOQ_ITEM";
  affectedCalculation?: VoiceCalculationImpact;
  isConfirming?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement>;
  className?: string;
};

export function formatVoiceProposalValue(value: unknown, unit?: string | null): string {
  const rendered = value === null || value === undefined || value === "" ? "Not set" : String(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

function formatCalculationValue(value: number | null, unit: string): string {
  return value === null ? "Not calculable" : `${value} ${unit}`;
}

export function VoiceProposalCard({
  proposal,
  fieldLabel,
  confirmationScope,
  affectedCalculation,
  isConfirming = false,
  confirmDisabled = false,
  error,
  onConfirm,
  onCancel,
  returnFocusRef,
  className = "",
}: VoiceProposalCardProps) {
  const generatedId = useId().replace(/:/g, "");
  const titleId = `voice-proposal-title-${generatedId}`;
  const descriptionId = `voice-proposal-description-${generatedId}`;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const label = fieldLabel ?? proposal.field.replace(/_/g, " ");
  const proposalUnit = "unit" in proposal ? proposal.unit : undefined;

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || isConfirming) return;
      event.preventDefault();
      onCancel();
      requestAnimationFrame(() => returnFocusRef?.current?.focus());
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isConfirming, onCancel, returnFocusRef]);

  function cancel() {
    onCancel();
    requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={`rounded-3xl border border-blue-700/60 bg-blue-950/30 p-5 text-left shadow-lg ${className}`.trim()}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-600/50 bg-blue-900/50">
          <Mic className="h-4 w-4 text-blue-200" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Voice instruction</p>
          <h3 id={titleId} className="mt-1 text-base font-semibold text-white">Review the proposed change</h3>
          <p id={descriptionId} className="mt-2 break-words text-sm text-slate-300">
            &ldquo;{proposal.transcript}&rdquo;
          </p>
          <p className="mt-2 text-xs text-slate-400">{proposal.humanSummary}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300">
            {formatVoiceProposalValue(proposal.oldValue, proposalUnit)}
          </span>
          <span className="sr-only">changes to</span>
          <ArrowRight className="h-4 w-4 text-blue-300" aria-hidden="true" />
          <span className="rounded-xl border border-emerald-700 bg-emerald-950/50 px-3 py-2 font-semibold text-emerald-200">
            {formatVoiceProposalValue(proposal.newValue, proposalUnit)}
          </span>
        </div>
      </div>

      {affectedCalculation ? (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Affected calculation preview</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-300">{formatCalculationValue(affectedCalculation.oldValue, affectedCalculation.unit)}</span>
            <span className="sr-only">changes to</span>
            <ArrowRight className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <span className="font-semibold text-emerald-200">{formatCalculationValue(affectedCalculation.newValue, affectedCalculation.unit)}</span>
          </div>
          {affectedCalculation.newFormula ? (
            <p className="mt-2 break-words font-mono text-xs text-slate-400">{affectedCalculation.newFormula}</p>
          ) : null}
        </div>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <ul className="space-y-1" aria-label="Voice proposal warnings">
            {proposal.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-slate-400">
        {confirmationScope === "LOCAL_DIMENSION"
          ? "Confirm Change updates this visible dimension form only. You must still select Calculate and then Confirm calculation."
          : "No BOQ value has changed yet. Confirm Change applies only this reviewed field through the governed BOQ update path."}
      </p>
      {error ? <p className="mt-3 text-sm text-rose-300" role="alert">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          ref={confirmRef}
          type="button"
          onClick={() => void onConfirm()}
          disabled={isConfirming || confirmDisabled}
          className="min-h-11 rounded-2xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConfirming ? "Applying…" : "Confirm Change"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isConfirming}
          className="min-h-11 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

export default VoiceProposalCard;
