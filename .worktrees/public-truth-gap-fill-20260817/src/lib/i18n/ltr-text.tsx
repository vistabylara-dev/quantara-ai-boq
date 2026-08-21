import type { ReactNode } from "react";

/**
 * Wraps engineering/technical values (item codes, quantities, formulas,
 * prices, filenames, emails, URLs, reference IDs) that must stay
 * left-to-right even inside an RTL page — `dir="ltr"` plus `unicode-bidi:
 * isolate` (via `isolate`) keeps the value from being reordered or having
 * its punctuation/decimal points repositioned by the surrounding RTL
 * paragraph, without affecting the direction of anything around it.
 */
export function LtrText({ children, className = "", as: Component = "span" }: {
  children: ReactNode;
  className?: string;
  as?: "span" | "div" | "td" | "code";
}) {
  return (
    <Component dir="ltr" style={{ unicodeBidi: "isolate" }} className={className || undefined}>
      {children}
    </Component>
  );
}
