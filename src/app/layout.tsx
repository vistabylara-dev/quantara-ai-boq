import type { Metadata } from "next";
import type { ReactNode } from "react";
import ConditionalAppShell from "@/components/layout/conditional-app-shell";
import { THEME_MODE_KEY } from "@/lib/theme";
import { directionForLocale } from "@/lib/i18n/config";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale();
  const direction = directionForLocale(locale);

  return (
    // lang/dir are read from the persisted cookie server-side (see
    // get-server-locale.ts) — correct on the FIRST response, never a
    // post-hydration flip. THEME_INIT_SCRIPT separately sets data-theme on
    // this element before React hydrates (see its own comment above) — the
    // server can never render that attribute since it depends on the
    // client's localStorage, so that one mismatch is expected/intentional.
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <LocaleProvider initialLocale={locale}>
          <ConditionalAppShell>{children}</ConditionalAppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
