/**
 * File extensions supported by the structured table-extraction engine.
 *
 * Side-effect free by design. Read-only services may import this file
 * without registering handlers or loading the PDF/native rendering runtime.
 */
export const TABLE_EXTRACTABLE_EXTENSIONS = ["csv", "xlsx", "pdf"] as const;
