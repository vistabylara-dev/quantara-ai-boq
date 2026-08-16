export const AI_DRAFT_SOURCE_STATUSES = [
  "EXTRACTED",
  "NEEDS_REVIEW",
  "CONFIRMED",
  "CORRECTED",
] as const;

export type AiDraftCandidate = {
  id: string;
  entityType: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  sourceText?: string | null;
  status: string;
};

export type AiDraftSection = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
};

const AI_DRAFT_STATUS_SET = new Set<string>(AI_DRAFT_SOURCE_STATUSES);

const STOP_WORDS = new Set([
  "and",
  "boq",
  "for",
  "general",
  "item",
  "items",
  "of",
  "section",
  "schedule",
  "the",
  "work",
  "works",
]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function isAiDraftCandidateUsable(entity: AiDraftCandidate): boolean {
  return (
    AI_DRAFT_STATUS_SET.has(entity.status.trim().toUpperCase())
    && entity.label.trim().length > 0
    && entity.quantity !== null
    && Number.isFinite(entity.quantity)
    && entity.quantity > 0
    && Boolean(entity.unit?.trim())
  );
}

export function summarizeAiDraftCandidates(entities: readonly AiDraftCandidate[]) {
  const sourceCandidates = entities.filter((entity) =>
    AI_DRAFT_STATUS_SET.has(entity.status.trim().toUpperCase()),
  );
  const eligibleCount = sourceCandidates.filter(isAiDraftCandidateUsable).length;

  return {
    eligibleCount,
    skippedCount: sourceCandidates.length - eligibleCount,
    ignoredFinalizedCount: entities.length - sourceCandidates.length,
  };
}

export function formatAiDraftCategory(entityType: string): string {
  return entityType
    .trim()
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Extracted Item";
}

export function chooseAiDraftSection(
  sections: readonly AiDraftSection[],
  entity: Pick<AiDraftCandidate, "entityType" | "label" | "sourceText">,
): string | null {
  if (sections.length === 0) return null;

  const entityTokens = new Set(tokens(
    `${entity.entityType} ${entity.label} ${entity.sourceText ?? ""}`,
  ));

  let bestSectionId: string | null = null;
  let bestScore = 0;

  for (const section of sections) {
    const sectionTokens = new Set(tokens(
      `${section.code} ${section.title} ${section.description ?? ""}`,
    ));
    let score = 0;

    for (const token of entityTokens) {
      if (sectionTokens.has(token)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSectionId = section.id;
    }
  }

  return bestScore > 0 ? bestSectionId : null;
}
