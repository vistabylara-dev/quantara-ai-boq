import type { Metadata } from "next";
import type { ReactNode } from "react";
import ConditionalAppShell from "@/components/layout/conditional-app-shell";
import { THEME_MODE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Quantara",
    default: "Quantara: Plain-English Financial Insights for Small Businesses",
  },
  description: "Connect QuickBooks or Xero and turn business financial reports into clear explanations, cash-flow warnings and practical next steps with Quantara.",
  keywords: ["Financial Insights", "Small Business Finance", "QuickBooks integration", "Xero integration", "Cash flow analysis", "Financial Co-pilot"],
  authors: [{ name: "Vista By Lara", url: "https://quantara.vistabylara.com" }],
  creator: "Vista By Lara",
  publisher: "Vista By Lara",
  openGraph: {
    title: "Quantara: Plain-English Financial Insights for Small Businesses",
    description: "Connect QuickBooks or Xero and turn business financial reports into clear explanations, cash-flow warnings and practical next steps with Quantara.",
    url: "https://quantara.vistabylara.com",
    siteName: "Quantara",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantara: Plain-English Financial Insights for Small Businesses",
    description: "Connect QuickBooks or Xero and turn business financial reports into clear explanations.",
    creator: "@vistabylara",
  },
  alternates: {
    canonical: "https://quantara.vistabylara.com",
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
