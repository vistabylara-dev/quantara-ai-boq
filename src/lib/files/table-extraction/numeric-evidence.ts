export type TableFieldEvidence = {
  fieldKey: string;
  fieldTitle: string;
  rawValue: string;
  isNumericLike: boolean;
};

export type TableNumericEvidence = TableFieldEvidence;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function humanizeFieldTitle(fieldKey: string): string {
  const words = fieldKey.trim().replace(/_/g, " ").replace(/\s+/g, " ");
  if (!words) return "Unnamed field";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function looksNumericLike(rawValue: string): boolean {
  const trimmed = rawValue.trim();
  if (!trimmed || !/\d/.test(trimmed)) return false;
  if (/^[A-Za-z]+-\d+$/i.test(trimmed)) return false;
  return /^[+-]?(?:\d|\.\d)/.test(trimmed)
    || /^\(\s*\d/.test(trimmed)
    || /\bT\d+\b/i.test(trimmed)
    || /\d+\s*T\s*\d+/i.test(trimmed);
}

export function extractTableFieldEvidence(technicalData: unknown): TableFieldEvidence[] {
  const technicalRecord = asRecord(technicalData);
  const rawData = asRecord(technicalRecord?.rawData);
  if (!rawData) return [];

  const headerTitles = asRecord(technicalRecord?.headerTitles) ?? {};
  const evidence: TableFieldEvidence[] = [];

  for (const [fieldKey, value] of Object.entries(rawData)) {
    if (fieldKey.startsWith("__")) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    const rawValue = String(value).trim();
    if (!rawValue) continue;

    const explicitTitle = headerTitles[fieldKey];
    const fieldTitle = typeof explicitTitle === "string" && explicitTitle.trim()
      ? explicitTitle.trim()
      : humanizeFieldTitle(fieldKey);

    evidence.push({
      fieldKey,
      fieldTitle,
      rawValue,
      isNumericLike: looksNumericLike(rawValue),
    });

    if (evidence.length >= 100) break;
  }

  return evidence;
}

export function extractTableNumericEvidence(technicalData: unknown): TableNumericEvidence[] {
  return extractTableFieldEvidence(technicalData).filter((entry) => entry.isNumericLike);
}

export function formatTableNumericEvidence(evidence: readonly TableNumericEvidence[]): string {
  return evidence.map((entry) => `${entry.fieldTitle}: ${entry.rawValue}`).join(" · ");
}
