"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { TayqanFallback } from "./tayqan-fallback";

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
 * Purely decorative: pointer-events-none on the whole container, no
 * link/button/onClick, aria-hidden — it can never intercept a click meant
 * for the sidebar, forms, BOQ controls, Save/Generate, navigation, tables,
 * dialogs, or any other CTA underneath or beside it, regardless of where it
 * lands on a given page/viewport. The hover speech bubble lives on the
 * hero robot only (see tayqan-hero-robot.tsx) — a click-through element
 * can't reliably show a CSS :hover state anyway, and workflow safety wins
 * over that one nice-to-have here.
 *
 * Positioned at the opposite fixed corner from HelpFeedbackBubble
 * (bottom-end); safe-area aware so it never sits under a notch/home
 * indicator. No background card/border around the robot itself — a
 * transparent Canvas (see tayqan-robot-canvas) is what gives the "floating
 * cutout" feel; the drop-shadow class is for legibility only, not a panel.
 */
export function TayqanGlobalCompanion() {
  const pathname = usePathname() ?? "/";

  if (DEDICATED_TAYQAN_PAGE.test(pathname)) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-20 h-[130px] w-[90px] drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] sm:h-[210px] sm:w-[150px]"
      style={{
        insetInlineStart: "max(0.75rem, env(safe-area-inset-left))",
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <TayqanRobotCanvas compact cameraDistance={4.4} fov={30} scale={1.05} />
    </div>
  );
}
