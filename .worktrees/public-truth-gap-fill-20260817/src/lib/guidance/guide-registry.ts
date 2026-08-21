export const GUIDE_STAGE_IDS = [
  "PROJECT_SETUP",
  "SOURCES",
  "EXTRACTION",
  "DIMENSIONS",
  "CALCULATIONS",
  "BOQ",
  "REVIEW",
  "VALIDATION",
  "OUTPUT",
] as const;

export type GuideStageId = (typeof GUIDE_STAGE_IDS)[number];

export type GuideStageDefinition = Readonly<{
  id: GuideStageId;
  title: string;
  shortDescription: string;
  professionalPurpose: string;
  whatQuantaraDoes: string;
  whatUserCanDo: string;
  suggestedActionLabel: string;
}>;

export const GUIDE_STAGE_REGISTRY = {
  PROJECT_SETUP: {
    id: "PROJECT_SETUP",
    title: "Project Setup",
    shortDescription: "Controlled project and client context.",
    professionalPurpose:
      "Establish the project identity, client context, and working scope that govern the professional workflow.",
    whatQuantaraDoes:
      "Quantara keeps the project and client context together without assuming information that has not been provided.",
    whatUserCanDo:
      "Review the project context, confirm it is appropriate for the work, and continue to any valid project workspace.",
    suggestedActionLabel: "Open Project Overview",
  },
  SOURCES: {
    id: "SOURCES",
    title: "Sources",
    shortDescription:
      "Drawings, schedules, spreadsheets, and supported connected sources become project evidence.",
    professionalPurpose:
      "Build a traceable evidence base for extraction, measurement, and professional BOQ preparation.",
    whatQuantaraDoes:
      "Quantara retains supported project sources, preserves their origin, and presents their real processing state.",
    whatUserCanDo:
      "Upload a project source, use a supported connected source, or review the evidence already available.",
    suggestedActionLabel: "Review Project Sources",
  },
  EXTRACTION: {
    id: "EXTRACTION",
    title: "Extraction",
    shortDescription:
      "Quantara examines supported source data and presents captured information for professional review. Nothing becomes approved automatically.",
    professionalPurpose:
      "Convert supported project evidence into traceable captured information without bypassing professional judgement.",
    whatQuantaraDoes:
      "Quantara processes supported sources, records provable captured results, and keeps candidate information linked to its source.",
    whatUserCanDo:
      "Review processing results, inspect source evidence, and decide whether captured information is ready for professional review.",
    suggestedActionLabel: "Review Extracted Information",
  },
  DIMENSIONS: {
    id: "DIMENSIONS",
    title: "Dimensions",
    shortDescription:
      "Review the measurements required for BOQ calculations. Missing values remain explicit and are never invented.",
    professionalPurpose:
      "Establish the measured inputs required for a defensible project quantity.",
    whatQuantaraDoes:
      "For supported deterministic measurement types, Quantara shows the required dimensions and keeps missing required values visible.",
    whatUserCanDo:
      "Review available dimensions, enter missing measurements manually, and correct inputs before calculation.",
    suggestedActionLabel: "Review Dimensions",
  },
  CALCULATIONS: {
    id: "CALCULATIONS",
    title: "Calculations",
    shortDescription:
      "Review the equation, inputs, deductions or allowances, and calculated result before professional confirmation.",
    professionalPurpose:
      "Produce a quantity that can be checked against its reviewed measurements and calculation method.",
    whatQuantaraDoes:
      "Quantara displays the deterministic equation, inputs, deductions or allowances, and calculated result for professional review before confirmation.",
    whatUserCanDo:
      "Review or correct the inputs, then explicitly confirm the calculated result.",
    suggestedActionLabel: "Review Calculations",
  },
  BOQ: {
    id: "BOQ",
    title: "BOQ",
    shortDescription: "Controlled project-specific Bill of Quantities workspace.",
    professionalPurpose:
      "Maintain the project Bill of Quantities as a controlled professional record.",
    whatQuantaraDoes:
      "Quantara keeps project BOQ sections, items, quantities, rates, and revision state governed, and can propose a professionally confirmed calculated quantity against an item without applying it until the user confirms the quantity update.",
    whatUserCanDo:
      "Prepare items manually, use valid project evidence, and continue normal BOQ work without Guide-imposed locks.",
    suggestedActionLabel: "Open BOQ Workspace",
  },
  REVIEW: {
    id: "REVIEW",
    title: "Review",
    shortDescription: "Professional confirmation, correction, or rejection.",
    professionalPurpose:
      "Keep professional judgement explicit before captured information is treated as reviewed.",
    whatQuantaraDoes:
      "Quantara presents source-linked information and records each supported review decision without automatic approval.",
    whatUserCanDo:
      "Confirm supported information, correct it with a reason, or reject it with a professional reason.",
    suggestedActionLabel: "Review Extracted Information",
  },
  VALIDATION: {
    id: "VALIDATION",
    title: "Validation",
    shortDescription: "Actionable checks for unresolved BOQ issues.",
    professionalPurpose:
      "Identify and resolve material BOQ issues before professional output is prepared.",
    whatQuantaraDoes:
      "Quantara runs the supported verification checks and presents unresolved exceptions without hiding them.",
    whatUserCanDo:
      "Review validation findings, resolve supported exceptions, and return to the BOQ when correction is required.",
    suggestedActionLabel: "Open Validation Checks",
  },
  OUTPUT: {
    id: "OUTPUT",
    title: "Output",
    shortDescription: "Professional output generated from a reviewed and approved Project BOQ.",
    professionalPurpose:
      "Create controlled project documents from the appropriate reviewed BOQ revision.",
    whatQuantaraDoes:
      "Quantara prepares supported document output from the selected BOQ revision and retains generation history.",
    whatUserCanDo:
      "Review document readiness, select supported output options, preview the result, and generate the required document.",
    suggestedActionLabel: "Open Documents",
  },
} as const satisfies Readonly<Record<GuideStageId, GuideStageDefinition>>;

export function getGuideStageDefinition(stageId: GuideStageId): GuideStageDefinition {
  return GUIDE_STAGE_REGISTRY[stageId];
}
