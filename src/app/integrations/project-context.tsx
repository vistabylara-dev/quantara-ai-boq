"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

export type ProjectSourceContext = {
  projectId: string;
  intent: string | null;
  returnTo: string | null;
};

/**
 * A same-origin, relative path scoped to this exact project — rules out
 * open redirects (absolute or protocol-relative URLs) and rules out
 * redirecting into a different project's workspace than the one that sent
 * the user here.
 */
function isValidReturnTo(returnTo: string, projectId: string): boolean {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return false;
  const projectPrefix = `/projects/${encodeURIComponent(projectId)}`;
  return returnTo === projectPrefix || returnTo.startsWith(`${projectPrefix}/`);
}

/**
 * Reads the project context a BOQ-start-wizard "Connect an Application"
 * click arrives with, so this otherwise-global page can stay scoped to the
 * project that sent the user here instead of stranding them with no way
 * back except the browser's back button. Validated once, here, so every
 * consumer gets a safe returnTo rather than re-parsing the raw query param.
 */
export function useProjectContext(): ProjectSourceContext | null {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  if (!projectId) return null;
  const rawReturnTo = searchParams.get("returnTo");
  return {
    projectId,
    intent: searchParams.get("intent"),
    returnTo: rawReturnTo && isValidReturnTo(rawReturnTo, projectId) ? rawReturnTo : null,
  };
}

/** Appends the current project context onto another integrations-hub URL, if any is present. */
export function withProjectContext(href: string, context: ProjectSourceContext | null): string {
  if (!context) return href;
  const separator = href.includes("?") ? "&" : "?";
  const params = new URLSearchParams({ projectId: context.projectId });
  if (context.intent) params.set("intent", context.intent);
  if (context.returnTo) params.set("returnTo", context.returnTo);
  return `${href}${separator}${params.toString()}`;
}

export function ProjectContextBanner({ context, projectName }: { context: ProjectSourceContext; projectName?: string }) {
  return (
    <div className="rounded-2xl border border-blue-800 bg-blue-950/20 px-4 py-3 text-sm text-blue-200">
      <p className="font-semibold text-white">
        Connecting for {projectName ?? "your project"}
      </p>
      <p className="mt-1 text-xs text-blue-300">
        Whatever you connect or import here stays scoped to this project. Nothing becomes an approved BOQ item
        without your professional review.
      </p>
      {context.returnTo && (
        <Link
          href={context.returnTo}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to project without connecting
        </Link>
      )}
    </div>
  );
}
