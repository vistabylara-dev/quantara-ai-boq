"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { TayqanFallback } from "./tayqan-fallback";
import { TayqanSpeechBubble } from "./tayqan-speech-bubble";

const TayqanRobotCanvas = dynamic(() => import("./tayqan-robot-canvas"), {
  ssr: false,
  loading: () => <TayqanFallback compact />,
});

const DEDICATED_TAYQAN_PAGE = /^\/projects\/[^/]+\/tayqan(\/|$)/;

/**
 * TAYQAN-2A — one shared, compact companion mounted once from
 * ConditionalAppShell (never pasted into individual pages), so it follows
 * the same public/authenticated route split that component already
 * enforces. Hidden on /projects/[projectId]/tayqan, which shows the large
 * full-body hero robot instead — never both at once.
 *
 * Positioned at the opposite fixed corner from HelpFeedbackBubble
 * (bottom-end) to avoid overlapping it; safe-area aware so it never sits
 * under a notch/home-indicator. Deliberately no background card/border
 * around the robot itself — a transparent Canvas (see tayqan-robot-canvas)
 * inside a plain, unstyled link is what gives the "floating cutout" feel;
 * only the drop-shadow class here is for legibility against light and dark
 * pages, not a panel.
 */
export function TayqanGlobalCompanion() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations();

  if (DEDICATED_TAYQAN_PAGE.test(pathname)) return null;

  return (
    <div
      className="fixed z-20"
      style={{
        insetInlineStart: "max(0.75rem, env(safe-area-inset-left))",
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <Link
        href="/projects"
        aria-label={t("tayqan.companionAriaLabel")}
        className="group relative block h-[130px] w-[90px] drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 sm:h-[210px] sm:w-[150px]"
      >
        <TayqanSpeechBubble message={t("tayqan.hoverMessage")} placement="above" />
        <TayqanRobotCanvas compact cameraDistance={4.4} fov={30} scale={1.05} />
      </Link>
    </div>
  );
}
