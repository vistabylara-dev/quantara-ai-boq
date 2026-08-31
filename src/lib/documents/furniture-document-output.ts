import type {
  CanonicalDocumentData,
  DocumentBOQItemData,
  DocumentBOQSectionData,
  DocumentFurnitureItemData,
} from "./build-document-data";

const MANAGED_MARKER_PREFIX = "[FJC_MANAGED_V1:";

/**
 * Every renderer calls this selector. Existing industries retain their BOQ
 * sections unchanged; only the exact combined furniture industry switches to
 * the normalized five-section payload built upstream.
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

function visibleSourceReference(sourceReference: string): string {
  if (!sourceReference.startsWith(MANAGED_MARKER_PREFIX)) return sourceReference;
  const markerEnd = sourceReference.indexOf("]");
  return markerEnd < 0 ? "" : sourceReference.slice(markerEnd + 1).trim();
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
  const sourceReference = visibleSourceReference(furnitureItem.sourceReference);
  const evidence = [
    sourceReference ? `Source: ${sourceReference}` : "",
    furnitureItem.drawingReference ? `Drawing: ${furnitureItem.drawingReference}` : "",
    Number.isFinite(furnitureItem.confidenceScore) ? `Confidence: ${furnitureItem.confidenceScore}%` : "",
    furnitureItem.notes ? `Evidence / notes: ${furnitureItem.notes}` : "",
  ].filter(Boolean);

  return [item.specification, ...evidence].filter(Boolean).join("\n");
}
