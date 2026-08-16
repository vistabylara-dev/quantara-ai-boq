"use client";

import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import OnboardingWelcome from "@/components/onboarding/onboarding-welcome";
import { apiClient } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import {
  ONBOARDING_ACTION_IDS,
  ONBOARDING_EVENT_NAME,
  completeOnboardingAction,
  continueOnboardingGuidance,
  countCompletedOnboardingActions,
  createEmptyOnboardingState,
  createInitialOnboardingState,
  dismissOnboardingGuidance,
  isOnboardingActionId,
  readOnboardingState,
  restartOnboardingGuidance,
  seedOnboardingFromMetrics,
  writeOnboardingState,
  type OnboardingActionEventDetail,
  type OnboardingActionId,
  type OnboardingActionOptions,
  type OnboardingDashboardMetrics,
  type OnboardingState,
} from "@/lib/onboarding/onboarding-state";

type SessionData =
  | { authenticated: false }
  | { authenticated: true; user: { id: string } };

type OnboardingContextValue = {
  state: OnboardingState;
  completedCount: number;
  markActionComplete: (
    actionId: OnboardingActionId,
    options?: OnboardingActionOptions,
  ) => void;
  startGuidedTour: () => void;
  exploreMyself: () => void;
  continueGuidedSetup: () => void;
  restartTour: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const STEP_KEYS = [
  ["PROJECT_CREATED", "onboarding.stepProjectCreated"],
  ["SOURCE_ADDED", "onboarding.stepSourceAdded"],
  ["SOURCE_PROCESSED", "onboarding.stepSourceProcessed"],
  ["EXTRACTION_REVIEWED", "onboarding.stepExtractionReviewed"],
  ["BOQ_PREPARED", "onboarding.stepBoqPrepared"],
  ["VALIDATION_COMPLETED", "onboarding.stepValidationCompleted"],
  ["OUTPUT_GENERATED", "onboarding.stepOutputGenerated"],
] as const satisfies ReadonlyArray<readonly [OnboardingActionId, TranslationKey]>;

function safeBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fallbackStateWhenMetricsUnavailable(): OnboardingState {
  return {
    ...createEmptyOnboardingState(),
    // Fail open for established-user safety: a temporary metrics failure must
    // never surprise a customer with an automatic first-run interruption.
    welcomeSeen: true,
  };
}

export function useOnboarding(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations();
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [ready, setReady] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [restartWelcomeOpen, setRestartWelcomeOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function initialize() {
      try {
        const session = await apiClient.get<SessionData>(
          "/api/auth/session",
          controller.signal,
        );
        if (!active || !session.authenticated) return;

        const nextUserId = session.user.id?.trim();
        if (!nextUserId) return;

        const storage = safeBrowserStorage();
        const stored = storage
          ? readOnboardingState(storage, nextUserId)
          : null;

        let metrics: OnboardingDashboardMetrics | null = null;
        try {
          metrics = await apiClient.get<OnboardingDashboardMetrics>(
            "/api/dashboard/metrics",
            controller.signal,
          );
        } catch {
          metrics = null;
        }

        if (!active) return;

        let nextState: OnboardingState;
        let shouldPersist = true;
        if (stored) {
          nextState = metrics
            ? seedOnboardingFromMetrics(stored, metrics).state
            : stored;
        } else if (metrics) {
          nextState = createInitialOnboardingState(metrics);
        } else {
          nextState = fallbackStateWhenMetricsUnavailable();
          shouldPersist = false;
        }

        setUserId(nextUserId);
        setState(nextState);
        if (storage && shouldPersist) {
          writeOnboardingState(storage, nextUserId, nextState);
        }
      } catch {
        // Onboarding is optional UI guidance. Auth/session failures remain
        // governed by the existing SaaS shell and must not cause a takeover.
      } finally {
        if (active) setReady(true);
      }
    }

    void initialize();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const updateState = useCallback(
    (updater: (current: OnboardingState) => OnboardingState) => {
      setState((current) => {
        if (!current) return current;
        const next = updater(current);
        if (next === current) return current;

        const storage = safeBrowserStorage();
        if (storage && userId) {
          writeOnboardingState(storage, userId, next);
        }
        return next;
      });
    },
    [userId],
  );

  const markActionComplete = useCallback(
    (actionId: OnboardingActionId, options: OnboardingActionOptions = {}) => {
      updateState((current) =>
        completeOnboardingAction(current, actionId, options),
      );
    },
    [updateState],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleActionComplete(event: Event) {
      const detail = (event as CustomEvent<OnboardingActionEventDetail>).detail;
      if (!detail || !isOnboardingActionId(detail.actionId)) return;

      markActionComplete(detail.actionId, {
        projectId: detail.projectId,
      });
    }

    window.addEventListener(ONBOARDING_EVENT_NAME, handleActionComplete);
    return () =>
      window.removeEventListener(ONBOARDING_EVENT_NAME, handleActionComplete);
  }, [markActionComplete]);

  const startGuidedTour = useCallback(() => {
    setRestartWelcomeOpen(false);
    setChecklistOpen(true);
    updateState((current) => continueOnboardingGuidance(current));
  }, [updateState]);

  const exploreMyself = useCallback(() => {
    setRestartWelcomeOpen(false);
    setChecklistOpen(false);
    updateState((current) => dismissOnboardingGuidance(current));
  }, [updateState]);

  const continueGuidedSetup = useCallback(() => {
    setChecklistOpen(true);
    updateState((current) => continueOnboardingGuidance(current));
  }, [updateState]);

  const restartTour = useCallback(() => {
    setChecklistOpen(false);
    setRestartWelcomeOpen(true);
    updateState((current) => restartOnboardingGuidance(current));
  }, [updateState]);

  const completedCount = state ? countCompletedOnboardingActions(state) : 0;
  const showWelcome = Boolean(
    ready
      && state
      && !state.welcomeSeen
      && (pathname === "/dashboard" || restartWelcomeOpen),
  );

  const contextValue = useMemo<OnboardingContextValue | null>(
    () =>
      state
        ? {
            state,
            completedCount,
            markActionComplete,
            startGuidedTour,
            exploreMyself,
            continueGuidedSetup,
            restartTour,
          }
        : null,
    [
      completedCount,
      continueGuidedSetup,
      exploreMyself,
      markActionComplete,
      restartTour,
      startGuidedTour,
      state,
    ],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}

      {showWelcome && state ? (
        <OnboardingWelcome
          state={state}
          completedCount={completedCount}
          onStart={startGuidedTour}
          onExplore={exploreMyself}
        />
      ) : null}

      {ready
      && state
      && state.tourActive
      && (state.tourReplay || completedCount < ONBOARDING_ACTION_IDS.length)
      && !showWelcome ? (
        <div className="fixed bottom-4 start-4 z-30 w-[min(22rem,calc(100vw-2rem))]">
          {checklistOpen ? (
            <section
              aria-labelledby="quantara-getting-started-title"
              className="rounded-2xl border border-[#21C7F3]/30 bg-[#07111F] p-4 text-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="quantara-getting-started-title"
                    className="text-sm font-bold"
                  >
                    {t("onboarding.gettingStarted")}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("onboarding.progress", {
                      completed: completedCount,
                      total: ONBOARDING_ACTION_IDS.length,
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChecklistOpen(false)}
                  aria-label={t("onboarding.closeChecklist")}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#21C7F3]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <ol className="mt-4 space-y-2">
                {STEP_KEYS.map(([actionId, labelKey]) => {
                  const complete = state.completedActions[actionId];
                  return (
                    <li
                      key={actionId}
                      className="flex items-center gap-2 text-xs text-slate-300"
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
                      <span>{t(labelKey)}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : (
            <button
              type="button"
              onClick={() => setChecklistOpen(true)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-[#21C7F3]/30 bg-[#07111F] px-4 py-3 text-start text-sm font-semibold text-white shadow-xl transition hover:bg-[#101D34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#21C7F3]"
            >
              <span>
                {t("onboarding.continueSetup")} ·{" "}
                {t("onboarding.progress", {
                  completed: completedCount,
                  total: ONBOARDING_ACTION_IDS.length,
                })}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      ) : null}
    </OnboardingContext.Provider>
  );
}

export function OnboardingHelpSection({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const onboarding = useOnboarding();
  const t = useTranslations();

  if (!onboarding) return null;

  const { state, completedCount, continueGuidedSetup, restartTour } = onboarding;
  const projectBase = state.lastProjectId
    ? `/projects/${encodeURIComponent(state.lastProjectId)}`
    : null;

  const tutorials: ReadonlyArray<{
    labelKey: TranslationKey;
    href: string;
  }> = [
    { labelKey: "onboarding.tutorialGettingStarted", href: "/dashboard" },
    { labelKey: "onboarding.tutorialCreateProject", href: "/projects/new" },
    {
      labelKey: "onboarding.tutorialUploadDrawings",
      href: projectBase ? `${projectBase}/drawings` : "/projects",
    },
    {
      labelKey: "onboarding.tutorialExtractionTakeoff",
      href: projectBase ? `${projectBase}/files` : "/projects",
    },
    {
      labelKey: "onboarding.tutorialBoqGeneration",
      href: projectBase ? `${projectBase}/boq` : "/projects",
    },
    {
      labelKey: "onboarding.tutorialReviewEditing",
      href: projectBase ? `${projectBase}/extractions` : "/projects",
    },
    {
      labelKey: "onboarding.tutorialPackagesCatalogue",
      href: "/catalogue",
    },
    {
      labelKey: "onboarding.tutorialExportBoq",
      href: projectBase ? `${projectBase}/documents` : "/projects",
    },
  ];

  return (
    <section aria-labelledby="quantara-help-tutorials-title" className="mt-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-blue-50 text-blue-600 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 id="quantara-help-tutorials-title" className="font-bold">
            {t("onboarding.helpTutorials")}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("onboarding.helpTutorialsDescription")}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#20304D] dark:bg-[#030508]">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold">
            {t("onboarding.gettingStarted")}
          </span>
          <span className="text-blue-600 dark:text-[#21C7F3]">
            {t("onboarding.progress", {
              completed: completedCount,
              total: ONBOARDING_ACTION_IDS.length,
            })}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-[#17253D]">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] motion-reduce:transition-none dark:bg-[#21C7F3]"
            style={{
              width: `${Math.round(
                (completedCount / ONBOARDING_ACTION_IDS.length) * 100,
              )}%`,
            }}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              continueGuidedSetup();
              onRequestClose();
            }}
            className="min-h-11 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-start text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3] dark:hover:bg-[#21C7F3]/15"
          >
            {t("onboarding.continueGuidedSetup")}
          </button>
          <button
            type="button"
            onClick={() => {
              restartTour();
              onRequestClose();
            }}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-start text-xs font-semibold hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#20304D] dark:hover:bg-[#101D34]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("onboarding.restartTour")}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {t("onboarding.restartNote")}
        </p>
      </div>

      <nav
        aria-label={t("onboarding.helpTutorials")}
        className="mt-3 grid gap-1"
      >
        {tutorials.map((item) => (
          <Link
            key={item.labelKey}
            href={item.href}
            onClick={onRequestClose}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-[#101D34]"
          >
            <span>{t(item.labelKey)}</span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-slate-400 rtl:-scale-x-100"
              aria-hidden="true"
            />
          </Link>
        ))}

        {([
          "onboarding.videoTutorials",
          "onboarding.faq",
        ] as const satisfies readonly TranslationKey[]).map((labelKey) => (
          <div
            key={labelKey}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400"
          >
            <span>{t(labelKey)}</span>
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide dark:border-[#20304D]">
              {t("onboarding.comingSoon")}
            </span>
          </div>
        ))}
      </nav>
    </section>
  );
}
