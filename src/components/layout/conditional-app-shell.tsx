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
  const publicRoutes = [
    "/", "/features", "/about", "/privacy", "/terms", "/security", "/contact-sales", 
    "/register", "/login", "/forgot-password", "/reset-password", "/verify-email",
    "/cookie-policy", "/acceptable-use", "/subprocessors", "/data-processing",
    "/ai-boq-software", "/boq-software", "/construction-estimating-software", 
    "/boq-management", "/pdf-boq-extraction", "/scanned-pdf-boq", 
    "/quantity-surveying-software", "/boq-document-generation",
    "/resources", "/what-is-a-boq", "/boq-vs-construction-estimate", 
    "/boq-vs-bill-of-materials", "/how-to-prepare-a-boq", "/boq-review-checklist", 
    "/common-boq-errors", "/boq-revision-control", "/how-to-convert-pdf-boq-to-excel", 
    "/text-pdf-vs-scanned-pdf", "/ocr-for-boq-documents", "/how-to-review-ai-extracted-boq", 
    "/quantity-takeoff-vs-boq-management"
  ];
  
  if (
    pathname?.startsWith("/proposal") ||
    pathname?.startsWith("/technical-report") ||
    publicRoutes.includes(pathname || "")
  ) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
