"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Group } from "three";

/** Optimized delivery asset — see public/models/tayqan/README.md for provenance and the optimization pipeline. The original Meshy AI export lives outside the web bundle. */
export const TAYQAN_MODEL_URL = "/models/tayqan/tayqan-web.glb";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

/**
 * TAYQAN-2A — public/models/tayqan/tayqan.glb (the Meshy AI source export)
 * has no skeleton and no animation clips at all ("No animations found",
 * verified with `gltf-transform inspect`). Per the rule against fabricating
 * animation names, this never references a clip by name — it applies only a
 * subtle, code-driven idle bob/turn, and skips even that under
 * prefers-reduced-motion.
 */
export function TayqanRobotModel({ paused = false, scale = 1 }: { paused?: boolean; scale?: number }) {
  const { scene } = useGLTF(TAYQAN_MODEL_URL);
  const group = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state) => {
    if (!group.current || paused || reducedMotion) return;
    const elapsed = state.clock.getElapsedTime();
    group.current.position.y = Math.sin(elapsed * 0.9) * 0.03;
    group.current.rotation.y = Math.sin(elapsed * 0.35) * 0.09;
  });

  return (
    <group ref={group} dispose={null} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(TAYQAN_MODEL_URL);
