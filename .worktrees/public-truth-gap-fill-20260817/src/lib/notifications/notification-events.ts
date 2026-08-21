import type { TranslationKey } from "@/lib/i18n/translate";

export type NotificationAuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorName: string;
  createdAt: string;
};

export type NotificationTone = "info" | "success" | "attention" | "error";

export type NotificationDescriptor = {
  id: string;
  createdAt: string;
  actorName: string;
  tone: NotificationTone;
  actionRequired: boolean;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  href: string | null;
  actionLabelKey: TranslationKey | null;
};

const QUIET_ACTION_PATTERNS = [
  /_DOWNLOADED$/,
  /_VIEWED$/,
  /_SEARCHED$/,
  /_LISTED$/,
  /^AI_DRAFT_ITEM_ADDED$/,
] as const;

export function shouldSurfaceAuditEvent(action: string): boolean {
  const normalized = action.trim().toUpperCase();
  if (!normalized) return false;

  return !QUIET_ACTION_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function classifyTone(action: string): {
  tone: NotificationTone;
  actionRequired: boolean;
} {
  if (/(FAILED|ERROR|BLOCKED|CANCELLED)/.test(action)) {
    return { tone: "error", actionRequired: true };
  }

  if (
    /(NEEDS_REVIEW|NEEDS_VERIFICATION|EXCEPTION|REJECTED|PENDING_APPROVAL)/.test(
      action,
    )
  ) {
    return { tone: "attention", actionRequired: true };
  }

  if (
    /(COMPLETED|GENERATED|APPROVED|CONFIRMED|IMPORTED|UPLOADED|CREATED|ACTIVATED)/.test(
      action,
    )
  ) {
    return { tone: "success", actionRequired: false };
  }

  return { tone: "info", actionRequired: false };
}

function knownDescriptor(
  event: NotificationAuditEvent,
): Omit<NotificationDescriptor, "id" | "createdAt" | "actorName"> | null {
  const action = event.action.trim().toUpperCase();

  if (action === "FILE_UPLOADED") {
    return {
      tone: "success",
      actionRequired: false,
      titleKey: "notifications.sourceUploadedTitle",
      bodyKey: "notifications.sourceUploadedBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  if (action === "FILE_CLASSIFICATION_TRIGGERED") {
    return {
      tone: "info",
      actionRequired: false,
      titleKey: "notifications.processingStartedTitle",
      bodyKey: "notifications.processingStartedBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  if (action === "AI_DRAFT_GENERATED") {
    return {
      tone: "success",
      actionRequired: false,
      titleKey: "notifications.aiDraftReadyTitle",
      bodyKey: "notifications.aiDraftReadyBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  if (action === "ENTITY_CONFIRMED" || action === "ENTITY_CORRECTED") {
    return {
      tone: "success",
      actionRequired: false,
      titleKey: "notifications.extractionReviewedTitle",
      bodyKey: "notifications.extractionReviewedBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  if (action === "ENTITY_REJECTED") {
    return {
      tone: "attention",
      actionRequired: true,
      titleKey: "notifications.extractionAttentionTitle",
      bodyKey: "notifications.extractionAttentionBody",
      href: "/projects",
      actionLabelKey: "notifications.reviewProjects",
    };
  }

  if (action === "ENTITY_IMPORTED_TO_BOQ") {
    return {
      tone: "success",
      actionRequired: false,
      titleKey: "notifications.extractionAddedToBoqTitle",
      bodyKey: "notifications.extractionAddedToBoqBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  if (/(DOCUMENT|REPORT).*(GENERATED|COMPLETED|READY)/.test(action)) {
    return {
      tone: "success",
      actionRequired: false,
      titleKey: "notifications.documentReadyTitle",
      bodyKey: "notifications.documentReadyBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  if (
    action.includes("TAYQAN")
    || event.entityType.toUpperCase().includes("TAYQAN")
  ) {
    const classification = classifyTone(action);

    return {
      ...classification,
      titleKey: classification.actionRequired
        ? "notifications.tayqanAttentionTitle"
        : "notifications.tayqanUpdateTitle",
      bodyKey: classification.actionRequired
        ? "notifications.tayqanAttentionBody"
        : "notifications.tayqanUpdateBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  return null;
}

export function mapAuditEventToNotification(
  event: NotificationAuditEvent,
): NotificationDescriptor | null {
  if (!shouldSurfaceAuditEvent(event.action)) return null;

  const known = knownDescriptor(event);
  if (known) {
    return {
      id: event.id,
      createdAt: event.createdAt,
      actorName: event.actorName,
      ...known,
    };
  }

  const action = event.action.trim().toUpperCase();
  const classification = classifyTone(action);

  if (classification.actionRequired) {
    return {
      id: event.id,
      createdAt: event.createdAt,
      actorName: event.actorName,
      ...classification,
      titleKey: "notifications.actionRequiredTitle",
      bodyKey: "notifications.actionRequiredBody",
      href: "/projects",
      actionLabelKey: "notifications.reviewProjects",
    };
  }

  if (classification.tone === "success") {
    return {
      id: event.id,
      createdAt: event.createdAt,
      actorName: event.actorName,
      ...classification,
      titleKey: "notifications.progressCompletedTitle",
      bodyKey: "notifications.progressCompletedBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  if (/(TRIGGERED|STARTED|QUEUED|PROCESSING)/.test(action)) {
    return {
      id: event.id,
      createdAt: event.createdAt,
      actorName: event.actorName,
      tone: "info",
      actionRequired: false,
      titleKey: "notifications.progressStartedTitle",
      bodyKey: "notifications.progressStartedBody",
      href: "/projects",
      actionLabelKey: "notifications.openProjects",
    };
  }

  return {
    id: event.id,
    createdAt: event.createdAt,
    actorName: event.actorName,
    tone: "info",
    actionRequired: false,
    titleKey: "notifications.activityUpdatedTitle",
    bodyKey: "notifications.activityUpdatedBody",
    href: "/dashboard",
    actionLabelKey: "notifications.openDashboard",
  };
}