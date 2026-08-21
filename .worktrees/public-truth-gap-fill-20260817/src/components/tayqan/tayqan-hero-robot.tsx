"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { TayqanFallback } from "./tayqan-fallback";
import { TayqanSpeechBubble } from "./tayqan-speech-bubble";

const TayqanRobotCanvas = dynamic(() => import("./tayqan-robot-canvas"), {
  ssr: false,
  loading: () => <TayqanFallback />,
});

/**
 * TAYQAN-2A — the large full-body robot for the dedicated TAYQAN page hero
 * only (src/app/projects/[projectId]/tayqan/page.tsx). The global compact
 * companion is intentionally hidden on that same page — see
 * tayqan-global-companion.tsx — so this is the only place the full-body
 * model renders. Purely decorative (the real Hire action is the page's own
 * form/buttons below), so this stays aria-hidden and out of the tab order —
 * the hover bubble is a bonus for mouse users, not a second CTA mechanism.
 */
export function TayqanHeroRobot() {
  const t = useTranslations();

  return (
    <div aria-hidden="true" className="group relative h-[360px] w-full md:h-[560px] lg:h-[620px]">
      <TayqanSpeechBubble message={t("tayqan.hoverMessage")} placement="above" />
      <TayqanRobotCanvas cameraDistance={3.4} fov={35} />
    </div>
  );
}
