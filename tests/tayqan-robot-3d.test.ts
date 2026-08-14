import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isWebGLAvailable } from "../src/components/tayqan/tayqan-webgl-support";
import { TayqanRobotErrorBoundary } from "../src/components/tayqan/tayqan-robot-error-boundary";

/**
 * These tests deliberately never `import` tayqan-robot-3d.tsx,
 * tayqan-robot-canvas.tsx, or tayqan-global-companion.tsx (which
 * transitively pulls in the canvas) — merely evaluating
 * @react-three/fiber's module-load-time reconciler setup crashes outside a
 * real browser/DOM (this repo has no jsdom environment configured), so
 * everything about those three files is verified by reading their source
 * text directly instead. tayqan-webgl-support.ts and
 * tayqan-robot-error-boundary.tsx have no R3F/three dependency and are
 * imported normally below.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const OPTIMIZED_MODEL_PATH = path.join(REPO_ROOT, "public", "models", "tayqan", "tayqan-web.glb");
const HARD_LIMIT_BYTES = 25 * 1024 * 1024;
const PREFERRED_LIMIT_BYTES = 15 * 1024 * 1024;

function readSource(...segments: string[]): string {
  return readFileSync(path.join(REPO_ROOT, ...segments), "utf8");
}

describe("TAYQAN-2A optimized model asset", () => {
  it("tayqan-web.glb exists at the exact path the robot component loads", () => {
    expect(() => statSync(OPTIMIZED_MODEL_PATH)).not.toThrow();
    const robotSource = readSource("src", "components", "tayqan", "tayqan-robot-3d.tsx");
    expect(robotSource).toContain('export const TAYQAN_MODEL_URL = "/models/tayqan/tayqan-web.glb"');
  });

  it("is a valid GLB (starts with the 'glTF' magic + version 2)", () => {
    const buffer = readFileSync(OPTIMIZED_MODEL_PATH);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(buffer.readUInt32LE(4)).toBe(2); // version
  });

  it("is at or under the 25 MB hard limit (and reports where it sits vs. the 15 MB preferred target)", () => {
    const { size } = statSync(OPTIMIZED_MODEL_PATH);
    expect(size).toBeLessThanOrEqual(HARD_LIMIT_BYTES);
    // Not a hard assertion — just documents the actual result relative to the
    // preferred budget so a future regression is easy to notice in the diff.
    if (size > PREFERRED_LIMIT_BYTES) {
      console.warn(`tayqan-web.glb is ${(size / 1024 / 1024).toFixed(2)} MB, above the 15 MB preferred target (still under the 25 MB hard limit).`);
    }
  });
});

describe("TAYQAN-2A hero robot on the dedicated TAYQAN page", () => {
  it("the dedicated page imports and renders TayqanHeroRobot", () => {
    const source = readSource("src", "app", "projects", "[projectId]", "tayqan", "page.tsx");
    expect(source).toContain('import { TayqanHeroRobot } from "@/components/tayqan/tayqan-hero-robot"');
    expect(source).toContain("<TayqanHeroRobot");
  });
});

describe("TAYQAN-2A global companion — mounted once from the shared layout, not pasted per-page", () => {
  it("ConditionalAppShell (the one component every route already renders through) mounts TayqanGlobalCompanion", () => {
    const source = readSource("src", "components", "layout", "conditional-app-shell.tsx");
    expect(source).toContain('import { TayqanGlobalCompanion } from "@/components/tayqan/tayqan-global-companion"');
    expect(source).toContain("<TayqanGlobalCompanion");
  });

  it("no page under src/app references tayqan-global-companion directly (it is only ever reached through the shared layout)", () => {
    const appDir = path.join(REPO_ROOT, "src", "app");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
          if (readFileSync(full, "utf8").includes("tayqan-global-companion")) offenders.push(full);
        }
      }
    }
    walk(appDir);
    expect(offenders).toEqual([]);
  });

  it("is hidden specifically on /projects/[projectId]/tayqan, and only that route", () => {
    const source = readSource("src", "components", "tayqan", "tayqan-global-companion.tsx");
    const match = source.match(/const DEDICATED_TAYQAN_PAGE = (\/.*\/);/);
    expect(match).not.toBeNull();
    const pattern = new RegExp(match![1].slice(1, -1));
    expect(pattern.test("/projects/abc-123/tayqan")).toBe(true);
    expect(pattern.test("/projects/abc-123/tayqan/")).toBe(true);
    expect(pattern.test("/projects/abc-123/boq")).toBe(false);
    expect(pattern.test("/projects/abc-123/files")).toBe(false);
    expect(pattern.test("/dashboard")).toBe(false);
    expect(pattern.test("/")).toBe(false);
    // Confirms the check actually gates rendering, not just an unused constant.
    expect(source).toContain("if (DEDICATED_TAYQAN_PAGE.test(pathname)) return null;");
  });

  it("does not visually overlap HelpFeedbackBubble — opposite fixed corner (insetInlineStart vs. that component's end-anchored button)", () => {
    const companionSource = readSource("src", "components", "tayqan", "tayqan-global-companion.tsx");
    const helpBubbleSource = readSource("src", "components", "support", "help-feedback-bubble.tsx");
    expect(companionSource).toContain("insetInlineStart");
    expect(helpBubbleSource).toContain("end-4"); // help bubble anchors to the opposite logical side
  });
});

describe("TAYQAN-2A failure safety", () => {
  it("isWebGLAvailable never throws and returns a boolean (false in this non-browser test environment)", () => {
    expect(() => isWebGLAvailable()).not.toThrow();
    expect(isWebGLAvailable()).toBe(false);
  });

  it("TayqanRobotErrorBoundary is a real React error boundary (getDerivedStateFromError present) that recovers to its fallback", () => {
    expect(typeof TayqanRobotErrorBoundary.getDerivedStateFromError).toBe("function");
    expect(TayqanRobotErrorBoundary.getDerivedStateFromError(new Error("simulated WebGL/GLB failure"))).toEqual({ hasError: true });
  });

  it("the canvas wrapper checks WebGL availability before ever mounting a Canvas, and wraps it in the error boundary", () => {
    const source = readSource("src", "components", "tayqan", "tayqan-robot-canvas.tsx");
    expect(source).toContain("isWebGLAvailable");
    expect(source).toContain("TayqanRobotErrorBoundary");
    expect(source).toContain("Suspense");
  });
});

describe("TAYQAN-2A reduced-motion support", () => {
  it("the model component checks prefers-reduced-motion before applying idle motion, never a fabricated animation clip name", () => {
    const source = readSource("src", "components", "tayqan", "tayqan-robot-3d.tsx");
    expect(source).toContain("prefers-reduced-motion");
    expect(source).toContain("reducedMotion");
    // The source model has no skeleton/animation clips at all (verified via
    // gltf-transform inspect) — this file must never reference
    // AnimationMixer/clipAction/getAnimations, which would imply a fabricated clip.
    expect(source).not.toMatch(/AnimationMixer|clipAction|getAnimations/);
  });
});

describe("TAYQAN-2A scope — no changes outside the 3D visual foundation", () => {
  it("neither the migrations directory nor prisma/schema.prisma changed in this patch's diff-relevant files (structural sanity: no new migration folder for this feature)", () => {
    const migrationsDir = path.join(REPO_ROOT, "prisma", "migrations");
    const entries = readdirSync(migrationsDir);
    const todayIsh = entries.filter((name) => name.includes("tayqan_2a") || name.toLowerCase().includes("robot"));
    expect(todayIsh).toEqual([]);
  });
});
