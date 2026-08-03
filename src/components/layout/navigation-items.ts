export type NavigationItem = { label: string; href: string };

/**
 * Single source of truth for the app-shell's navigation — previously
 * duplicated (and inconsistently, with different items) across
 * sidebar.tsx, app-shell.tsx, and mobile-navigation.tsx. No hrefs changed
 * from what any of those three lists already used.
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Clients", href: "/clients" },
  { label: "Industries", href: "/industries" },
  { label: "Data Library", href: "/data-library" },
  { label: "Company Library", href: "/company-library" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Imports", href: "/imports" },
  { label: "Catalogue", href: "/catalogue" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Templates", href: "/templates" },
  { label: "Settings", href: "/settings" },
];
