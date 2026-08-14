/**
 * TAYQAN-2A — rendered whenever the 3D robot cannot be shown: WebGL is
 * unsupported, context creation failed, the GLB failed to load, or the
 * chunk is still loading. Quantara (and TAYQAN's own identity) must never
 * depend on this succeeding — this is plain markup, no WebGL involved.
 *
 * Deliberately no background panel/border here (matches the transparent,
 * "cutout" feel of the real 3D render) — legibility against any page
 * background comes from a drop-shadow on the text itself, not an opaque
 * plate behind it.
 */
export function TayqanFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span
        className={
          compact
            ? "text-xs font-bold uppercase tracking-[0.2em] text-cyan-300 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]"
            : "text-2xl font-bold uppercase tracking-[0.3em] text-cyan-200 [text-shadow:0_2px_10px_rgba(0,0,0,0.8)]"
        }
      >
        TAYQAN
      </span>
    </div>
  );
}
