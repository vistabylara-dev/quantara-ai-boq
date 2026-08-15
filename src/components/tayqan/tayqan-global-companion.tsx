"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { TayqanFallback } from "./tayqan-fallback";

const TayqanRobotCanvas = dynamic(() => import("./tayqan-robot-canvas"), {
  ssr: false,
  loading: () => <TayqanFallback compact />,
});

const DEDICATED_TAYQAN_PAGE = /^\/projects\/[^/]+\/tayqan(\/|$)/;

function containsPoint(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Global TAYQAN companion.
 *
 * Important interaction contract:
 *
 * - The ROBOT itself remains pointer-events-none and can never intercept
 *   BOQ controls, navigation, forms, Save, Lock, Generate, dialogs, etc.
 *
 * - Hover detection is performed from window pointer coordinates against
 *   the robot's visual bounding box. Therefore we do not need to make the
 *   WebGL canvas clickable merely to detect hover.
 *
 * - The speech bubble becomes interactive only while visible.
 *
 * - The visible bubble routes to the user project workspace.
 *
 * - TAYQAN-specific commercial checkout belongs inside the TAYQAN hire workflow.
 *
 * No Stripe or general SaaS pricing route is owned by this component.
 */
export function TayqanGlobalCompanion() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations();

  const robotRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLAnchorElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const visibleRef = useRef(false);

  const [bubbleVisible, setBubbleVisible] = useState(false);

  const dedicatedPage = DEDICATED_TAYQAN_PAGE.test(pathname);

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

  if (DEDICATED_TAYQAN_PAGE.test(pathname)) return null;

  return (
    <div
      className="pointer-events-none fixed z-20 h-[130px] w-[90px] drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] sm:h-[210px] sm:w-[150px]"
      style={{
        insetInlineStart: "max(0.75rem, env(safe-area-inset-left))",
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <Link
        ref={bubbleRef}
        href="/projects"
        tabIndex={bubbleVisible ? 0 : -1}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label={t("tayqan.companionAriaLabel")}
        className={[
          "absolute bottom-full start-0 mb-2 w-[220px]",
          "rounded-2xl border border-cyan-700/60 bg-slate-950/95",
          "px-3 py-2 text-start text-xs text-cyan-100",
          "shadow-xl backdrop-blur transition-all duration-150",
          bubbleVisible
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        ].join(" ")}
      >
        <span className="block font-medium">
          {t("tayqan.hoverMessage")}
        </span>

        <span className="mt-1 inline-flex font-semibold text-cyan-300">
          {t("tayqan.companionAriaLabel")} →
        </span>
      </Link>

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
    </div>
  );
}
