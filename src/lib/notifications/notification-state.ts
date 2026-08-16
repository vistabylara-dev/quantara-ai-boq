export const NOTIFICATION_STATE_VERSION = 1 as const;
export const WELCOME_NOTIFICATION_ID = "system:welcome:v1" as const;

export type NotificationReadState = {
  version: typeof NOTIFICATION_STATE_VERSION;
  readIds: string[];
  welcomeRead: boolean;
  welcomeCreatedAt: string;
  initializedAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const MAX_READ_IDS = 250;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return [...new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )].slice(-MAX_READ_IDS);
}

export function getNotificationStorageKey(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new Error("Authenticated user id is required for notification storage.");
  }

  return `quantara:notifications:v${NOTIFICATION_STATE_VERSION}:${normalized}`;
}

export function createInitialNotificationState(
  existingEventIds: readonly string[],
  createdAt = nowIso(),
): NotificationReadState {
  return {
    version: NOTIFICATION_STATE_VERSION,
    // Events that existed before this browser's notification center was initialized
    // are historical context, not a sudden unread flood after feature rollout.
    readIds: normalizeIds(existingEventIds),
    welcomeRead: false,
    welcomeCreatedAt: createdAt,
    initializedAt: createdAt,
  };
}

export function parseNotificationState(raw: string | null): NotificationReadState | null {
  if (!raw) return null;

  try {
    const candidate: unknown = JSON.parse(raw);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }

    const record = candidate as Record<string, unknown>;
    if (record.version !== NOTIFICATION_STATE_VERSION) return null;

    const welcomeCreatedAt =
      typeof record.welcomeCreatedAt === "string" && record.welcomeCreatedAt.trim()
        ? record.welcomeCreatedAt
        : nowIso();

    const initializedAt =
      typeof record.initializedAt === "string" && record.initializedAt.trim()
        ? record.initializedAt
        : welcomeCreatedAt;

    return {
      version: NOTIFICATION_STATE_VERSION,
      readIds: normalizeIds(record.readIds),
      welcomeRead: record.welcomeRead === true,
      welcomeCreatedAt,
      initializedAt,
    };
  } catch {
    return null;
  }
}

export function readNotificationState(
  storage: StorageLike,
  userId: string,
): NotificationReadState | null {
  try {
    return parseNotificationState(
      storage.getItem(getNotificationStorageKey(userId)),
    );
  } catch {
    return null;
  }
}

export function writeNotificationState(
  storage: StorageLike,
  userId: string,
  state: NotificationReadState,
): void {
  try {
    storage.setItem(
      getNotificationStorageKey(userId),
      JSON.stringify(state),
    );
  } catch {
    // UI-only notification read state must never break the SaaS.
  }
}

export function isNotificationRead(
  state: NotificationReadState,
  notificationId: string,
): boolean {
  if (notificationId === WELCOME_NOTIFICATION_ID) {
    return state.welcomeRead;
  }

  return state.readIds.includes(notificationId);
}

export function markNotificationRead(
  state: NotificationReadState,
  notificationId: string,
): NotificationReadState {
  if (notificationId === WELCOME_NOTIFICATION_ID) {
    if (state.welcomeRead) return state;
    return { ...state, welcomeRead: true };
  }

  if (state.readIds.includes(notificationId)) return state;

  return {
    ...state,
    readIds: normalizeIds([...state.readIds, notificationId]),
  };
}

export function markAllNotificationsRead(
  state: NotificationReadState,
  eventIds: readonly string[],
): NotificationReadState {
  return {
    ...state,
    welcomeRead: true,
    readIds: normalizeIds([...state.readIds, ...eventIds]),
  };
}