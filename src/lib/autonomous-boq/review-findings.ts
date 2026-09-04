export const AUTONOMOUS_REVIEW_ISSUE_CODES = [
  "CONCEPT_DRAWING_NOT_PAYABLE",
  "ALTERNATIVE_SCHEME_UNRESOLVED",
  "DRAWING_VALUE_CONFLICT",
  "STRUCTURAL_EVIDENCE_MISSING",
  "UNSUPPORTED_MEASUREMENT_RULE",
  "BOQ_ASSEMBLY_INCOMPLETE",
] as const;

export type AutonomousReviewIssueCode = typeof AUTONOMOUS_REVIEW_ISSUE_CODES[number];

export type PreparationFinding = {
  code: string;
  message: string;
  sourceFileIds: string[];
  pageIds?: string[];
  sourceSheets?: string[];
  projectRevision?: string | null;
  discipline?: string | null;
  workPackage?: string | null;
};

export type ConsolidatedPreparationFinding = PreparationFinding & {
  code: AutonomousReviewIssueCode;
  pageIds: string[];
  sourceSheets: string[];
  normalizedReason: string;
  projectRevision: string | null;
  discipline: string | null;
  workPackage: string | null;
};

const CANONICAL_MESSAGES: Record<AutonomousReviewIssueCode, string> = {
  CONCEPT_DRAWING_NOT_PAYABLE: "Concept or basis-of-design drawings are descriptive only and cannot support a payable BOQ.",
  ALTERNATIVE_SCHEME_UNRESOLVED: "Multiple design alternatives are present; the governing scheme has not been selected.",
  DRAWING_VALUE_CONFLICT: "Conflicting stated values require an explicit engineering decision before measurement.",
  STRUCTURAL_EVIDENCE_MISSING: "Required dimensions, details, or schedules are missing for deterministic measurement.",
  UNSUPPORTED_MEASUREMENT_RULE: "The drawing contains a metric with no enabled deterministic measurement rule.",
  BOQ_ASSEMBLY_INCOMPLETE: "A quantity-complete payable BOQ cannot be assembled until the listed evidence blockers are resolved.",
};

function issueCode(finding: PreparationFinding): AutonomousReviewIssueCode {
  const code = finding.code.toLocaleLowerCase();
  const text = `${code} ${finding.message}`.toLocaleLowerCase();
  if (/conflict|contradict|discrepan|inconsistent/.test(code)) return "DRAWING_VALUE_CONFLICT";
  if (/alternative|alternate|option|scheme|configuration/.test(code)) return "ALTERNATIVE_SCHEME_UNRESOLVED";
  if (/not[ _-]?for[ _-]?construction|concept|basis[ _-]?of[ _-]?design|not[ _-]?payable/.test(code)) return "CONCEPT_DRAWING_NOT_PAYABLE";
  if (/conflict|contradict|discrepan|inconsistent|different stated value/.test(text)) return "DRAWING_VALUE_CONFLICT";
  if (/alternative|alternate|option|scheme|configuration/.test(text)) return "ALTERNATIVE_SCHEME_UNRESOLVED";
  if (/not[ _-]?for[ _-]?construction|concept|basis[ _-]?of[ _-]?design|not[ _-]?payable/.test(text)) return "CONCEPT_DRAWING_NOT_PAYABLE";
  if (/unsupported|unregistered|no (enabled|registered|supported).*rule|formula/.test(text)) return "UNSUPPORTED_MEASUREMENT_RULE";
  if (/assembl|quantity.complete|rate.ready/.test(text)) return "BOQ_ASSEMBLY_INCOMPLETE";
  return "STRUCTURAL_EVIDENCE_MISSING";
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.flatMap((value) => value?.trim() ? [value.trim()] : []))].sort();
}

export function consolidatePreparationFindings(findings: readonly PreparationFinding[]): ConsolidatedPreparationFinding[] {
  const groups = new Map<string, ConsolidatedPreparationFinding>();
  for (const finding of findings) {
    const code = issueCode(finding);
    const revision = finding.projectRevision?.trim() || null;
    const discipline = finding.discipline?.trim() || null;
    const workPackage = finding.workPackage?.trim() || null;
    const normalizedReason = CANONICAL_MESSAGES[code];
    const key = [code, revision ?? "", discipline ?? "", workPackage ?? "", normalizedReason].join("|").toLocaleLowerCase();
    const current = groups.get(key);
    if (current) {
      current.sourceFileIds = unique([...current.sourceFileIds, ...finding.sourceFileIds]);
      current.pageIds = unique([...current.pageIds, ...(finding.pageIds ?? [])]);
      current.sourceSheets = unique([...current.sourceSheets, ...(finding.sourceSheets ?? [])]);
      continue;
    }
    groups.set(key, {
      ...finding,
      code,
      message: normalizedReason,
      normalizedReason,
      sourceFileIds: unique(finding.sourceFileIds),
      pageIds: unique(finding.pageIds ?? []),
      sourceSheets: unique(finding.sourceSheets ?? []),
      projectRevision: revision,
      discipline,
      workPackage,
    });
  }
  return [...groups.values()].sort((left, right) => left.code.localeCompare(right.code));
}
