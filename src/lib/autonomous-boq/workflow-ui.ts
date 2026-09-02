export const AUTONOMOUS_PREPARATION_STAGES = [
  { id: "uploading", label: "Uploading" },
  { id: "reading", label: "Reading drawings" },
  { id: "detecting", label: "Detecting dimensions/schedules" },
  { id: "calculating", label: "Calculating quantities" },
  { id: "building", label: "Building BOQ" },
  { id: "ready", label: "Ready" },
] as const;

export type AutonomousPreparationUiState =
  | "empty"
  | "uploading"
  | "processing"
  | "partially_ready"
  | "ready"
  | "retryable_failure"
  | "missing_evidence";

type PreparationSnapshot = {
  status: "QUEUED" | "RUNNING" | "NEEDS_INPUT" | "NEEDS_REVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
  stage: string;
  readyForRates: boolean;
  retryable: boolean;
};

export function preparationStageIndex(stage: string): number {
  if (stage === "READY_FOR_RATES") return 5;
  if (stage === "ASSEMBLING_BOQ" || stage === "ASSEMBLY_PENDING") return 4;
  if (stage === "MEASURING") return 3;
  if (stage === "CATEGORIZING") return 2;
  if (stage === "SOURCE_PROCESSING") return 1;
  if (stage === "SOURCE_VALIDATION" || stage === "QUEUED") return 1;
  return 0;
}

export function deriveAutonomousPreparationUi(input: {
  drawingCount: number;
  uploadActive: boolean;
  preparation: PreparationSnapshot | null;
}): { state: AutonomousPreparationUiState; activeStageIndex: number } {
  if (input.uploadActive) return { state: "uploading", activeStageIndex: 0 };
  if (!input.preparation) {
    return { state: "empty", activeStageIndex: input.drawingCount > 0 ? 1 : 0 };
  }
  if (input.preparation.readyForRates) return { state: "ready", activeStageIndex: 5 };
  if (input.preparation.status === "QUEUED" || input.preparation.status === "RUNNING") {
    return { state: "processing", activeStageIndex: preparationStageIndex(input.preparation.stage) };
  }
  if (input.preparation.status === "NEEDS_REVIEW") {
    return { state: "partially_ready", activeStageIndex: preparationStageIndex(input.preparation.stage) };
  }
  if (input.preparation.retryable) {
    return { state: "retryable_failure", activeStageIndex: preparationStageIndex(input.preparation.stage) };
  }
  return { state: "missing_evidence", activeStageIndex: preparationStageIndex(input.preparation.stage) };
}
