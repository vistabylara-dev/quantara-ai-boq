import type { VoiceNavigationResult } from "@/lib/voice/voice-types";

/**
 * Deterministic only — navigation never needs an LLM and never mutates
 * anything, so it runs before any mutation-command parsing. "Generate the
 * PDF" deliberately routes to "output" rather than triggering generation
 * directly: the documents page's own readiness state machine (validation/
 * lock gating) is the single source of truth for whether generation is
 * actually allowed, so voice never needs to duplicate that governance logic.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

const DESTINATION_PATTERNS: Array<{ destination: VoiceNavigationResult["destination"]; pattern: RegExp; message: string }> = [
  { destination: "sources", pattern: /\bsources?\b|\bfiles?\b|\bdrawings?\b|\bupload/, message: "Opening project sources." },
  { destination: "extraction", pattern: /\bextraction\b|\bextracted\b/, message: "Opening extraction review." },
  { destination: "dimensions", pattern: /\bdimensions?\b|\bmeasurements?\b/, message: "Opening dimension review." },
  { destination: "calculation", pattern: /\bcalculations?\b|\bformulas?\b/, message: "Opening calculation review." },
  { destination: "validation", pattern: /\bvalidation\b|\bverif(?:y|ication)\b/, message: "Opening validation." },
  {
    destination: "output",
    pattern: /\bpdf\b|\bdocuments?\b|\breport\b|\boutput\b|\bgenerate\b|\bdownload\b|\bexport\b(?!.*\bitem\b)/,
    message: "Opening document output. Final PDF generation requires a locked BOQ revision — this workspace will show exactly what's needed.",
  },
  { destination: "boq_review", pattern: /\bboq\b|\breview\s+(?:the\s+)?items?\b/, message: "Opening the BOQ." },
];

const NAVIGATION_VERB = /\b(?:go to|take me to|open|show me|navigate to)\b/;

export function detectVoiceNavigationIntent(transcript: string): VoiceNavigationResult | null {
  const normalized = normalize(transcript);
  if (!normalized) return null;

  // "generate the pdf" / "download the report" are action phrasings, not "go to X" phrasings —
  // still safe to treat as navigation since output's own state machine gates the real action.
  const isExplicitNavigation = NAVIGATION_VERB.test(normalized);
  const isOutputAction = /\b(?:generate|download|export|create)\b.*\b(?:pdf|document|report)\b/.test(normalized);
  if (!isExplicitNavigation && !isOutputAction) return null;

  for (const { destination, pattern, message } of DESTINATION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { kind: "navigation", destination, message };
    }
  }
  return null;
}
