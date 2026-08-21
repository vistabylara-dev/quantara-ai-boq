export type VerificationSeverity = "critical" | "warning" | "info";

export type VerificationException = {
  id: string;
  boqItemId: string;
  type: string;
  severity: VerificationSeverity;
  message: string;
  sourceReference: string;
  currentValue: string;
  suggestedValue: string;
  resolved: boolean;
  resolutionNote: string;
};
