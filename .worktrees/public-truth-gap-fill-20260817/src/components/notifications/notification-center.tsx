"use client";

import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Info,
  X,
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiClient } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  mapAuditEventToNotification,
  type NotificationAuditEvent,
  type NotificationDescriptor,
  type NotificationTone,
} from "@/lib/notifications/notification-events";
import {
  WELCOME_NOTIFICATION_ID,
  createInitialNotificationState,
  isNotificationRead,
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationState,
  writeNotificationState,
  type NotificationReadState,
} from "@/lib/notifications/notification-state";

const POLL_MS = 25_000;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type SessionData =
  | { authenticated: false }
  | {
      authenticated: true;
      user: {
        id: string;
        fullName?: string | null;
      };
    };

type Filter = "all" | "unread" | "attention";

type NotificationItem = NotificationDescriptor & {
  synthetic?: boolean;
};

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function relativeTime(value: string, locale: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const absolute = Math.abs(seconds);

  const formatter = new Intl.RelativeTimeFormat(
    locale === "ar" ? "ar" : "en",
    { numeric: "auto" },
  );

  if (absolute < 60) return formatter.format(seconds, "second");

  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
}

function toneClasses(tone: NotificationTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300";
    case "attention":
      return "border-amber-300/50 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300";
    case "error":
      return "border-rose-300/50 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300";
    default:
      return "border-blue-300/50 bg-blue-50 text-blue-700 dark:border-[#21C7F3]/20 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]";
  }
}

function ToneIcon({ tone }: { tone: NotificationTone }) {
  if (tone === "success") {
    return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  }

  if (tone === "attention" || tone === "error") {
    return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  }

  return <Info className="h-4 w-4" aria-hidden="true" />;
}

export default function NotificationCenter() {
  const { locale, direction, t } = useLocale();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [events, setEvents] = useState<NotificationAuditEvent[]>([]);
  const [readState, setReadState] = useState<NotificationReadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState(false);

  const persistState = useCallback(
    (next: NotificationReadState) => {
      setReadState(next);

      const storage = safeStorage();
      if (storage && userId) {
        writeNotificationState(storage, userId, next);
      }
    },
    [userId],
  );

  const refreshActivity = useCallback(async (signal?: AbortSignal) => {
    try {
      const activity = await apiClient.get<NotificationAuditEvent[]>(
        "/api/dashboard/activity",
        signal,
      );
      setEvents(activity);
      setRefreshError(false);
      return activity;
    } catch {
      setRefreshError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function initialize() {
      try {
        const session = await apiClient.get<SessionData>(
          "/api/auth/session",
          controller.signal,
        );

        if (!active || !session.authenticated) return;

        const nextUserId = session.user.id?.trim();
        if (!nextUserId) return;

        const activity = await apiClient.get<NotificationAuditEvent[]>(
          "/api/dashboard/activity",
          controller.signal,
        );

        if (!active) return;

        setUserId(nextUserId);
        setFullName(session.user.fullName?.trim() ?? "");
        setEvents(activity);
        setRefreshError(false);

        const storage = safeStorage();
        const stored = storage
          ? readNotificationState(storage, nextUserId)
          : null;

        if (stored) {
          setReadState(stored);
        } else {
          const initial = createInitialNotificationState(
            activity.map((event) => event.id),
          );
          setReadState(initial);
          if (storage) {
            writeNotificationState(storage, nextUserId, initial);
          }
        }
      } catch {
        // Notifications are non-blocking UI. Existing SaaS auth/navigation
        // remain authoritative if this optional surface cannot initialize.
        setRefreshError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshActivity();
    }, POLL_MS);

    const onFocus = () => void refreshActivity();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshActivity();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshActivity]);

  useEffect(() => {
    if (!open) return;

    requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const items = useMemo<NotificationItem[]>(() => {
    if (!readState) return [];

    const welcome: NotificationItem = {
      id: WELCOME_NOTIFICATION_ID,
      createdAt: readState.welcomeCreatedAt,
      actorName: fullName || t("notifications.system"),
      tone: "info",
      actionRequired: false,
      titleKey: "notifications.welcomeTitle",
      bodyKey: "notifications.welcomeBody",
      href: "/dashboard",
      actionLabelKey: "notifications.getStarted",
      synthetic: true,
    };

    const mapped = events
      .map(mapAuditEventToNotification)
      .filter((item): item is NotificationDescriptor => item !== null);

    return [welcome, ...mapped];
  }, [events, fullName, readState, t]);

  const unreadCount = useMemo(() => {
    if (!readState) return 0;

    return items.reduce(
      (count, item) =>
        count + (isNotificationRead(readState, item.id) ? 0 : 1),
      0,
    );
  }, [items, readState]);

  const visibleItems = useMemo(() => {
    if (!readState) return [];

    if (filter === "unread") {
      return items.filter(
        (item) => !isNotificationRead(readState, item.id),
      );
    }

    if (filter === "attention") {
      return items.filter((item) => item.actionRequired);
    }

    return items;
  }, [filter, items, readState]);

  const markRead = useCallback(
    (notificationId: string) => {
      if (!readState) return;
      persistState(
        markNotificationRead(readState, notificationId),
      );
    },
    [persistState, readState],
  );

  const markAllRead = useCallback(() => {
    if (!readState) return;

    persistState(
      markAllNotificationsRead(
        readState,
        events.map((event) => event.id),
      ),
    );
  }, [events, persistState, readState]);

  const toggle = () => {
    const next = !open;
    setOpen(next);

    if (next) {
      void refreshActivity();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("a11y.notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="quantara-notification-center"
        onClick={toggle}
        className="relative inline-flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#00F0FF]/30 dark:hover:bg-[#00F0FF]/10 dark:hover:text-[#00F0FF]"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />

        {unreadCount > 0 ? (
          <span
            className="absolute -end-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white shadow-lg dark:bg-[#FF0055]"
          >
            <span className="sr-only">
              {t("notifications.unreadCount", { count: unreadCount })}
            </span>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-black/50"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }
          }}
        >
          <aside
            ref={panelRef}
            id="quantara-notification-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quantara-notifications-title"
            dir={direction}
            className="fixed inset-y-0 end-0 z-[10000] flex w-[min(30rem,100vw)] flex-col border-s border-slate-200 bg-white text-start text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#07111F] dark:text-white"
          >
            <div className="border-b border-slate-200 p-5 dark:border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-[#21C7F3]">
                    Quantara
                  </p>

                  <h2
                    id="quantara-notifications-title"
                    className="mt-1 text-xl font-bold"
                  >
                    {t("notifications.title")}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {unreadCount > 0
                      ? t("notifications.unreadCount", {
                          count: unreadCount,
                        })
                      : t("notifications.allCaughtUp")}
                  </p>
                </div>

                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    requestAnimationFrame(() => triggerRef.current?.focus());
                  }}
                  aria-label={t("notifications.close")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {([
                  ["all", "notifications.all"],
                  ["unread", "notifications.unread"],
                  ["attention", "notifications.actionRequired"],
                ] as const).map(([value, labelKey]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      filter === value
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-[#21C7F3]/50 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={!readState || unreadCount === 0}
                  className="ms-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("notifications.markAllRead")}
                </button>
              </div>
            </div>

            {refreshError ? (
              <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                {t("notifications.refreshError")}
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-4">
              {loading && !readState ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  {t("notifications.loading")}
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center text-center">
                  <CheckCircle2
                    className="h-8 w-8 text-emerald-500"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-semibold">
                    {filter === "unread"
                      ? t("notifications.noUnread")
                      : filter === "attention"
                        ? t("notifications.noActionRequired")
                        : t("notifications.noNotifications")}
                  </p>
                </div>
              ) : (
                <ol className="space-y-3">
                  {visibleItems.map((item) => {
                    const read = readState
                      ? isNotificationRead(readState, item.id)
                      : true;

                    return (
                      <li
                        key={item.id}
                        className={`rounded-2xl border p-4 transition ${
                          read
                            ? "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02]"
                            : "border-blue-300 bg-blue-50/70 shadow-sm dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/[0.06]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses(item.tone)}`}
                          >
                            <ToneIcon tone={item.tone} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  {!read ? (
                                    <CircleDot
                                      className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-[#21C7F3]"
                                      aria-hidden="true"
                                    />
                                  ) : null}

                                  <h3 className="text-sm font-bold">
                                    {t(item.titleKey)}
                                  </h3>
                                </div>

                                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                  {t(item.bodyKey, {
                                    actor:
                                      item.actorName
                                      || t("notifications.system"),
                                  })}
                                </p>
                              </div>

                              {!read ? (
                                <button
                                  type="button"
                                  onClick={() => markRead(item.id)}
                                  aria-label={t("notifications.markRead")}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                                >
                                  <Check
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </button>
                              ) : null}
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span
                                title={new Date(item.createdAt).toLocaleString(
                                  locale === "ar" ? "ar-AE" : "en-GB",
                                )}
                                className="text-[11px] text-slate-500 dark:text-slate-400"
                              >
                                {relativeTime(item.createdAt, locale)}
                              </span>

                              {item.href && item.actionLabelKey ? (
                                <Link
                                  href={item.href}
                                  onClick={() => {
                                    markRead(item.id);
                                    setOpen(false);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-[#21C7F3]"
                                >
                                  {t(item.actionLabelKey)}
                                  <ChevronRight
                                    className="h-3.5 w-3.5 rtl:-scale-x-100"
                                    aria-hidden="true"
                                  />
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}