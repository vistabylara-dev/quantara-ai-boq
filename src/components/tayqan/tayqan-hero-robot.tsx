"use client";

import dynamic from "next/dynamic";
import { TayqanFallback } from "./tayqan-fallback";

const TayqanRobotCanvas = dynamic(() => import("./tayqan-robot-canvas"), {
  ssr: false,
  loading: () => <TayqanFallback />,
});

/**
 * TAYQAN-2A — the large full-body robot for the dedicated TAYQAN page hero
 * only (src/app/projects/[projectId]/tayqan/page.tsx). The global compact
 * companion is intentionally hidden on that same page — see
 * tayqan-global-companion.tsx — so this is the only place the full-body
 * model renders.
 */
export function TayqanHeroRobot() {
  return (
    <div aria-hidden="true" className="h-[360px] w-full md:h-[560px] lg:h-[620px]">
      <TayqanRobotCanvas cameraDistance={3.4} fov={35} />
    </div>
  );
}
