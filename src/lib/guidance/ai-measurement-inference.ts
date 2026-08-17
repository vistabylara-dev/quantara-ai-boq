export const AI_MEASUREMENT_SUGGESTION_MARKER = "AI_MEASUREMENT_SUGGESTION" as const;

export type AiMeasurementCandidate = {
  id: string;
  entityType: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  sourceText?: string | null;
  status: string;
  technicalDataJson?: unknown;
};

export type AiMeasurementEvidencePage = {
  projectFileId: string;
  pageNumber: number;
  text: string | null;
  normalizedText?: string | null;
  drawingTitles?: readonly string[] | null;
};

export type NormalizedStructuralDimensions = {
  kind: "FOOTING" | "BEAM_SECTION";
  lengthM?: number;
  widthM?: number;
  depthM?: number;
  volumePerUnitM3?: number;
  totalVolumeM3?: number;
};

export type AiMeasurementSuggestion = {
  quantity: number;
  unit: string;
  method: "EXACT_LAYOUT_LABEL_COUNT" | "COUNTABLE_ENTITY_UNIT";
  confidence: number;
  pageNumbers: number[];
  evidenceSummary: string;
  scopeCaution: string | null;
  normalizedDimensions: NormalizedStructuralDimensions | null;
};

const COUNTABLE_ENTITY_TYPES = new Set(["DOOR", "WINDOW", "FURNITURE", "EQUIPMENT"]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function rawData(candidate: AiMeasurementCandidate): Record<string, unknown> | null {
  return record(record(candidate.technicalDataJson)?.rawData);
}

function normalizeDimensions(candidate: AiMeasurementCandidate): NormalizedStructuralDimensions | null {
  const raw = rawData(candidate);
  if (!raw) return null;

  const lengthCm = finiteNumber(raw.r_c_c_dimensions_cm_l);
  const widthCm = finiteNumber(raw.r_c_c_dimensions_cm_b);
  const depthCm = finiteNumber(raw.r_c_c_dimensions_cm_d);
  if (lengthCm !== null && widthCm !== null && depthCm !== null) {
    const lengthM = round(lengthCm / 100);
    const widthM = round(widthCm / 100);
    const depthM = round(depthCm / 100);
    return {
      kind: "FOOTING",
      lengthM,
      widthM,
      depthM,
      volumePerUnitM3: round(lengthM * widthM * depthM),
    };
  }

  const section = typeof raw.dimensions_cm === "string" ? raw.dimensions_cm.trim() : "";
  const sectionMatch = section.match(/^(\d+(?:\.\d+)?)\s*(?:[xX]|\u00D7)\s*(\d+(?:\.\d+)?)$/);
  if (sectionMatch) {
    return {
      kind: "BEAM_SECTION",
      widthM: round(Number(sectionMatch[1]) / 100),
      depthM: round(Number(sectionMatch[2]) / 100),
    };
  }

  return null;
}

function structuralLayoutNeedles(labelInput: string): string[] | null {
  const label = labelInput.trim().toUpperCase();
  if (/^F\d+\*?$/.test(label) || /^STB\d+$/.test(label)) return ["LAYOUT OF FOOTING"];
  if (/^TB\d+$/.test(label)) return ["LAYOUT OF TIE BEAM"];
  if (/^(?:B\d+|CB)$/.test(label)) return ["LAYOUT OF FIRST FLOOR SLAB", "LAYOUT OF BEAM"];
  if (/^C\d+$/.test(label)) return ["LAYOUT OF COLUMN"];
  return null;
}

function pageSearchText(page: AiMeasurementEvidencePage): string {
  const titles = page.drawingTitles?.join("\n") ?? "";
  return `${titles}\n${page.normalizedText ?? page.text ?? ""}`.toUpperCase();
}

function matchingLayoutPages(
  label: string,
  pages: readonly AiMeasurementEvidencePage[],
): AiMeasurementEvidencePage[] {
  const needles = structuralLayoutNeedles(label);
  if (!needles) return [];
  return pages.filter((page) => {
    const haystack = pageSearchText(page);
    return needles.some((needle) => haystack.includes(needle));
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countExactDrawingLabel(text: string, labelInput: string): number {
  const label = labelInput.trim().toUpperCase();
  if (!label) return 0;
  const expression = new RegExp(
    `(^|[^A-Z0-9._/-])${escapeRegExp(label)}(?=$|[^A-Z0-9*._/-])`,
    "gm",
  );
  const upper = text.toUpperCase();
  let count = 0;
  while (expression.exec(upper)) count += 1;
  return count;
}

function scopeCautionForPages(pages: readonly AiMeasurementEvidencePage[]): string | null {
  const text = pages.map(pageSearchText).join("\n");
  if (/\bMODIFICATION\b|\bEXISTING\b|\bPROPOSED\b|\bREMOVE\b|\bEX\.\b/.test(text)) {
    return "Modification/existing/proposed scope language is present on the source drawing; confirm that the counted occurrences belong to the BOQ scope.";
  }
  return null;
}

function dimensionEvidenceText(
  dimensions: NormalizedStructuralDimensions | null,
  count: number,
): string | null {
  if (!dimensions) return null;
  if (
    dimensions.kind === "FOOTING"
    && dimensions.lengthM !== undefined
    && dimensions.widthM !== undefined
    && dimensions.depthM !== undefined
    && dimensions.volumePerUnitM3 !== undefined
  ) {
    const total = round(dimensions.volumePerUnitM3 * count);
    dimensions.totalVolumeM3 = total;
    return `Schedule dimensions normalized from cm: ${dimensions.lengthM} x ${dimensions.widthM} x ${dimensions.depthM} m. Geometric volume reference: ${dimensions.volumePerUnitM3} m3 each / ${total} m3 for ${count} occurrence${count === 1 ? "" : "s"}.`;
  }
  if (
    dimensions.kind === "BEAM_SECTION"
    && dimensions.widthM !== undefined
    && dimensions.depthM !== undefined
  ) {
    return `Schedule section normalized from cm: ${dimensions.widthM} x ${dimensions.depthM} m. Segment length is not inferred by this safe path.`;
  }
  return null;
}

export function inferAiDraftMeasurement(
  candidate: AiMeasurementCandidate,
  pages: readonly AiMeasurementEvidencePage[],
): AiMeasurementSuggestion | null {
  const existingQuantity = candidate.quantity;
  const hasPositiveQuantity = existingQuantity !== null
    && Number.isFinite(existingQuantity)
    && existingQuantity > 0;
  const existingUnit = candidate.unit?.trim() ?? "";
  if (hasPositiveQuantity && existingUnit) return null;

  const entityType = candidate.entityType.trim().toUpperCase();
  const structuralNeedles = structuralLayoutNeedles(candidate.label);

  if (
    hasPositiveQuantity
    && !existingUnit
    && (COUNTABLE_ENTITY_TYPES.has(entityType) || structuralNeedles)
  ) {
    return {
      quantity: existingQuantity,
      unit: "nr",
      method: "COUNTABLE_ENTITY_UNIT",
      confidence: COUNTABLE_ENTITY_TYPES.has(entityType) ? 95 : 88,
      pageNumbers: [],
      evidenceSummary:
        `Suggested unit "nr" because ${candidate.label} is a countable `
        + `${COUNTABLE_ENTITY_TYPES.has(entityType) ? entityType.toLowerCase() : "drawing type"} `
        + "and an explicit positive quantity already exists.",
      scopeCaution: null,
      normalizedDimensions: normalizeDimensions(candidate),
    };
  }

  if (hasPositiveQuantity || !structuralNeedles) return null;

  const layoutPages = matchingLayoutPages(candidate.label, pages);
  if (layoutPages.length === 0) return null;

  const pageCounts = layoutPages
    .map((page) => ({
      pageNumber: page.pageNumber,
      count: countExactDrawingLabel(
        page.text ?? page.normalizedText ?? "",
        candidate.label,
      ),
    }))
    .filter((entry) => entry.count > 0);

  const count = pageCounts.reduce((sum, entry) => sum + entry.count, 0);
  if (count <= 0) return null;

  const scopeCaution = scopeCautionForPages(layoutPages);
  const normalizedDimensions = normalizeDimensions(candidate);
  const dimensionText = dimensionEvidenceText(normalizedDimensions, count);
  const pageNumbers = pageCounts.map((entry) => entry.pageNumber);

  const evidenceSummary = [
    `Suggested count ${count} nr from exact "${candidate.label}" type-label occurrences on layout page${pageNumbers.length === 1 ? "" : "s"} ${pageNumbers.join(", ")}.`,
    dimensionText,
    scopeCaution,
  ].filter((value): value is string => Boolean(value)).join(" ");

  return {
    quantity: count,
    unit: "nr",
    method: "EXACT_LAYOUT_LABEL_COUNT",
    confidence: scopeCaution ? 72 : 82,
    pageNumbers,
    evidenceSummary,
    scopeCaution,
    normalizedDimensions,
  };
}

export function applyAiMeasurementSuggestion<T extends AiMeasurementCandidate>(
  candidate: T,
  suggestion: AiMeasurementSuggestion | null,
): T {
  if (!suggestion) return candidate;
  const hasPositiveQuantity = candidate.quantity !== null
    && Number.isFinite(candidate.quantity)
    && candidate.quantity > 0;

  return {
    ...candidate,
    quantity: hasPositiveQuantity ? candidate.quantity : suggestion.quantity,
    unit: candidate.unit?.trim() ? candidate.unit : suggestion.unit,
  } as T;
}

export function formatAiMeasurementSuggestionMarker(
  suggestion: AiMeasurementSuggestion,
): string {
  const pagePart = suggestion.pageNumbers.length > 0
    ? `:P${suggestion.pageNumbers.join(",")}`
    : "";
  return `${AI_MEASUREMENT_SUGGESTION_MARKER}:${suggestion.method}:${suggestion.quantity}:${suggestion.unit}${pagePart}`;
}

export function hasAiMeasurementSuggestion(
  sourceReference: string | null | undefined,
): boolean {
  return Boolean(sourceReference?.includes(`${AI_MEASUREMENT_SUGGESTION_MARKER}:`));
}
