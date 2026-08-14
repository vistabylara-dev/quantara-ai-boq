/**
 * TAYQAN-1 — the one canonical place a worker's presented identity is
 * defined. Every UI surface (hire card, assignment header, future worker
 * catalogue) reads from this registry instead of hard-coding TAYQAN's name/
 * title/capabilities independently. Shaped so a second worker can be added
 * later without redesigning this type — Phase 1 deliberately registers only
 * `tayqan`.
 *
 * `name` is the brand ("TAYQAN") and is intentionally never translated, the
 * same way `common.appName` ("Quantara") stays identical in both locales
 * (see the allowed-identical list in tests/i18n-dictionary-parity.test.ts).
 * Every other presented string is a dictionary key, not English prose — this
 * file must stay usable from both English and Arabic UI without the caller
 * reaching into the dictionary independently, so `titleKey` and
 * `capabilityKeys` are always resolved through `t()` by the caller.
 */

export type WorkerDefinitionStatus = "AVAILABLE" | "COMING_SOON";

/** Mirrors the Prisma WorkerAssignmentType enum's string values without importing @prisma/client — this file must stay safe to import from client components. */
export type WorkerAssignmentTypeKey = "REVIEW_EXISTING_BOQ";

export type WorkerDefinition = {
  key: string;
  name: string;
  /** Dot-path into the i18n dictionary for the role/title shown under the brand name, e.g. "tayqan.roleTitle" — resolve with t(). */
  titleKey: string;
  /** Semantic capability IDs shown on the hire card. Resolve each with t(`tayqan.capabilities.${id}`) — never render an id directly. Must stay in sync with what is actually implemented; never list an unimplemented capability. */
  capabilityKeys: readonly string[];
  supportedAssignmentTypes: readonly WorkerAssignmentTypeKey[];
  status: WorkerDefinitionStatus;
};

export const TAYQAN_WORKER_DEFINITION: WorkerDefinition = {
  key: "tayqan",
  name: "TAYQAN",
  titleKey: "tayqan.roleTitle",
  capabilityKeys: [
    "reviewExistingBoq",
    "quantityProvenance",
    "rateProvenance",
    "verificationIssues",
    "revisionEvidence",
    "materialQuestions",
    "qaFindings",
  ],
  supportedAssignmentTypes: ["REVIEW_EXISTING_BOQ"],
  status: "AVAILABLE",
};

const WORKER_DEFINITIONS_BY_KEY: Readonly<Record<string, WorkerDefinition>> = {
  [TAYQAN_WORKER_DEFINITION.key]: TAYQAN_WORKER_DEFINITION,
};

export function getWorkerDefinition(key: string): WorkerDefinition | null {
  return WORKER_DEFINITIONS_BY_KEY[key] ?? null;
}

export function listWorkerDefinitions(): readonly WorkerDefinition[] {
  return Object.values(WORKER_DEFINITIONS_BY_KEY);
}
