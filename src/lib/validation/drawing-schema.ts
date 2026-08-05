import { z } from "zod";

/** Tonight's supported drawing upload formats — a narrower, drawing-specific subset of the general project-files allowlist in file-security.ts. */
export const DRAWING_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "tif", "tiff", "dwg", "dxf", "ifc", "rvt", "zip"] as const;

/** Formats the browser can safely render inline tonight. Everything else gets a metadata card + secure download, never a fake preview. */
export const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "tif", "tiff"]);

export function isDrawingExtensionPreviewable(extension: string): boolean {
  return PREVIEWABLE_EXTENSIONS.has(extension.toLowerCase());
}

/**
 * CORE-FLOW-1 — the single source of truth for the drawing upload size
 * limit. This constant (imported by both the client upload UI and the
 * server) is the safe default; the server additionally honors
 * DRAWING_UPLOAD_MAX_BYTES if set (see resolveDrawingUploadMaxBytes in
 * drawing-service.ts) — the client never re-derives its own number, and
 * the server is the only place that actually enforces it. Never duplicate
 * this value elsewhere.
 */
export const DRAWING_UPLOAD_MAX_BYTES_DEFAULT = 250 * 1024 * 1024;

export const DRAWING_DISCIPLINES = [
  "ARCHITECTURAL",
  "STRUCTURAL",
  "MECHANICAL",
  "ELECTRICAL",
  "PLUMBING",
  "FIRE_FIGHTING",
  "FIRE_ALARM",
  "ELV",
  "CIVIL",
  "LANDSCAPE",
  "INTERIOR_DESIGN",
  "OTHER",
] as const;

export const DRAWING_TYPES = [
  "FLOOR_PLAN",
  "REFLECTED_CEILING_PLAN",
  "ELEVATION",
  "SECTION",
  "DETAIL",
  "SCHEMATIC",
  "SINGLE_LINE_DIAGRAM",
  "RISER_DIAGRAM",
  "LAYOUT",
  "COORDINATION_DRAWING",
  "AS_BUILT",
  "SHOP_DRAWING",
  "TENDER_DRAWING",
  "IFC_DRAWING",
  "OTHER",
] as const;

export type DrawingDiscipline = (typeof DRAWING_DISCIPLINES)[number];
export type DrawingType = (typeof DRAWING_TYPES)[number];

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Every field is optional and only ever comes from the user's explicit form input — never inferred from the uploaded file's name. */
export const drawingMetadataSchema = z.object({
  discipline: z.enum(DRAWING_DISCIPLINES).optional(),
  drawingType: z.enum(DRAWING_TYPES).optional(),
  drawingNumber: optionalTrimmedString(100),
  title: optionalTrimmedString(200),
  revision: optionalTrimmedString(50),
  issueDate: optionalTrimmedString(50),
  scale: optionalTrimmedString(50),
  sheetNumber: optionalTrimmedString(50),
  preparedBy: optionalTrimmedString(150),
  checkedBy: optionalTrimmedString(150),
  approvedBy: optionalTrimmedString(150),
  notes: optionalTrimmedString(2000),
});

export type DrawingMetadataInput = z.infer<typeof drawingMetadataSchema>;
