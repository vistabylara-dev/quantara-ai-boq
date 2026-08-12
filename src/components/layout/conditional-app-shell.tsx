"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "./app-shell";

/**
 * Public marketing pages and unauthenticated portals must never render the 
 * internal dashboard chrome (sidebar, top nav, application links). 
 * Everything else keeps AppShell unchanged.
 */
export default function ConditionalAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  const isPublicRoute = 
    pathname === "/" || 
    pathname?.startsWith("/proposal") || 
    pathname?.startsWith("/login") || 
    pathname?.startsWith("/register") ||
    pathname?.startsWith("/forgot-password") ||
    pathname?.startsWith("/reset-password") ||
    pathname?.startsWith("/privacy") ||
    pathname?.startsWith("/terms") ||
    pathname?.startsWith("/security") ||
    pathname?.startsWith("/features") ||
    pathname?.startsWith("/methodology") ||
    pathname?.startsWith("/limitations") ||
    pathname?.startsWith("/about");

  if (isPublicRoute) {
    return <>{children}</>;
  }
  
  return <AppShell>{children}</AppShell>;
}
