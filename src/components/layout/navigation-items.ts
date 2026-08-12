import type { TranslationKey } from "@/lib/i18n/translate";

export type NavigationItem = { labelKey: TranslationKey; href: string };

/**
 * Single source of truth for the app-shell's navigation — previously
 * duplicated (and inconsistently, with different items) across
 * sidebar.tsx, app-shell.tsx, and mobile-navigation.tsx. No hrefs changed
 * from what any of those three lists already used. labelKey resolves via
 * useTranslations() at render time in each consumer — never a raw string,
 * so English and Arabic share this exact one list.
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  { labelKey: "navigation.dashboard", href: "/dashboard" },
  { labelKey: "navigation.projects", href: "/projects" },
  { labelKey: "navigation.clients", href: "/clients" },
  { labelKey: "navigation.industries", href: "/industries" },
  { labelKey: "navigation.integrations", href: "/integrations" },
  { labelKey: "navigation.dataLibrary", href: "/data-library" },
  { labelKey: "navigation.companyLibrary", href: "/company-library" },
  { labelKey: "navigation.marketplace", href: "/marketplace" },
  { labelKey: "navigation.imports", href: "/imports" },
  { labelKey: "navigation.catalogue", href: "/catalogue" },
  { labelKey: "navigation.suppliers", href: "/suppliers" },
  { labelKey: "navigation.templates", href: "/templates" },
  { labelKey: "navigation.settings", href: "/settings" },
];
