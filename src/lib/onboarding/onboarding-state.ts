export const ONBOARDING_VERSION = 1 as const;

export const ONBOARDING_ACTION_IDS = [
  "PROJECT_CREATED",
  "SOURCE_ADDED",
  "SOURCE_PROCESSED",
  "EXTRACTION_REVIEWED",
  "BOQ_PREPARED",
  "VALIDATION_COMPLETED",
  "OUTPUT_GENERATED",
] as const;

export type OnboardingActionId = (typeof ONBOARDING_ACTION_IDS)[number];

export type OnboardingActionMap = Record<OnboardingActionId, boolean>;

export type OnboardingState = {
  version: typeof ONBOARDING_VERSION;
  welcomeSeen: boolean;
  tourActive: boolean;
  tourReplay: boolean;
  completedActions: OnboardingActionMap;
  lastProjectId: string | null;
  updatedAt: string;
};

export type OnboardingDashboardMetrics = {
  activeProjects: number;
  totalUploadedFiles: number;
  totalBoqs: number;
  totalGeneratedDocuments: number;
};

export type OnboardingActionOptions = {
  projectId?: string | null;
};

export type OnboardingActionEventDetail = OnboardingActionOptions & {
  actionId: OnboardingActionId;
};

export const ONBOARDING_EVENT_NAME = "quantara:onboarding-action-complete" as const;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function emptyActionMap(): OnboardingActionMap {
  return Object.fromEntries(
    ONBOARDING_ACTION_IDS.map((actionId) => [actionId, false]),
  ) as OnboardingActionMap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProjectId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function positiveCount(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isOnboardingActionId(value: unknown): value is OnboardingActionId {
  return typeof value === "string"
    && ONBOARDING_ACTION_IDS.includes(value as OnboardingActionId);
}

export function getOnboardingStorageKey(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new Error("Authenticated user id is required for onboarding storage.");
  }
  return `quantara:onboarding:v${ONBOARDING_VERSION}:${normalized}`;
}

export function createEmptyOnboardingState(updatedAt = nowIso()): OnboardingState {
  return {
    version: ONBOARDING_VERSION,
    welcomeSeen: false,
    tourActive: false,
    tourReplay: false,
    completedActions: emptyActionMap(),
    lastProjectId: null,
    updatedAt,
  };
}

export function parseOnboardingState(
  raw: string | null,
  fallbackUpdatedAt = nowIso(),
): OnboardingState | null {
  if (!raw) return null;

  try {
    const candidate: unknown = JSON.parse(raw);
    if (!isRecord(candidate) || candidate.version !== ONBOARDING_VERSION) {
      return null;
    }

    const rawActions = isRecord(candidate.completedActions)
      ? candidate.completedActions
      : {};
    const completedActions = emptyActionMap();

    for (const actionId of ONBOARDING_ACTION_IDS) {
      completedActions[actionId] = rawActions[actionId] === true;
    }

    return {
      version: ONBOARDING_VERSION,
      welcomeSeen: candidate.welcomeSeen === true,
      tourActive: candidate.tourActive === true,
      tourReplay: candidate.tourReplay === true,
      completedActions,
      lastProjectId: normalizeProjectId(candidate.lastProjectId),
      updatedAt:
        typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
          ? candidate.updatedAt
          : fallbackUpdatedAt,
    };
  } catch {
    return null;
  }
}

export function readOnboardingState(
  storage: StorageLike,
  userId: string,
): OnboardingState | null {
  try {
    return parseOnboardingState(storage.getItem(getOnboardingStorageKey(userId)));
  } catch {
    return null;
  }
}

export function writeOnboardingState(
  storage: StorageLike,
  userId: string,
  state: OnboardingState,
): void {
  try {
    storage.setItem(getOnboardingStorageKey(userId), JSON.stringify(state));
  } catch {
    // UI-only preference persistence must never break the SaaS.
  }
}

export function countCompletedOnboardingActions(state: OnboardingState): number {
  return ONBOARDING_ACTION_IDS.reduce(
    (count, actionId) => count + (state.completedActions[actionId] ? 1 : 0),
    0,
  );
}

export function seedOnboardingFromMetrics(
  state: OnboardingState,
  metrics: OnboardingDashboardMetrics,
  updatedAt = nowIso(),
): { state: OnboardingState; established: boolean } {
  const seeded = { ...state.completedActions };

  if (positiveCount(metrics.activeProjects)) seeded.PROJECT_CREATED = true;
  if (positiveCount(metrics.totalUploadedFiles)) seeded.SOURCE_ADDED = true;
  if (positiveCount(metrics.totalBoqs)) seeded.BOQ_PREPARED = true;
  if (positiveCount(metrics.totalGeneratedDocuments)) seeded.OUTPUT_GENERATED = true;

  const established =
    positiveCount(metrics.activeProjects)
    || positiveCount(metrics.totalUploadedFiles)
    || positiveCount(metrics.totalBoqs)
    || positiveCount(metrics.totalGeneratedDocuments);

  const changed = ONBOARDING_ACTION_IDS.some(
    (actionId) => seeded[actionId] !== state.completedActions[actionId],
  );

  if (!changed) {
    return { state, established };
  }

  return {
    established,
    state: {
      ...state,
      completedActions: seeded,
      updatedAt,
    },
  };
}

export function createInitialOnboardingState(
  metrics: OnboardingDashboardMetrics,
  updatedAt = nowIso(),
): OnboardingState {
  const empty = createEmptyOnboardingState(updatedAt);
  const seeded = seedOnboardingFromMetrics(empty, metrics, updatedAt);

  return {
    ...seeded.state,
    welcomeSeen: seeded.established,
    tourActive: false,
    tourReplay: false,
    updatedAt,
  };
}

export function completeOnboardingAction(
  state: OnboardingState,
  actionId: OnboardingActionId,
  options: OnboardingActionOptions = {},
  updatedAt = nowIso(),
): OnboardingState {
  const projectId = normalizeProjectId(options.projectId);
  const projectChanged = Boolean(projectId && projectId !== state.lastProjectId);

  if (state.completedActions[actionId] && !projectChanged) {
    return state;
  }

  const completedActions = {
    ...state.completedActions,
    [actionId]: true,
  };

  const completedCount = ONBOARDING_ACTION_IDS.reduce(
    (count, id) => count + (completedActions[id] ? 1 : 0),
    0,
  );

  return {
    ...state,
    welcomeSeen: true,
    tourActive: state.tourReplay
      || (completedCount < ONBOARDING_ACTION_IDS.length && state.tourActive),
    completedActions,
    lastProjectId: projectId ?? state.lastProjectId,
    updatedAt,
  };
}

export function continueOnboardingGuidance(
  state: OnboardingState,
  updatedAt = nowIso(),
): OnboardingState {
  return {
    ...state,
    welcomeSeen: true,
    tourActive: state.tourReplay
      || countCompletedOnboardingActions(state) < ONBOARDING_ACTION_IDS.length,
    updatedAt,
  };
}

export function dismissOnboardingGuidance(
  state: OnboardingState,
  updatedAt = nowIso(),
): OnboardingState {
  return {
    ...state,
    welcomeSeen: true,
    tourActive: false,
    tourReplay: false,
    updatedAt,
  };
}

export function restartOnboardingGuidance(
  state: OnboardingState,
  updatedAt = nowIso(),
): OnboardingState {
  return {
    ...state,
    welcomeSeen: false,
    tourActive: true,
    tourReplay: true,
    updatedAt,
  };
}

export function emitOnboardingActionComplete(
  actionId: OnboardingActionId,
  options: OnboardingActionOptions = {},
): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<OnboardingActionEventDetail>(ONBOARDING_EVENT_NAME, {
      detail: {
        actionId,
        projectId: normalizeProjectId(options.projectId),
      },
    }),
  );
}
