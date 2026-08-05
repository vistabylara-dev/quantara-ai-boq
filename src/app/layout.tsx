import type { Metadata } from "next";
import type { ReactNode } from "react";
import ConditionalAppShell from "@/components/layout/conditional-app-shell";
import { THEME_MODE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://quantara.vistabylara.com"),
  title: {
    template: "%s | Quantara",
    default: "Quantara: AI BOQ and Construction Estimating Platform",
  },
  description: "Create structured BOQs, organize project items, manage templates and pricing data, and generate professional construction documents with Quantara.",
  keywords: ["BOQ", "Construction Estimating", "Quantity Surveying", "Project Extraction", "Construction Intelligence"],
  authors: [{ name: "Quantara", url: "https://quantara.vistabylara.com" }],
  creator: "Quantara",
  publisher: "Quantara",
  openGraph: {
    title: "Quantara: AI BOQ and Construction Estimating Platform",
    description: "Create structured BOQs, organize project items, manage templates and pricing data, and generate professional construction documents with Quantara.",
    url: "https://quantara.vistabylara.com",
    siteName: "Quantara",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantara: AI BOQ and Construction Estimating Platform",
    description: "Create structured BOQs, organize project items, manage templates and pricing data, and generate professional construction documents with Quantara.",
    creator: "@quantara",
  },
  alternates: {
    canonical: "/",
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://quantara.vistabylara.com/#organization",
              "name": "Vista By Lara",
              "url": "https://quantara.vistabylara.com/",
              "logo": "https://quantara.vistabylara.com/logo.png",
              "email": "solution@vistabylara.com",
              "telephone": "+971507994292"
            },
            {
              "@type": "WebSite",
              "@id": "https://quantara.vistabylara.com/#website",
              "url": "https://quantara.vistabylara.com/",
              "name": "Quantara",
              "publisher": { "@id": "https://quantara.vistabylara.com/#organization" }
            }
          ]
        }) }} />
        <ConditionalAppShell>
          <main>{children}</main>
        </ConditionalAppShell>
      </body>
    </html>
  );
}
