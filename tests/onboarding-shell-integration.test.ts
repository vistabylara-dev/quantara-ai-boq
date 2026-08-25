import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("onboarding shell integration", () => {
  const shell = readSource("src/components/layout/conditional-app-shell.tsx");
  const help = readSource("src/components/support/help-feedback-bubble.tsx");
  const provider = readSource("src/components/onboarding/onboarding-provider.tsx");
  const state = readSource("src/lib/onboarding/onboarding-state.ts");

  it("mounts onboarding only around the authenticated SaaS branch", () => {
    expect(shell).toContain(
      'import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";',
    );

    const publicBranchStart = shell.indexOf("if (PUBLIC_SHELL_ROUTES.has(currentRoute))");
    const finalReturnStart = shell.lastIndexOf("  return (");

    expect(publicBranchStart).toBeGreaterThan(-1);
    expect(finalReturnStart).toBeGreaterThan(publicBranchStart);
    expect(
      shell.slice(publicBranchStart, finalReturnStart),
    ).not.toContain("<OnboardingProvider>");

    expect(shell.slice(finalReturnStart)).toContain("<OnboardingProvider>");
    expect(shell.slice(finalReturnStart)).toMatch(
      /<HelpFeedbackBubble\s+surface="SAAS"/,
    );
  });

  it("preserves proposal and technical-report shell exclusions", () => {
    expect(shell).toContain('pathname?.startsWith("/proposal")');
    expect(shell).toContain('pathname?.startsWith("/technical-report")');
  });

  it("preserves existing Help & Feedback behavior and adds SaaS tutorials", () => {
    expect(help).toContain('apiClient.post<{ requestId: string; deliveryStatus: "stored" }>("/api/contact"');
    expect(help).toContain("siteConfig.contact.whatsappLink");
    expect(help).toContain('surface === "SAAS" ? <OnboardingHelpSection onRequestClose={() => close(true)} /> : null');
  });

  it("preserves the global TAYQAN companion mounts", () => {
    const mounts = shell.match(/<TayqanGlobalCompanion \/>/g) ?? [];
    expect(mounts.length).toBe(2);
  });

  it("keeps the onboarding foundation read-only with respect to server business data", () => {
    expect(provider).toContain('apiClient.get<SessionData>');
    expect(provider).toContain('"/api/dashboard/metrics"');
    expect(provider).toContain("let shouldPersist = true;");
    expect(provider).toContain("shouldPersist = false;");
    expect(provider).toContain("storage && shouldPersist");
    expect(provider).not.toContain("apiClient.post");
    expect(provider).not.toContain("apiClient.put");
    expect(provider).not.toContain("apiClient.delete");
    expect(provider).not.toContain("@/lib/db/prisma");
    expect(state).not.toContain("@prisma/client");
    expect(state).not.toContain("prisma.");
  });

  it("sends a first-run guided user directly to project creation", () => {
    expect(provider).toContain('import { usePathname, useRouter } from "next/navigation";');
    expect(provider).toContain('if (!state?.completedActions.PROJECT_CREATED)');
    expect(provider).toContain('router.push("/projects/new")');
  });

  it("uses browser-only versioned onboarding persistence, not a new API route", () => {
    expect(state).toContain("quantara:onboarding:v");
    expect(provider).toContain("window.localStorage");
    expect(provider).not.toContain("/api/onboarding");
  });
});
