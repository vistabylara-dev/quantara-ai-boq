/**
 * TAYQAN-2A — a hover/focus-revealed speech bubble for the robot. Pure CSS
 * visibility (group-hover/group-focus-within/group-active) — the nearest
 * ancestor with `className="group"` controls when this shows, so it works
 * for mouse hover, keyboard focus, and a touch tap (via :active) without
 * any extra JS state. Never intercepts pointer events itself so it can
 * never block a click on whatever it's layered over.
 */
export function TayqanSpeechBubble({ message, placement = "above" }: { message: string; placement?: "above" | "side" }) {
  // Start-anchored (not centered) so it never clips off-screen for a
  // trigger sitting near the viewport edge, like the bottom-start global
  // companion.
  const positionClassName =
    placement === "above"
      ? "bottom-full start-0 mb-2"
      : "bottom-1/2 start-full ms-2 translate-y-1/2";

  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute ${positionClassName} z-10 w-max max-w-[220px] scale-95 rounded-2xl border border-cyan-700/60 bg-slate-950/95 px-3 py-2 text-center text-xs font-medium text-cyan-100 opacity-0 shadow-xl backdrop-blur transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100`}
    >
      {message}
    </div>
  );
}
