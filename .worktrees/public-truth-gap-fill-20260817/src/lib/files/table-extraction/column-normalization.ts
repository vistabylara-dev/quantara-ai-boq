/**
 * Maps common header text variants onto the canonical column keys listed in
 * spec section 11 ("required extraction fields where applicable"). Headers
 * that don't match a known synonym keep their own slugified key rather than
 * being forced into this list — real schedules have many column names this
 * project doesn't need to understand structurally.
 */
const SYNONYMS: Record<string, string> = {
  section: "section",
  "parent element": "parent_element",
  element: "parent_element",
  "item code": "item_code",
  "item no": "item_code",
  "item no.": "item_code",
  code: "item_code",
  description: "description",
  desc: "description",
  specification: "specification",
  spec: "specification",
  quantity: "quantity",
  qty: "quantity",
  unit: "unit",
  uom: "unit",
  rate: "rate",
  "unit rate": "rate",
  price: "rate",
  total: "total",
  amount: "total",
  manufacturer: "manufacturer",
  mfr: "manufacturer",
  brand: "brand",
  model: "model",
  room: "room",
  level: "level",
  floor: "level",
  diameter: "diameter",
  dia: "diameter",
  size: "size",
  "drawing reference": "drawing_reference",
  "drawing ref": "drawing_reference",
  drawing: "drawing_reference",
  page: "page",
  sheet: "sheet",
  "source cell": "source_cell",
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

export function normalizeColumnKey(header: string, fallbackIndex: number): string {
  const trimmed = header.trim().toLowerCase();
  if (trimmed in SYNONYMS) return SYNONYMS[trimmed];
  const slug = slugify(header);
  return slug || `column_${fallbackIndex + 1}`;
}
