import type { Metadata } from "next";
import type { ReactNode } from "react";
import ConditionalAppShell from "@/components/layout/conditional-app-shell";
import { THEME_MODE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantara AI BOQ",
  description: "Enterprise quantity intelligence dashboard foundation.",
};

/**
 * Runs synchronously before first paint, on every page (theme.ts's own
 * functions are only ever invoked from the /settings page, so nothing else
 * applies a saved preference on load without this). Mirrors
 * getSavedThemeMode()/applyThemeMode() in src/lib/theme.ts exactly — keep
 * both in sync. Must stay plain, dependency-free JS: it executes before any
 * bundle loads.
 */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var KEY = ${JSON.stringify(THEME_MODE_KEY)};
    function getMode() {
      var stored = window.localStorage.getItem(KEY);
      return (stored === "light" || stored === "dark" || stored === "system") ? stored : "light";
    }
    var mql = window.matchMedia("(prefers-color-scheme: dark)");
    function resolve(mode) {
      return mode === "system" ? (mql.matches ? "dark" : "light") : mode;
    }
    function apply(mode) {
      document.documentElement.setAttribute("data-theme", resolve(mode));
    }
    apply(getMode());
    mql.addEventListener("change", function () {
      if (getMode() === "system") apply("system");
    });
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ConditionalAppShell>{children}</ConditionalAppShell>
      </body>
    </html>
  );
}
