/**
 * TAYQAN-1 — the one canonical place a worker's presented identity is
 * defined. Every UI surface (hire card, assignment header, future worker
 * catalogue) reads from this registry instead of hard-coding TAYQAN's name/
 * title/capabilities independently. Shaped so a second worker can be added
 * later without redesigning this type — Phase 1 deliberately registers only
 * `tayqan`.
 */

export type WorkerDefinitionStatus = "AVAILABLE" | "COMING_SOON";

/** Mirrors the Prisma WorkerAssignmentType enum's string values without importing @prisma/client — this file must stay safe to import from client components. */
export type WorkerAssignmentTypeKey = "REVIEW_EXISTING_BOQ";

export type WorkerDefinition = {
  key: string;
  name: string;
  title: string;
  description: string;
  /** Human-readable capability statements shown on the hire card — must stay in sync with what is actually implemented; never list an unimplemented capability. */
  capabilities: readonly string[];
  supportedAssignmentTypes: readonly WorkerAssignmentTypeKey[];
  status: WorkerDefinitionStatus;
};

export const TAYQAN_WORKER_DEFINITION: WorkerDefinition = {
  key: "tayqan",
  name: "TAYQAN",
  title: "AI Quantity Surveyor & Estimator",
  description:
    "A persistent AI quantity-surveying worker that reviews BOQs, evidence, quantities, rates, revisions and material uncertainties while keeping the human QS in control of governed decisions.",
  capabilities: [
    "Review existing BOQ",
    "Check quantity provenance",
    "Check rate provenance",
    "Detect unresolved verification issues",
    "Review revision evidence",
    "Ask material questions",
    "Produce governed QA findings",
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
