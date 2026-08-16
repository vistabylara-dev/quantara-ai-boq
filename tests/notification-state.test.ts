import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_STATE_VERSION,
  WELCOME_NOTIFICATION_ID,
  createInitialNotificationState,
  getNotificationStorageKey,
  isNotificationRead,
  markAllNotificationsRead,
  markNotificationRead,
  parseNotificationState,
} from "@/lib/notifications/notification-state";

describe("notification read state", () => {
  it("scopes state by version and authenticated user", () => {
    expect(getNotificationStorageKey("user-7")).toBe(
      `quantara:notifications:v${NOTIFICATION_STATE_VERSION}:user-7`,
    );
  });

  it("initializes existing audit history as read but leaves Welcome unread", () => {
    const state = createInitialNotificationState(
      ["event-1", "event-2"],
      "2026-08-16T00:00:00.000Z",
    );

    expect(isNotificationRead(state, "event-1")).toBe(true);
    expect(isNotificationRead(state, "event-2")).toBe(true);
    expect(isNotificationRead(state, WELCOME_NOTIFICATION_ID)).toBe(false);
  });

  it("falls back safely for invalid JSON and unknown versions", () => {
    expect(parseNotificationState("{oops")).toBeNull();
    expect(
      parseNotificationState(
        JSON.stringify({ version: 99 }),
      ),
    ).toBeNull();
  });

  it("marks one event idempotently", () => {
    const state = createInitialNotificationState(
      [],
      "2026-08-16T00:00:00.000Z",
    );
    const once = markNotificationRead(state, "event-1");
    const twice = markNotificationRead(once, "event-1");

    expect(isNotificationRead(once, "event-1")).toBe(true);
    expect(twice).toBe(once);
  });

  it("marks Welcome independently", () => {
    const state = createInitialNotificationState(
      [],
      "2026-08-16T00:00:00.000Z",
    );
    const next = markNotificationRead(
      state,
      WELCOME_NOTIFICATION_ID,
    );

    expect(next.welcomeRead).toBe(true);
    expect(next.readIds).toEqual([]);
  });

  it("marks all current events and Welcome read", () => {
    const state = createInitialNotificationState(
      [],
      "2026-08-16T00:00:00.000Z",
    );
    const next = markAllNotificationsRead(
      state,
      ["one", "two"],
    );

    expect(next.welcomeRead).toBe(true);
    expect(isNotificationRead(next, "one")).toBe(true);
    expect(isNotificationRead(next, "two")).toBe(true);
  });
});