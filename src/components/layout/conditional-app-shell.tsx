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
    '/',
    '/about',
    '/features',
    '/contact-sales',
    '/what-is-a-boq',
    '/boq-vs-construction-estimate',
    '/boq-vs-bill-of-materials',
    '/how-to-prepare-a-boq',
    '/boq-review-checklist',
    '/common-boq-errors',
    '/boq-revision-control',
    '/how-to-convert-pdf-boq-to-excel',
    '/text-pdf-vs-scanned-pdf',
    '/ocr-for-boq-documents',
    '/how-to-review-ai-extracted-boq',
    '/quantity-takeoff-vs-boq-management',
    '/industries',
    '/boq-software-for-contractors',
    '/boq-software-for-quantity-surveyors',
    '/boq-software-for-mep-contractors',
    '/boq-software-for-hvac-contractors',
    '/boq-software-for-fit-out-companies',
    '/boq-software-for-fire-fighting-contractors',
    '/boq-software-for-facilities-management',
    '/boq-software-for-engineering-consultants',
    '/gcc-boq-software',
    '/boq-software-uae',
    '/boq-software-dubai',
    '/boq-software-abu-dhabi',
    '/construction-estimating-software-uae',
    '/mep-estimating-software-uae',
    '/boq-software-saudi-arabia',
    '/boq-software-qatar',
    '/boq-software-oman',
    '/comparisons',
    '/quantara-vs-excel-for-boq',
    '/boq-software-vs-spreadsheets',
    '/ai-boq-vs-manual-boq-preparation',
    '/ocr-vs-structured-boq-extraction',
    '/quantity-takeoff-vs-boq-software',
    '/boq-software-vs-document-management',
    '/construction-estimating-software-vs-excel',
    '/when-to-use-boq-software',
    '/register',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/cookie-policy',
    '/acceptable-use',
    '/subprocessors',
    '/data-processing',
    '/ai-boq-software',
    '/boq-software',
    '/construction-estimating-software',
    '/boq-management',
    '/pdf-boq-extraction',
    '/scanned-pdf-boq',
    '/quantity-surveying-software',
    '/boq-document-generation',
    '/resources',
    '/privacy',
    '/terms',
    '/security',
    '/site-map'
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
