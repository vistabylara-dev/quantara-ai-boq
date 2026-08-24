import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import ConditionalAppShell from "@/components/layout/conditional-app-shell";
import { THEME_MODE_KEY } from "@/lib/theme";
import { DEFAULT_LOCALE, directionForLocale } from "@/lib/i18n/config";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import {
  PUBLIC_PATHNAME_HEADER,
  isEnglishOnlyPublicWebsitePath,
  isPublicWebsitePath,
} from "@/lib/public-site/public-route-paths";
import "./globals.css";

const GOOGLE_TAG_MANAGER_ID = "GTM-5BNVQ8MV";

const GOOGLE_CONSENT_DEFAULT_SCRIPT = `
window.dataLayer = window.dataLayer || [];
window.gtag = function(){window.dataLayer.push(arguments);};
var storedConsent = null;
try { storedConsent = window.localStorage.getItem('quantara-analytics-consent'); } catch (e) {}
window.gtag('consent', 'default', {
  analytics_storage: storedConsent === 'granted' ? 'granted' : 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
`;

const GOOGLE_TAG_MANAGER_SCRIPT = `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GOOGLE_TAG_MANAGER_ID}');
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://quantara.vistabylara.com"),
  title: {
    template: "%s | Quantara",
    default: "Quantara AI BOQ: Create and Deliver Professional BOQs",
  },
  description: "Create and deliver professional BOQs with AI-assisted preparation, full engineer control, guided measurement, visible calculations, rates, revisions and outputs.",
  keywords: ["AI BOQ software", "BOQ software UAE", "Bill of Quantities", "Construction Estimating", "Quantity Surveying", "Professional BOQ Creation", "Quantity Calculation"],
  authors: [{ name: "Vista By Lara", url: "https://www.vistabylara.com" }],
  creator: "Vista By Lara",
  publisher: "Vista By Lara",
  openGraph: {
    title: "Quantara AI BOQ: Create and Deliver Professional BOQs",
    description: "Use AI where supported and full engineer-controlled workflows everywhere else to create, calculate, review and deliver professional BOQs.",
    url: "https://quantara.vistabylara.com",
    siteName: "Quantara",
    locale: "en_AE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantara AI BOQ: Create and Deliver Professional BOQs",
    description: "Use AI-assisted preparation and full professional controls to create, calculate, review and deliver professional BOQs.",
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
  const requestHeaders = await headers();
  const requestPathname = requestHeaders.get(PUBLIC_PATHNAME_HEADER);
  const isPublicWebsite = isPublicWebsitePath(requestPathname);
  const isEnglishOnlyPublicWebsite = isEnglishOnlyPublicWebsitePath(
    requestPathname,
  );
  const persistedLocale = await getServerLocale();
  const locale = isEnglishOnlyPublicWebsite ? DEFAULT_LOCALE : persistedLocale;
  const direction = directionForLocale(locale);
  const documentLanguage = isPublicWebsite && locale === DEFAULT_LOCALE
    ? "en-AE"
    : locale;

  return (
    // Bespoke public pages without an approved Arabic translation stay
    // en-AE/ltr on the first response. Localized public and authenticated
    // routes use the persisted locale. THEME_INIT_SCRIPT separately sets
    // data-theme before hydration because it depends on localStorage.
    <html lang={documentLanguage} dir={direction} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GOOGLE_CONSENT_DEFAULT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: GOOGLE_TAG_MANAGER_SCRIPT }} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <LocaleProvider initialLocale={locale}>
          <ConditionalAppShell>{children}</ConditionalAppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
