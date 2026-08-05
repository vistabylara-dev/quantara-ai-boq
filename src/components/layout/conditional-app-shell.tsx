"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "./app-shell";

/**
 * The client proposal portal (/proposal/*) is a separate, unauthenticated,
 * light-themed surface — it must never render the internal dashboard chrome
 * (sidebar, top nav, application links). Everything else keeps AppShell
 * unchanged.
 */
export default function ConditionalAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const publicRoutes = ["/", "/features", "/privacy", "/terms", "/security", "/contact-sales", "/register", "/login", "/forgot-password", "/reset-password", "/verify-email"];
  
  if (
    pathname?.startsWith("/proposal") ||
    publicRoutes.includes(pathname || "") ||
    (pathname && ["/cookie-policy", "/acceptable-use", "/subprocessors", "/data-processing"].includes(pathname))
  ) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
