import type {
  CanonicalDocumentData,
  DocumentBOQItemData,
  DocumentBOQSectionData,
  DocumentFurnitureItemData,
} from "./build-document-data";
import {
  formatFurnitureJoineryQuantity,
  furnitureJoineryQuantityNumberFormat,
} from "@/lib/furniture/linear-edge-format";
import { readStrictFurnitureManagedKey } from "@/lib/furniture/types";

const MANAGED_MARKER_PREFIX = "[FJC_MANAGED_V1:";

/**
 * Every renderer calls this selector. Existing industries retain their BOQ
 * sections unchanged; only the existing Joinery industry switches to the
 * normalized five-section payload built upstream.
 */
export function getDocumentOutputSections(data: CanonicalDocumentData): readonly DocumentBOQSectionData[] {
  return data.furniture?.sections ?? data.boq.sections;
}

export function shouldRenderDocumentSection(
  data: CanonicalDocumentData,
  section: Pick<DocumentBOQSectionData, "items">,
): boolean {
  return Boolean(data.furniture) || section.items.length > 0;
}

export function shouldRenderSpecification(data: CanonicalDocumentData, configured: boolean): boolean {
  return Boolean(data.furniture) || configured;
}

export function getDocumentItemQuantity(
  data: CanonicalDocumentData,
  item: DocumentBOQItemData,
): string {
  if (!data.furniture) {
    return item.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return formatFurnitureJoineryQuantity(item as DocumentFurnitureItemData);
}

export function getDocumentItemQuantityNumberFormat(
  data: CanonicalDocumentData,
  item: DocumentBOQItemData,
): "0.000" | null {
  if (!data.furniture) return null;
  return furnitureJoineryQuantityNumberFormat(item as DocumentFurnitureItemData);
}

function visibleManagedText(value: string): string {
  if (!value.startsWith(MANAGED_MARKER_PREFIX)) return value;
  const markerEnd = value.indexOf("]");
  return markerEnd < 0 ? "" : value.slice(markerEnd + 1).trim();
}

function isStrictManagedItem(item: DocumentBOQItemData): boolean {
  const furnitureItem = item as DocumentFurnitureItemData;
  return readStrictFurnitureManagedKey({
    itemCode: furnitureItem.itemCode,
    sourceReference: furnitureItem.sourceReference,
    notes: furnitureItem.notes,
  }) !== null;
}

export function getDocumentItemNotes(
  data: CanonicalDocumentData,
  item: DocumentBOQItemData,
): string {
  return data.furniture && isStrictManagedItem(item) ? visibleManagedText(item.notes) : item.notes;
}

/**
 * Furniture evidence is carried in the same display string in every format.
 * Internal managed-row markers are deliberately removed, while the human
 * source reference, drawing reference, confidence, notes, and source-cell
 * audit text remain visible for professional verification.
 */
export function getDocumentItemSpecification(
  data: CanonicalDocumentData,
  item: DocumentBOQItemData,
): string {
  if (!data.furniture) return item.specification;

  const furnitureItem = item as DocumentFurnitureItemData;
  const sourceReference = isStrictManagedItem(item)
    ? visibleManagedText(furnitureItem.sourceReference)
    : furnitureItem.sourceReference;
  const notes = getDocumentItemNotes(data, item);
  const evidence = [
    sourceReference ? `Source: ${sourceReference}` : "",
    furnitureItem.drawingReference ? `Drawing: ${furnitureItem.drawingReference}` : "",
    Number.isFinite(furnitureItem.confidenceScore) ? `Confidence: ${furnitureItem.confidenceScore}%` : "",
    notes ? `Evidence / notes: ${notes}` : "",
  ].filter(Boolean);

  return [item.specification, ...evidence].filter(Boolean).join("\n");
}
