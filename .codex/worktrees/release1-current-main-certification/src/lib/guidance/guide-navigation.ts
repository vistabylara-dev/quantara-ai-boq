import type { GuideStageId } from "@/lib/guidance/guide-registry";

export const GUIDE_NAVIGATION_MODE = "ADVISORY" as const;

export type GuideNavigationGap = Readonly<{
  id:
    | "DIMENSIONS_DEEP_LINK"
    | "CALCULATIONS_DEEP_LINK"
    | "POST_BOQ_REVIEW_ROUTE"
    | "EXTRACTION_ITEM_DEEP_LINK"
    | "VALIDATION_DETAIL_DEEP_LINK"
    | "OUTPUT_CONTEXT_DEEP_LINK";
  stageIds: readonly GuideStageId[];
  description: string;
  fallbackRoute: string;
}>;

export const GUIDE_NAVIGATION_GAPS = [
  {
    id: "DIMENSIONS_DEEP_LINK",
    stageIds: ["DIMENSIONS"],
    description:
      "There is no dedicated dimensions route or consumed dimensions query parameter yet.",
    fallbackRoute: "/projects/:projectId/boq",
  },
  {
    id: "CALCULATIONS_DEEP_LINK",
    stageIds: ["CALCULATIONS"],
    description:
      "There is no dedicated calculations route or consumed calculations query parameter yet.",
    fallbackRoute: "/projects/:projectId/boq",
  },
  {
    id: "POST_BOQ_REVIEW_ROUTE",
    stageIds: ["REVIEW"],
    description:
      "The current review route supports extraction confirmation, correction, and rejection; a distinct post-BOQ review route does not exist yet.",
    fallbackRoute: "/projects/:projectId/extractions",
  },
  {
    id: "EXTRACTION_ITEM_DEEP_LINK",
    stageIds: ["EXTRACTION", "REVIEW"],
    description:
      "The extraction review page does not consume an entity or status deep-link parameter.",
    fallbackRoute: "/projects/:projectId/extractions",
  },
  {
    id: "VALIDATION_DETAIL_DEEP_LINK",
    stageIds: ["VALIDATION"],
    description:
      "The verification page does not consume a BOQ revision or exception deep-link parameter.",
    fallbackRoute: "/projects/:projectId/verification",
  },
  {
    id: "OUTPUT_CONTEXT_DEEP_LINK",
    stageIds: ["OUTPUT"],
    description:
      "The documents index does not consume BOQ or template query parameters, so the Guide cannot safely select output context without proven identifiers.",
    fallbackRoute: "/projects/:projectId/documents",
  },
] as const satisfies readonly GuideNavigationGap[];

export type GuideStageHrefOptions = Readonly<{
  /** Supply only an identifier already proven to belong to the project. */
  fileId?: string | null;
}>;

function encodeRequiredSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required to build a Guide destination.`);
  }
  return encodeURIComponent(normalized);
}

export function getProjectOverviewHref(projectId: string): string {
  return `/projects/${encodeRequiredSegment(projectId, "Project ID")}`;
}

export function getProjectFilesHref(projectId: string, fileId?: string | null): string {
  const baseHref = `${getProjectOverviewHref(projectId)}/files`;
  const normalizedFileId = typeof fileId === "string" ? fileId.trim() : "";
  return normalizedFileId
    ? `${baseHref}?file=${encodeURIComponent(normalizedFileId)}`
    : baseHref;
}

export function getProjectExtractionsHref(projectId: string): string {
  return `${getProjectOverviewHref(projectId)}/extractions`;
}

export function getProjectBoqHref(projectId: string): string {
  return `${getProjectOverviewHref(projectId)}/boq`;
}

export function getProjectVerificationHref(projectId: string): string {
  return `${getProjectOverviewHref(projectId)}/verification`;
}

export function getProjectDocumentsHref(projectId: string): string {
  return `${getProjectOverviewHref(projectId)}/documents`;
}

export function getProjectIntegrationsHref(projectId: string): string {
  return `${getProjectOverviewHref(projectId)}/integrations`;
}

export function getCatalogueHref(): "/catalogue" {
  return "/catalogue";
}

export function getIntegrationsHref(): "/integrations" {
  return "/integrations";
}

export function getGuideStageHref(
  stageId: GuideStageId,
  projectId: string,
  options: GuideStageHrefOptions = {},
): string {
  switch (stageId) {
    case "PROJECT_SETUP":
      return getProjectOverviewHref(projectId);
    case "SOURCES":
      return getProjectFilesHref(projectId, options.fileId);
    case "EXTRACTION":
    case "REVIEW":
      return getProjectExtractionsHref(projectId);
    case "DIMENSIONS":
    case "CALCULATIONS":
    case "BOQ":
      return getProjectBoqHref(projectId);
    case "VALIDATION":
      return getProjectVerificationHref(projectId);
    case "OUTPUT":
      return getProjectDocumentsHref(projectId);
    default: {
      const unreachableStage: never = stageId;
      return unreachableStage;
    }
  }
}

const SUPPORTED_PROJECT_DESTINATIONS = new Set([
  "files",
  "extractions",
  "boq",
  "verification",
  "documents",
  "integrations",
]);

/**
 * Validates only destinations that Guide v2 may emit. It intentionally rejects
 * unconsumed query parameters and every absolute or protocol-relative URL.
 */
export function isSupportedGuideHref(href: string): boolean {
  if (!href || href !== href.trim() || !href.startsWith("/") || href.startsWith("//") || href.includes("#")) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(href, "https://guide.quantara.invalid");
  } catch {
    return false;
  }

  if (parsed.origin !== "https://guide.quantara.invalid") {
    return false;
  }

  if (
    parsed.pathname === "/catalogue"
    || parsed.pathname === "/integrations"
    || parsed.pathname === "/integrations/google-drive/connect"
  ) {
    return parsed.search === "";
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments[0] !== "projects" || segments.length < 2 || segments.length > 3) {
    return false;
  }

  const projectId = segments[1];
  if (!projectId) {
    return false;
  }

  if (segments.length === 2) {
    return parsed.search === "";
  }

  const destination = segments[2];
  if (!SUPPORTED_PROJECT_DESTINATIONS.has(destination)) {
    return false;
  }

  if (destination !== "files") {
    return parsed.search === "";
  }

  if (parsed.search === "") {
    return true;
  }

  const queryEntries = Array.from(parsed.searchParams.entries());
  return queryEntries.length === 1
    && queryEntries[0][0] === "file"
    && queryEntries[0][1].trim().length > 0;
}
