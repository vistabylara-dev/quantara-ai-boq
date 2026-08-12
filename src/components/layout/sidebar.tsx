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
      className={`hidden xl:flex xl:flex-col xl:gap-6 xl:border-r xl:border-white/10 xl:py-8 bg-black/40 backdrop-blur-xl text-slate-300 transition-[width] relative z-20 cyber-border ${
        collapsed ? "xl:w-20 xl:px-3" : "xl:w-72 xl:px-6"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-6 mb-2">
        {!collapsed && (
          <div className="space-y-1">
            <p className="terminal-text text-[9px] uppercase tracking-[0.4em] text-[#00F0FF]">System Active</p>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="h-6 w-auto object-contain" />
              <h2 className="text-xl font-bold text-white tracking-widest uppercase">Quantara AI</h2>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={collapsed}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-white/10 text-slate-500 hover:bg-[#00F0FF]/10 hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-all focus-visible:outline-none"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto" aria-label="Primary">
        {GROUPS.map((group) => {
          const groupItems = group.hrefs.map((href) => itemsByHref.get(href)).filter((item): item is NonNullable<typeof item> => Boolean(item));
          if (groupItems.length === 0) return null;
          return (
            <div key={group.label} className="flex flex-col gap-2">
              {!collapsed && (
                <p className="px-3 terminal-text text-[10px] uppercase tracking-[0.3em] text-slate-600 mb-2">{group.label}</p>
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
                    className={`group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-all focus-visible:outline-none ${
                      isActive
                        ? "bg-[#00F0FF]/10 text-[#00F0FF]"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#00F0FF] shadow-[0_0_10px_#00F0FF]" aria-hidden="true" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="font-medium tracking-wide">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="relative overflow-hidden border border-[#00F0FF]/20 bg-[#00F0FF]/5 p-5 text-sm mt-4 cyber-panel">
          <span className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#00F0FF]/10 animate-pulse" aria-hidden="true" />
          <p className="font-bold text-[#00F0FF] uppercase tracking-widest text-[11px] mb-2">Engine Status</p>
          <div className="flex items-center gap-2 text-xs text-slate-400 terminal-text">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span>
            All systems nominal
          </div>
        </div>
      )}
    </aside>
  );
}
