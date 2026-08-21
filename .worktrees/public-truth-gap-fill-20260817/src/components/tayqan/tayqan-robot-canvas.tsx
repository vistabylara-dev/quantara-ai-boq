"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { TayqanFallback } from "./tayqan-fallback";
import { TayqanRobotErrorBoundary } from "./tayqan-robot-error-boundary";
import { TayqanRobotModel } from "./tayqan-robot-3d";
import { isWebGLAvailable } from "./tayqan-webgl-support";

type TayqanRobotCanvasProps = {
  /** Smaller, tighter camera framing for the global companion vs. the full-body page hero. */
  compact?: boolean;
  cameraDistance?: number;
  fov?: number;
  scale?: number;
};

/**
 * TAYQAN-2A — the one shared 3D rendering surface. Always imported via
 * next/dynamic with ssr:false by its callers (tayqan-hero-robot.tsx,
 * tayqan-global-companion.tsx) — three.js/WebGL has no server-side
 * rendering path. Never mounts a Canvas at all when WebGL is unsupported;
 * a render-time failure inside the Canvas is caught by the error boundary
 * instead of taking down the surrounding page.
 */
export default function TayqanRobotCanvas({ compact = false, cameraDistance = 3.4, fov = 35, scale = 1 }: TayqanRobotCanvasProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const fallback = <TayqanFallback compact={compact} />;

  // null = capability not yet checked (first client render); false = unsupported.
  if (webglAvailable !== true) return fallback;

  return (
    <TayqanRobotErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Canvas
          dpr={[1, compact ? 1.25 : 1.5]}
          // compact/global: render once (and on any invalidation, e.g. a
          // resize) and then sit idle — no continuous 60fps loop for a
          // purely decorative corner element. hero: normal continuous loop
          // while the tab is visible, so its idle bob/turn keeps animating.
          frameloop={compact ? "demand" : tabVisible ? "always" : "never"}
          camera={{ position: [0, -0.05, cameraDistance], fov }}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          shadows={false}
          style={{ background: "transparent" }}
          // Three's default clear alpha is 1 even with gl.alpha:true — without
          // this the canvas paints an opaque fill instead of a transparent
          // cutout around the model.
          onCreated={({ gl }) => gl.setClearAlpha(0)}
        >
          <ambientLight intensity={0.75} />
          <directionalLight position={[2, 3, 2]} intensity={1.1} />
          <directionalLight position={[-2, 1, -1.5]} intensity={0.35} />
          <TayqanRobotModel paused={compact || !tabVisible} scale={scale} />
        </Canvas>
      </Suspense>
    </TayqanRobotErrorBoundary>
  );
}
