import type { TayqanMeasurementPageEvidence } from "@/lib/tayqan/tayqan-measurement-reasoner";

export type PreliminaryConceptMetric = {
  label: string;
  value: number;
  unit: "m2" | "sq ft" | "count";
  pageId: string;
  sheetReference: string;
  confidence: number;
};

export type PreliminaryConceptSchedule = {
  title: "Preliminary Concept Quantity Schedule — Not for Contract/Payment";
  payable: false;
  metrics: PreliminaryConceptMetric[];
  alternatives: string[];
  conflicts: Array<{ label: string; values: string[]; sheetReferences: string[] }>;
  assumptions: string[];
};

const AREA = /\b(gross(?: floor)? area|net(?: floor)? area|room area|module area)\s*[:=-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(m2|m²|sq\.?\s*ft|square feet)\b/giu;
const COUNT = /\b(room count|number of rooms|bedroom count|module count)\s*[:=-]?\s*(\d+)\b/giu;
const ALTERNATIVE = /\b(?:scheme|option|alternative)\s*([A-Z0-9]+)|\b([TLH])-shaped?\s+(?:scheme|option|configuration)\b/giu;

function normalizedUnit(value: string): "m2" | "sq ft" {
  return /^m/i.test(value) ? "m2" : "sq ft";
}

export function buildPreliminaryConceptSchedule(pages: readonly TayqanMeasurementPageEvidence[]): PreliminaryConceptSchedule | null {
  const conceptPages = pages.filter((page) => page.classification?.maturity === "CONCEPT_BASIS_OF_DESIGN");
  if (conceptPages.length === 0) return null;
  const metrics: PreliminaryConceptMetric[] = [];
  const alternatives = new Set<string>();
  const seen = new Set<string>();
  for (const page of conceptPages) {
    const text = [page.drawingTitle, page.sheetName, ...page.drawingTitles, ...page.technicalLines, page.text].filter(Boolean).join("\n");
    const sheetReference = page.drawingNumber || page.sheetName || `Page ${page.pageNumber}`;
    for (const match of text.matchAll(AREA)) {
      const metric = { label: match[1]!.replace(/\s+/g, " ").trim(), value: Number(match[2]!.replace(/,/g, "")), unit: normalizedUnit(match[3]!), pageId: page.id, sheetReference, confidence: 95 } as const;
      const key = `${metric.label.toLocaleLowerCase()}|${metric.value}|${metric.unit}|${metric.pageId}`;
      if (!seen.has(key) && Number.isFinite(metric.value)) { seen.add(key); metrics.push(metric); }
    }
    for (const match of text.matchAll(COUNT)) {
      const metric = { label: match[1]!.replace(/\s+/g, " ").trim(), value: Number(match[2]), unit: "count" as const, pageId: page.id, sheetReference, confidence: 95 };
      const key = `${metric.label.toLocaleLowerCase()}|${metric.value}|count|${metric.pageId}`;
      if (!seen.has(key)) { seen.add(key); metrics.push(metric); }
    }
    for (const match of text.matchAll(ALTERNATIVE)) alternatives.add(`Scheme ${(match[1] || match[2])!.toLocaleUpperCase()}`);
  }
  const conflicts = new Map<string, { values: Set<string>; sheets: Set<string> }>();
  for (const metric of metrics) {
    const key = `${metric.label.toLocaleLowerCase()}|${metric.unit}`;
    const current = conflicts.get(key) ?? { values: new Set<string>(), sheets: new Set<string>() };
    current.values.add(String(metric.value)); current.sheets.add(metric.sheetReference); conflicts.set(key, current);
  }
  return {
    title: "Preliminary Concept Quantity Schedule — Not for Contract/Payment",
    payable: false,
    metrics,
    alternatives: [...alternatives].sort(),
    conflicts: [...conflicts].flatMap(([label, value]) => value.values.size > 1 ? [{ label, values: [...value.values].sort(), sheetReferences: [...value.sheets].sort() }] : []),
    assumptions: ["Only explicitly printed, reconcilable concept metrics are included.", "No design alternative is selected and no construction quantity is inferred."],
  };
}
