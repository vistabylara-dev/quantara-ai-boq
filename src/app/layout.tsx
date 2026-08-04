import type { Metadata } from "next";
import type { ReactNode } from "react";
import ConditionalAppShell from "@/components/layout/conditional-app-shell";
import { THEME_MODE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Quantara AI BOQ",
    default: "Quantara AI BOQ - Advanced Quantity Intelligence & GEO AI",
  },
  description: "Enterprise-grade AI-powered Bill of Quantities (BOQ) management platform by Vista By Lara. Seamlessly manage projects with advanced Geo AI and structural intelligence.",
  keywords: ["AI BOQ", "Quantity Surveying", "Construction AI", "Geo AI", "Dubai Construction Tech", "Vista By Lara"],
  authors: [{ name: "Vista By Lara", url: "https://www.vistabylara.com" }],
  creator: "Vista By Lara",
  publisher: "Vista By Lara",
  openGraph: {
    title: "Quantara AI BOQ - Advanced Quantity Intelligence",
    description: "Enterprise-grade AI-powered Bill of Quantities (BOQ) management platform by Vista By Lara.",
    url: "https://www.vistabylara.com",
    siteName: "Quantara AI",
    locale: "en_AE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantara AI BOQ",
    description: "Enterprise-grade AI-powered Bill of Quantities (BOQ) management platform.",
    creator: "@vistabylara",
  },
  alternates: {
    canonical: "https://www.vistabylara.com",
  },
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
