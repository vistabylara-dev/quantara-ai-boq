import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(
    new URL(`../${relativePath}`, import.meta.url),
    "utf8",
  );
}

describe("notification center shell integration", () => {
  const header = readSource(
    "src/components/layout/top-header.tsx",
  );
  const center = readSource(
    "src/components/notifications/notification-center.tsx",
  );

  it("replaces the decorative bell with the active NotificationCenter", () => {
    expect(header).toContain("<NotificationCenter />");
    expect(header).not.toContain("animate-pulse");
    expect(header).not.toContain("<Bell");
  });

  it("uses only existing authenticated read endpoints", () => {
    expect(center).toContain('"/api/auth/session"');
    expect(center).toContain('"/api/dashboard/activity"');
    expect(center).not.toContain("apiClient.post");
    expect(center).not.toContain("apiClient.put");
    expect(center).not.toContain("apiClient.delete");
    expect(center).not.toContain("/api/notifications");
  });

  it("refreshes while the app is active without websockets", () => {
    expect(center).toContain("25_000");
    expect(center).toContain(
      'window.addEventListener("focus"',
    );
    expect(center).toContain(
      'document.addEventListener("visibilitychange"',
    );
    expect(center).not.toContain("WebSocket");
    expect(center).not.toContain("EventSource");
  });

  it("keeps unread state browser-only and per authenticated user", () => {
    expect(center).toContain("readNotificationState");
    expect(center).toContain("writeNotificationState");
  });
});