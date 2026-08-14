/**
 * TAYQAN-2A — rendered whenever the 3D robot cannot be shown: WebGL is
 * unsupported, context creation failed, the GLB failed to load, or the
 * chunk is still loading. Quantara (and TAYQAN's own identity) must never
 * depend on this succeeding — this is plain markup, no WebGL involved.
 */
export function TayqanFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex h-full w-full items-center justify-center rounded-[2rem] border border-cyan-800/70 bg-slate-950/80"
          : "flex h-full w-full items-center justify-center rounded-[32px] border border-cyan-900 bg-cyan-950/10"
      }
    >
      <span
        className={
          compact
            ? "text-xs font-bold uppercase tracking-[0.2em] text-cyan-300"
            : "text-2xl font-bold uppercase tracking-[0.3em] text-cyan-200"
        }
      >
        TAYQAN
      </span>
    </div>
  );
}
