"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { apiClient } from "@/lib/api/client";
import { TayqanFallback } from "./tayqan-fallback";

const TayqanRobotCanvas = dynamic(() => import("./tayqan-robot-canvas"), {
  ssr: false,
  loading: () => <TayqanFallback compact />,
});

const DEDICATED_TAYQAN_PAGE = /^\/projects\/[^/]+\/tayqan(\/|$)/;

type CompanionPlatformRole =
  | "PLATFORM_OWNER"
  | "PLATFORM_ADMIN"
  | "PLATFORM_SUPPORT";

type CompanionSession = {
  authenticated: boolean;
  user?: {
    platformRole:
      CompanionPlatformRole | null;
  };
};

function containsPoint(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Global TAYQAN companion.
 *
 * Important interaction contract:
 *
 * - The whole companion (robot + speech bubble) is ONE navigable link,
 *   scoped exactly to the robot's own visual bounding box (the same box the
 *   hover-detection math below already uses) — never a full-viewport
 *   overlay, and it never intercepts BOQ controls, navigation, forms, Save,
 *   Lock, Generate, dialogs, etc. outside that box, because the wrapping
 *   container stays pointer-events-none and only this one link opts back in.
 *
 * - A single click/tap/Enter/Space on that link navigates directly — this is
 *   a real `<a href>` (via next/link), so it is natively focusable and
 *   natively activates on Enter/Space; no bubble-reveal step is required
 *   first, on any input method.
 *
 * - Hover detection (mouse/trackpad only — touch intentionally passes
 *   through, see the pointermove handler below) is still performed from
 *   window pointer coordinates against the robot's visual bounding box, and
 *   still only controls the speech bubble's VISUAL reveal — a
 *   discoverability affordance for mouse users, not a gate on whether the
 *   link can be activated.
 *
 * - TAYQAN-specific commercial checkout belongs inside the TAYQAN hire workflow.
 *
 * No Stripe or general SaaS pricing route is owned by this component.
 */
export function TayqanGlobalCompanion() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations();

  const adminRoute =
    pathname === "/admin"
    || pathname.startsWith("/admin/");

  const adminLoginRoute =
    pathname === "/admin/login";

  const [
    platformRole,
    setPlatformRole,
  ] = useState<CompanionPlatformRole | null>(
    null,
  );

  const internalAdminAccess =
    platformRole === "PLATFORM_OWNER"
    || platformRole === "PLATFORM_ADMIN";

  const companionHref =
    internalAdminAccess
      ? "/projects?tayqan=admin"
      : "/projects?tayqan=assign";

  const robotRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const visibleRef = useRef(false);

  const [bubbleVisible, setBubbleVisible] = useState(false);

  const dedicatedPage = DEDICATED_TAYQAN_PAGE.test(pathname);

  useEffect(() => {
    if (
      !adminRoute
      || adminLoginRoute
    ) {
      setPlatformRole(null);
      return;
    }

    let active = true;

    void apiClient
      .get<CompanionSession>(
        "/api/auth/session",
      )
      .then((session) => {
        if (!active) return;

        setPlatformRole(
          session.user?.platformRole
          ?? null,
        );
      })
      .catch(() => {
        if (active) {
          setPlatformRole(null);
        }
      });

    return () => {
      active = false;
    };
  }, [
    adminRoute,
    adminLoginRoute,
  ]);

  const setVisible = (visible: boolean) => {
    visibleRef.current = visible;
    setBubbleVisible(visible);
  };

  useEffect(() => {
    if (dedicatedPage) return;

    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      // Hover behaviour is intentionally mouse/trackpad only.
      // Touch continues to pass through to the underlying application.
      if (event.pointerType && event.pointerType !== "mouse") return;

      const robotRect = robotRef.current?.getBoundingClientRect();
      const bubbleRect = bubbleRef.current?.getBoundingClientRect();

      const overRobot = robotRect
        ? containsPoint(robotRect, event.clientX, event.clientY)
        : false;

      const overVisibleBubble =
        visibleRef.current && bubbleRect
          ? containsPoint(bubbleRect, event.clientX, event.clientY)
          : false;

      if (overRobot || overVisibleBubble) {
        clearHideTimer();

        if (!visibleRef.current) {
          setVisible(true);
        }

        return;
      }

      clearHideTimer();

      // Small grace period lets the cursor travel from the robot to
      // the bubble without the bubble disappearing in the gap.
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, 180);
    };

    window.addEventListener("pointermove", onPointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      clearHideTimer();
    };
  }, [dedicatedPage]);

  if (
    adminLoginRoute
    || DEDICATED_TAYQAN_PAGE.test(pathname)
  ) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-20 h-[130px] w-[90px] drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] sm:h-[210px] sm:w-[150px]"
      style={{
        insetInlineStart: "max(0.75rem, env(safe-area-inset-left))",
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <Link
        href={companionHref}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label={t(
          internalAdminAccess
            ? "tayqan.adminCompanionAriaLabel"
            : "tayqan.companionAriaLabel",
        )}
        className="pointer-events-auto relative block h-full w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <span
          ref={bubbleRef}
          aria-hidden="true"
          className={[
            "pointer-events-none absolute bottom-full start-0 mb-2 w-[220px]",
            "rounded-2xl border border-cyan-700/60 bg-slate-950/95",
            "px-3 py-2 text-start text-xs text-cyan-100",
            "shadow-xl backdrop-blur transition-all duration-150",
            bubbleVisible
              ? "scale-100 opacity-100"
              : "scale-95 opacity-0",
          ].join(" ")}
        >
          <span className="block font-medium">
            {t(
              internalAdminAccess
                ? "tayqan.adminHoverMessage"
                : "tayqan.hoverMessage",
            )}
          </span>

          <span className="mt-1 inline-flex font-semibold text-cyan-300">
            {t(
              internalAdminAccess
                ? "tayqan.adminAccessBadge"
                : "tayqan.companionAriaLabel",
            )} →
          </span>
        </span>

        <div
          ref={robotRef}
          aria-hidden="true"
          className="h-full w-full"
        >
          <TayqanRobotCanvas
            compact
            cameraDistance={4.4}
            fov={30}
            scale={1.05}
          />
        </div>
      </Link>
    </div>
  );
}
