import { describe, expect, it } from "vitest";
import {
  ONBOARDING_VERSION,
  completeOnboardingAction,
  continueOnboardingGuidance,
  countCompletedOnboardingActions,
  createEmptyOnboardingState,
  createInitialOnboardingState,
  getOnboardingStorageKey,
  parseOnboardingState,
  restartOnboardingGuidance,
  seedOnboardingFromMetrics,
} from "@/lib/onboarding/onboarding-state";

const emptyMetrics = {
  activeProjects: 0,
  totalUploadedFiles: 0,
  totalBoqs: 0,
  totalGeneratedDocuments: 0,
};

describe("onboarding state", () => {
  it("scopes storage by version and authenticated user id", () => {
    expect(getOnboardingStorageKey("user-123")).toBe(
      `quantara:onboarding:v${ONBOARDING_VERSION}:user-123`,
    );
  });

  it("creates a genuinely empty first-run state", () => {
    const state = createEmptyOnboardingState("2026-08-16T00:00:00.000Z");

    expect(state.welcomeSeen).toBe(false);
    expect(state.tourActive).toBe(false);
    expect(countCompletedOnboardingActions(state)).toBe(0);
  });

  it("falls back safely for invalid JSON", () => {
    expect(parseOnboardingState("{not-json")).toBeNull();
  });

  it("falls back safely for an unknown version", () => {
    expect(
      parseOnboardingState(
        JSON.stringify({
          version: ONBOARDING_VERSION + 1,
          welcomeSeen: true,
        }),
      ),
    ).toBeNull();
  });

  it("seeds only factual actions from existing dashboard metrics", () => {
    const state = createInitialOnboardingState(
      {
        activeProjects: 2,
        totalUploadedFiles: 4,
        totalBoqs: 1,
        totalGeneratedDocuments: 3,
      },
      "2026-08-16T00:00:00.000Z",
    );

    expect(state.welcomeSeen).toBe(true);
    expect(state.completedActions.PROJECT_CREATED).toBe(true);
    expect(state.completedActions.SOURCE_ADDED).toBe(true);
    expect(state.completedActions.BOQ_PREPARED).toBe(true);
    expect(state.completedActions.OUTPUT_GENERATED).toBe(true);

    expect(state.completedActions.SOURCE_PROCESSED).toBe(false);
    expect(state.completedActions.EXTRACTION_REVIEWED).toBe(false);
    expect(state.completedActions.VALIDATION_COMPLETED).toBe(false);
  });

  it("does not mark an empty workspace as established", () => {
    const state = createInitialOnboardingState(
      emptyMetrics,
      "2026-08-16T00:00:00.000Z",
    );

    expect(state.welcomeSeen).toBe(false);
    expect(countCompletedOnboardingActions(state)).toBe(0);
  });

  it("never infers processing, extraction review, or validation from metrics", () => {
    const seeded = seedOnboardingFromMetrics(
      createEmptyOnboardingState("2026-08-16T00:00:00.000Z"),
      {
        activeProjects: 9,
        totalUploadedFiles: 9,
        totalBoqs: 9,
        totalGeneratedDocuments: 9,
      },
      "2026-08-16T00:00:01.000Z",
    ).state;

    expect(seeded.completedActions.SOURCE_PROCESSED).toBe(false);
    expect(seeded.completedActions.EXTRACTION_REVIEWED).toBe(false);
    expect(seeded.completedActions.VALIDATION_COMPLETED).toBe(false);
  });

  it("marks action completion idempotently", () => {
    const base = createEmptyOnboardingState("2026-08-16T00:00:00.000Z");
    const once = completeOnboardingAction(
      base,
      "PROJECT_CREATED",
      { projectId: "project-1" },
      "2026-08-16T00:00:01.000Z",
    );
    const twice = completeOnboardingAction(
      once,
      "PROJECT_CREATED",
      { projectId: "project-1" },
      "2026-08-16T00:00:02.000Z",
    );

    expect(twice).toBe(once);
    expect(countCompletedOnboardingActions(twice)).toBe(1);
    expect(twice.lastProjectId).toBe("project-1");
  });

  it("restarts guidance without erasing completed work", () => {
    const completed = completeOnboardingAction(
      createEmptyOnboardingState("2026-08-16T00:00:00.000Z"),
      "PROJECT_CREATED",
      { projectId: "project-1" },
      "2026-08-16T00:00:01.000Z",
    );

    const restarted = restartOnboardingGuidance(
      completed,
      "2026-08-16T00:00:02.000Z",
    );

    expect(restarted.welcomeSeen).toBe(false);
    expect(restarted.tourActive).toBe(true);
    expect(restarted.tourReplay).toBe(true);
    expect(restarted.completedActions.PROJECT_CREATED).toBe(true);
    expect(restarted.lastProjectId).toBe("project-1");
  });

  it("keeps a completed checklist replayable without erasing completion", () => {
    let state = createEmptyOnboardingState("2026-08-16T00:00:00.000Z");
    const actions = [
      "PROJECT_CREATED",
      "SOURCE_ADDED",
      "SOURCE_PROCESSED",
      "EXTRACTION_REVIEWED",
      "BOQ_PREPARED",
      "VALIDATION_COMPLETED",
      "OUTPUT_GENERATED",
    ] as const;

    for (const actionId of actions) {
      state = completeOnboardingAction(state, actionId);
    }

    const restarted = restartOnboardingGuidance(
      state,
      "2026-08-16T00:00:08.000Z",
    );

    const continued = continueOnboardingGuidance(
      restarted,
      "2026-08-16T00:00:09.000Z",
    );

    expect(countCompletedOnboardingActions(continued)).toBe(7);
    expect(continued.tourReplay).toBe(true);
    expect(continued.tourActive).toBe(true);
  });

  it("counts all seven completed actions correctly", () => {
    let state = createEmptyOnboardingState("2026-08-16T00:00:00.000Z");
    const actions = [
      "PROJECT_CREATED",
      "SOURCE_ADDED",
      "SOURCE_PROCESSED",
      "EXTRACTION_REVIEWED",
      "BOQ_PREPARED",
      "VALIDATION_COMPLETED",
      "OUTPUT_GENERATED",
    ] as const;

    for (const actionId of actions) {
      state = completeOnboardingAction(state, actionId);
    }

    expect(countCompletedOnboardingActions(state)).toBe(7);
    expect(state.tourActive).toBe(false);
  });
});
