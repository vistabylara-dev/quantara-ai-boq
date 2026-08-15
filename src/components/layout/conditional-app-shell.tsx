"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PUBLIC_WEBSITE_PATHS } from "@/lib/public-site/public-route-paths";
import HelpFeedbackBubble from "@/components/support/help-feedback-bubble";
import { TayqanGlobalCompanion } from "@/components/tayqan/tayqan-global-companion";

const AppShell = dynamic(() => import("./app-shell"));

const PUBLIC_UTILITY_ROUTES = [
  "/register",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
] as const;

const PUBLIC_SHELL_ROUTES = new Set<string>([
  ...PUBLIC_WEBSITE_PATHS,
  ...PUBLIC_UTILITY_ROUTES,
]);

/**
 * The client proposal portal (/proposal/*) is a separate, unauthenticated,
 * light-themed surface — it must never render the internal dashboard chrome
 * (sidebar, top nav, application links). Everything else keeps AppShell
 * unchanged.
 */
export default function ConditionalAppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const currentRoute = pathname || "/";

  if (
    pathname?.startsWith("/proposal") ||
    pathname?.startsWith("/technical-report")
  ) {
    return <>{children}</>;
  }

  if (PUBLIC_SHELL_ROUTES.has(currentRoute)) {
    return (
      <>
        {children}
        <HelpFeedbackBubble
          surface="PUBLIC"
          currentRoute={currentRoute}
        />
        <TayqanGlobalCompanion surface="PUBLIC" />
      </>
    );
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      <HelpFeedbackBubble
        surface="SAAS"
        currentRoute={currentRoute}
      />
      <TayqanGlobalCompanion surface="SAAS" />
    </>
  );
}
