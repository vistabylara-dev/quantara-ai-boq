export const FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_LABEL = "Editable assumption" as const;
export const FURNITURE_JOINERY_LINEAR_EDGE_VERIFICATION_LABEL = "Requires professional verification" as const;
export const FURNITURE_JOINERY_LINEAR_EDGE_INTERPRETATION_LABEL =
  "Based on the workbook’s selected-edge interpretation" as const;

export const FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE = [
  FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_LABEL,
  FURNITURE_JOINERY_LINEAR_EDGE_VERIFICATION_LABEL,
  FURNITURE_JOINERY_LINEAR_EDGE_INTERPRETATION_LABEL,
].map((label) => `${label}.`).join(" ");

type LinearEdgeItem = {
  description: string;
  quantity: number;
  unit: string;
  category?: string;
  sourceReference?: string;
};

const LINEAR_EDGE_DESCRIPTIONS = new Set([
  "front-edge banding length",
  "all-four-edge banding length",
]);

const MANAGED_LINEAR_EDGE_MARKER = "order%3AHARDWARE%3Aedge-banding%3A";

/**
 * Identifies only the canonical Joinery linear-edge rows. The exact managed
 * marker is preferred; the description fallback is needed by client-proposal
 * DTOs, which intentionally omit internal managed-row metadata.
 */
export function isFurnitureJoineryLinearEdgeItem(item: LinearEdgeItem): boolean {
  if (item.unit.trim().toLowerCase() !== "lm") return false;
  if (item.category && item.category !== "HARDWARE") return false;

  const managedReference = item.sourceReference ?? "";
  if (managedReference.includes(MANAGED_LINEAR_EDGE_MARKER)) return true;

  return LINEAR_EDGE_DESCRIPTIONS.has(item.description.trim().toLowerCase());
}

/** Exact presentation for canonical furniture/joinery linear-edge values. */
export function formatFurnitureJoineryLinearEdgeQuantity(quantity: number): string {
  return quantity.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

/**
 * Keeps every existing quantity format unchanged while applying the required
 * three-decimal precision to the narrow canonical linear-edge output only.
 */
export function formatFurnitureJoineryQuantity(item: LinearEdgeItem): string {
  return isFurnitureJoineryLinearEdgeItem(item)
    ? formatFurnitureJoineryLinearEdgeQuantity(item.quantity)
    : item.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function furnitureJoineryQuantityNumberFormat(item: LinearEdgeItem): "0.000" | null {
  return isFurnitureJoineryLinearEdgeItem(item) ? "0.000" : null;
}
