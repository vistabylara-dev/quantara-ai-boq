"use client";

import {
  ChevronLeft,
  ChevronRight,
  Database,
  Factory,
  FileText,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Library,
  Plug,
  Settings as SettingsIcon,
  Store,
  Truck,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAVIGATION_ITEMS } from "./navigation-items";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/projects": FolderKanban,
  "/clients": Users,
  "/industries": Factory,
  "/integrations": Plug,
  "/data-library": Database,
  "/company-library": Library,
  "/marketplace": Store,
  "/imports": Upload,
  "/catalogue": Layers,
  "/suppliers": Truck,
  "/templates": FileText,
  "/settings": SettingsIcon,
};

const GROUPS: Array<{ label: string; hrefs: string[] }> = [
  { label: "Workspace", hrefs: ["/dashboard"] },
  { label: "Projects", hrefs: ["/projects", "/clients", "/industries"] },
  { label: "Data & Catalogue", hrefs: ["/integrations", "/data-library", "/company-library", "/marketplace", "/imports", "/catalogue", "/suppliers"] },
  { label: "Documents", hrefs: ["/templates"] },
  { label: "Account", hrefs: ["/settings"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const itemsByHref = new Map(NAVIGATION_ITEMS.map((item) => [item.href, item]));

  return (
    <aside
      className={`hidden xl:flex xl:flex-col xl:gap-6 xl:border-r xl:border-[#D5E0EC] dark:xl:border-[#20304D] xl:py-8 bg-white dark:bg-[#091326] text-[#08152E] dark:text-[#F4F8FF] transition-[width] ${
        collapsed ? "xl:w-20 xl:px-3" : "xl:w-72 xl:px-6"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {!collapsed && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#8CA0BE]">Workspace</p>
            <h2 className="text-xl font-semibold text-[#08152E] dark:text-white">Quantara AI</h2>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={collapsed}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D5E0EC] dark:border-[#20304D] text-[#536078] dark:text-[#8CA0BE] hover:bg-[#EAF1F8] dark:hover:bg-[#101D34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#21C7F3]"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto" aria-label="Primary">
        {GROUPS.map((group) => {
          const groupItems = group.hrefs.map((href) => itemsByHref.get(href)).filter((item): item is NonNullable<typeof item> => Boolean(item));
          if (groupItems.length === 0) return null;
          return (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{group.label}</p>
              )}
              {groupItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const Icon = ICONS[item.href] ?? LayoutDashboard;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#21C7F3] ${
                      isActive
                        ? "bg-[#009FE3]/10 text-[#0077B6] dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]"
                        : "text-[#536078] hover:bg-[#EAF1F8] hover:text-[#08152E] dark:text-[#8CA0BE] dark:hover:bg-[#101D34] dark:hover:text-white"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#009FE3] dark:bg-[#21C7F3]" aria-hidden="true" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="relative overflow-hidden rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] p-4 text-sm">
          <span className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#009FE3]/10 dark:bg-[#21C7F3]/10" aria-hidden="true" />
          <p className="font-semibold text-[#08152E] dark:text-white">Quantara AI Workspace</p>
          <p className="mt-2 text-xs leading-5 text-[#536078] dark:text-[#8CA0BE]">
            AI construction intelligence for BOQs, drawings, and documents.
          </p>
        </div>
      )}
    </aside>
  );
}
