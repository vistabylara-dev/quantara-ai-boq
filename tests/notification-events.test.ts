import { describe, expect, it } from "vitest";
import {
  mapAuditEventToNotification,
  shouldSurfaceAuditEvent,
  type NotificationAuditEvent,
} from "@/lib/notifications/notification-events";

function event(
  action: string,
  entityType = "Project",
): NotificationAuditEvent {
  return {
    id: `id-${action}`,
    entityType,
    entityId: "entity-1",
    action,
    actorName: "Engineer",
    createdAt: "2026-08-16T00:00:00.000Z",
  };
}

describe("notification event mapping", () => {
  it("suppresses noisy read-only activity", () => {
    expect(shouldSurfaceAuditEvent("FILE_DOWNLOADED")).toBe(false);
    expect(shouldSurfaceAuditEvent("AI_DRAFT_ITEM_ADDED")).toBe(false);
    expect(shouldSurfaceAuditEvent("FILE_UPLOADED")).toBe(true);
  });

  it("maps file upload to a meaningful success notification", () => {
    const mapped = mapAuditEventToNotification(
      event("FILE_UPLOADED", "ProjectFile"),
    );

    expect(mapped?.tone).toBe("success");
    expect(mapped?.titleKey).toBe(
      "notifications.sourceUploadedTitle",
    );
    expect(mapped?.actionRequired).toBe(false);
  });

  it("maps AI draft completion to BOQ-ready messaging", () => {
    const mapped = mapAuditEventToNotification(
      event("AI_DRAFT_GENERATED", "BOQ"),
    );

    expect(mapped?.titleKey).toBe(
      "notifications.aiDraftReadyTitle",
    );
    expect(mapped?.tone).toBe("success");
  });

  it("maps rejected extraction to action required", () => {
    const mapped = mapAuditEventToNotification(
      event("ENTITY_REJECTED", "ExtractedEntity"),
    );

    expect(mapped?.tone).toBe("attention");
    expect(mapped?.actionRequired).toBe(true);
  });

  it("maps failures to action required without business-service changes", () => {
    const mapped = mapAuditEventToNotification(
      event(
        "DOCUMENT_GENERATION_FAILED",
        "GeneratedDocument",
      ),
    );

    expect(mapped?.tone).toBe("error");
    expect(mapped?.actionRequired).toBe(true);
  });

  it("maps TAYQAN events to TAYQAN-specific messaging", () => {
    const mapped = mapAuditEventToNotification(
      event("WORK_STARTED", "TayqanWorkOrder"),
    );

    expect(mapped?.titleKey).toBe(
      "notifications.tayqanUpdateTitle",
    );
  });
});