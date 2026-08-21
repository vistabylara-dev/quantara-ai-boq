"use client";

import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import type { OnboardingActionId, OnboardingState } from "@/lib/onboarding/onboarding-state";

const STEPS = [
  ["PROJECT_CREATED", "onboarding.stepProjectCreated"],
  ["SOURCE_ADDED", "onboarding.stepSourceAdded"],
  ["SOURCE_PROCESSED", "onboarding.stepSourceProcessed"],
  ["EXTRACTION_REVIEWED", "onboarding.stepExtractionReviewed"],
  ["BOQ_PREPARED", "onboarding.stepBoqPrepared"],
  ["VALIDATION_COMPLETED", "onboarding.stepValidationCompleted"],
  ["OUTPUT_GENERATED", "onboarding.stepOutputGenerated"],
] as const satisfies ReadonlyArray<readonly [OnboardingActionId, TranslationKey]>;

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function OnboardingWelcome({
  state,
  completedCount,
  onStart,
  onExplore,
}: {
  state: OnboardingState;
  completedCount: number;
  onStart: () => void;
  onExplore: () => void;
}) {
  const t = useTranslations();
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => primaryRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onExplore();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onExplore]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantara-onboarding-welcome-title"
        aria-describedby="quantara-onboarding-welcome-description"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[#21C7F3]/30 bg-[#07111F] p-6 text-white shadow-[0_24px_90px_rgba(0,0,0,0.55)] sm:p-8"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#21C7F3]/30 bg-[#21C7F3]/10 text-[#21C7F3]">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#21C7F3]">
              {t("onboarding.welcomeEyebrow")}
            </p>
            <h2
              id="quantara-onboarding-welcome-title"
              className="mt-2 text-3xl font-bold tracking-tight text-white"
            >
              {t("onboarding.welcomeTitle")}
            </h2>
            <p
              id="quantara-onboarding-welcome-description"
              className="mt-3 max-w-2xl text-sm leading-6 text-slate-300"
            >
              {t("onboarding.welcomeBody")}
            </p>
          </div>
        </div>

        <section
          aria-labelledby="quantara-onboarding-checklist-title"
          className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3
                id="quantara-onboarding-checklist-title"
                className="font-semibold text-white"
              >
                {t("onboarding.gettingStarted")}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {t("onboarding.checklistDescription")}
              </p>
            </div>
            <span className="rounded-full border border-[#21C7F3]/30 bg-[#21C7F3]/10 px-3 py-1 text-xs font-semibold text-[#21C7F3]">
              {t("onboarding.progress", {
                completed: completedCount,
                total: STEPS.length,
              })}
            </span>
          </div>

          <ol className="mt-5 grid gap-2 sm:grid-cols-2">
            {STEPS.map(([actionId, labelKey], index) => {
              const complete = state.completedActions[actionId];
              return (
                <li
                  key={actionId}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm"
                >
                  {complete ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-300"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                  <span className={complete ? "text-slate-300" : "text-white"}>
                    {index + 1}. {t(labelKey)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onExplore}
            className="min-h-11 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#21C7F3]"
          >
            {t("onboarding.exploreMyself")}
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onStart}
            className="min-h-11 rounded-xl border border-[#21C7F3] bg-[#21C7F3] px-5 py-2.5 text-sm font-bold text-[#040A16] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#21C7F3]"
          >
            {t("onboarding.startGuidedTour")}
          </button>
        </div>
      </div>
    </div>
  );
}
