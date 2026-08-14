/**
 * TAYQAN-2A — checked once before ever attempting to mount a Canvas.
 * Skipping context creation entirely when WebGL is unsupported avoids the
 * failure mode altogether rather than relying on catching it after the
 * fact.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}
