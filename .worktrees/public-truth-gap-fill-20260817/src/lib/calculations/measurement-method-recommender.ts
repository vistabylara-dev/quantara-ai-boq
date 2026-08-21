import { QuantityCalculationType } from "@prisma/client";
import { getRequiredDimensions } from "@/lib/calculations/required-dimensions-registry";

export const MEASUREMENT_METHOD_SUGGESTION_MARKER =
  "MEASUREMENT_METHOD_SUGGESTION" as const;

export type MeasurementMethodFamily =
  | "COUNT"
  | "LENGTH"
  | "AREA"
  | "VOLUME"
  | "WEIGHT";

export type MeasurementMethodRecommendation = {
  calculationType: QuantityCalculationType;
  methodFamily: MeasurementMethodFamily;
  label: string;
  resultUnit: string;
  confidence: number;
  reason: string;
};

export type MeasurementMethodInput = {
  entityType?: string | null;
  label: string;
  sourceText?: string | null;
  unit?: string | null;
};

const COUNTABLE_ENTITY_TYPES = new Set([
  "DOOR",
  "WINDOW",
  "FURNITURE",
  "EQUIPMENT",
]);

const COUNT_UNITS = new Set([
  "nr",
  "no",
  "nos",
  "ea",
  "each",
  "pc",
  "pcs",
  "piece",
  "pieces",
  "item",
  "items",
]);

const STRUCTURAL_TYPE_LABEL =
  /^(?:F\d+\*?|STB\d+|TB\d+|B\d+|CB|C\d+)$/i;

const DISCRETE_COUNT_LABEL =
  /\b(?:doors?|windows?|diffusers?|grilles?|sprinklers?(?: heads?)?|sockets?|switch(?:es)?|luminaires?|light fixtures?|light fittings?|fcus?|ahus?|pumps?|fans?|valves?|basins?|toilets?|wcs?)\b/i;

function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export function isCountLikeUnit(
  unit: string | null | undefined,
): boolean {
  return COUNT_UNITS.has(normalizeUnit(unit));
}

export function isCountableEntityType(
  entityType: string | null | undefined,
): boolean {
  return COUNTABLE_ENTITY_TYPES.has(
    (entityType ?? "").trim().toUpperCase(),
  );
}

function familyFromResultUnit(resultUnit: string): MeasurementMethodFamily {
  const normalized = resultUnit.trim().toLowerCase();

  if (normalized === "nr") return "COUNT";
  if (normalized === "m") return "LENGTH";
  if (normalized === "m2") return "AREA";
  if (normalized === "m3") return "VOLUME";
  if (normalized === "kg") return "WEIGHT";

  throw new Error(
    `Unsupported guided measurement result unit "${resultUnit}".`,
  );
}

function recommendation(
  calculationType: QuantityCalculationType,
  confidence: number,
  reason: string,
): MeasurementMethodRecommendation | null {
  const definition = getRequiredDimensions(calculationType);
  if (!definition) return null;

  return {
    calculationType,
    methodFamily: familyFromResultUnit(definition.resultUnit),
    label: definition.label,
    resultUnit: definition.resultUnit,
    confidence,
    reason,
  };
}

export function recommendMeasurementMethod(
  input: MeasurementMethodInput,
): MeasurementMethodRecommendation | null {
  const label = input.label.trim();
  if (!label) return null;

  const semanticText =
    `${label}\n${input.sourceText ?? ""}`.toLowerCase();

  // A structural schedule type represents occurrences of that TYPE.
  // Do not silently reinterpret F1/B1/etc. as concrete volume.
  if (STRUCTURAL_TYPE_LABEL.test(label)) {
    return recommendation(
      QuantityCalculationType.COUNT,
      96,
      "The extracted label is a structural type that is measured by occurrence count.",
    );
  }

  if (isCountableEntityType(input.entityType)) {
    return recommendation(
      QuantityCalculationType.COUNT,
      96,
      "The extracted entity type is a discrete countable item.",
    );
  }

  if (isCountLikeUnit(input.unit)) {
    return recommendation(
      QuantityCalculationType.COUNT,
      94,
      "The extracted unit is an explicit count unit.",
    );
  }

  if (DISCRETE_COUNT_LABEL.test(label)) {
    return recommendation(
      QuantityCalculationType.COUNT,
      88,
      "The BOQ item description identifies a discrete installed item.",
    );
  }

  // Specific construction operations come before broader material terms.
  if (/\b(?:formwork|shuttering)\b/i.test(semanticText)) {
    return recommendation(
      QuantityCalculationType.FORMWORK_AREA,
      94,
      "The item describes formwork/shuttering, which is measured by exposed area.",
    );
  }

  if (
    /\b(?:reinforcement|rebar|reinforcing steel|steel reinforcement)\b/i
      .test(semanticText)
  ) {
    return recommendation(
      QuantityCalculationType.REINFORCEMENT_WEIGHT,
      94,
      "The item describes reinforcement steel, which is measured by weight.",
    );
  }

  if (/\b(?:excavat\w*|earthwork)\b/i.test(semanticText)) {
    return recommendation(
      QuantityCalculationType.EXCAVATION_VOLUME,
      93,
      "The item describes excavation/earthwork, which is measured by volume.",
    );
  }

  if (/\b(?:skirtings?|baseboards?)\b/i.test(semanticText)) {
    return recommendation(
      QuantityCalculationType.SKIRTING_LENGTH,
      94,
      "The item describes skirting, which is measured by linear length.",
    );
  }

  if (
    /\b(?:ductwork|air ducts?|supply ducts?|return ducts?|exhaust ducts?)\b/i
      .test(semanticText)
  ) {
    return recommendation(
      QuantityCalculationType.DUCT_SURFACE_AREA,
      92,
      "The item describes ductwork, which uses the existing duct surface-area calculator.",
    );
  }

  if (
    /\b(?:pipes?|piping|pipework)\b/i.test(semanticText)
    && !/\b(?:fittings?|elbows?|tees?|valves?|couplings?|flanges?)\b/i.test(label)
  ) {
    return recommendation(
      QuantityCalculationType.PIPE_LENGTH,
      92,
      "The item describes a pipe run, which is measured by verified route length.",
    );
  }

  if (
    /\bcables?\b/i.test(semanticText)
    && !/\b(?:cable trays?|cable ladders?|cable glands?|cable lugs?)\b/i.test(label)
  ) {
    return recommendation(
      QuantityCalculationType.CABLE_LENGTH,
      92,
      "The item describes a cable run, which is measured by route length.",
    );
  }

  if (
    /\b(?:partitions?|drywall|gypsum partitions?)\b/i.test(semanticText)
  ) {
    return recommendation(
      QuantityCalculationType.PARTITION_AREA,
      92,
      "The item describes a partition system, which is measured by area.",
    );
  }

  if (/\b(?:paint|painting|emulsion)\b/i.test(semanticText)) {
    return recommendation(
      QuantityCalculationType.PAINT_AREA,
      92,
      "The item describes painting work, which is measured by paintable area.",
    );
  }

  if (
    /\b(?:false ceilings?|ceiling tiles?|ceiling finishes?|ceilings?)\b/i
      .test(semanticText)
  ) {
    return recommendation(
      QuantityCalculationType.CEILING_AREA,
      90,
      "The item describes ceiling work, which is measured by area.",
    );
  }

  if (
    /\b(?:floor tiles?|flooring|floor finishes?|vinyl flooring|carpet|floor screeds?)\b/i
      .test(semanticText)
  ) {
    return recommendation(
      QuantityCalculationType.FLOOR_AREA,
      90,
      "The item describes a floor finish/work item, which is measured by floor area.",
    );
  }

  if (
    /\b(?:wall tiles?|wall finishes?|wall cladding|wall plaster|wall render)\b/i
      .test(semanticText)
  ) {
    return recommendation(
      QuantityCalculationType.WALL_AREA,
      90,
      "The item describes a wall finish/work item, which is measured by wall area.",
    );
  }

  if (
    /\b(?:concrete|r\.?\s*c\.?\s*c\.?|rcc|reinforced concrete|pcc|blinding)\b/i
      .test(semanticText)
  ) {
    return recommendation(
      QuantityCalculationType.CONCRETE_VOLUME,
      90,
      "The item describes concrete work, which is measured by volume.",
    );
  }

  return null;
}

export function formatMeasurementMethodSuggestionMarker(
  value: MeasurementMethodRecommendation,
): string {
  return [
    MEASUREMENT_METHOD_SUGGESTION_MARKER,
    value.calculationType,
    value.confidence,
  ].join(":");
}
