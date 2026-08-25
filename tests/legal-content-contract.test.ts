import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LegalPolicyPage, { type LegalPolicyId } from "@/components/legal/legal-policy-page";
import en from "@/lib/i18n/dictionaries/en";
import ar from "@/lib/i18n/dictionaries/ar";
import { getServerLocale } from "@/lib/i18n/server-locale";

vi.mock("@/lib/i18n/server-locale", () => ({
  getServerLocale: vi.fn(async () => "en"),
}));

const repoRoot = process.cwd();
const legalComponentPath = join(repoRoot, "src", "components", "legal", "legal-policy-page.tsx");
const routePolicies = [
  ["privacy", "privacy"],
  ["terms", "terms"],
  ["security", "security"],
  ["cookie-policy", "cookies"],
  ["data-processing", "dataProcessing"],
  ["acceptable-use", "acceptableUse"],
  ["subprocessors", "subprocessors"],
] as const satisfies ReadonlyArray<readonly [string, LegalPolicyId]>;

function readTranslation(dictionary: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (!node || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[part];
  }, dictionary);
}

describe("substantive legal page contracts", () => {
  beforeEach(() => {
    vi.mocked(getServerLocale).mockResolvedValue("en");
  });

  it("routes all seven legal pages through the shared substantive policy renderer", () => {
    for (const [route, policy] of routePolicies) {
      const source = readFileSync(
        join(repoRoot, "src", "app", "(marketing)", route, "page.tsx"),
        "utf8",
      );
      expect(source).toContain('import LegalPolicyPage from "@/components/legal/legal-policy-page"');
      expect(source).toContain(`<LegalPolicyPage policy="${policy}" />`);
      expect(source).not.toMatch(/LegalPlaceholder|placeholder legal page/i);
    }

    expect(existsSync(join(repoRoot, "src", "components", "legal", "LegalPlaceholder.tsx"))).toBe(false);
  });

  it("defines every legal translation key in both English and Arabic", () => {
    const source = readFileSync(legalComponentPath, "utf8");
    const keys = Array.from(source.matchAll(/"(legal\.[A-Za-z0-9.]+)"/g), (match) => match[1]);

    expect(new Set(keys).size).toBeGreaterThan(150);
    for (const key of new Set(keys)) {
      const english = readTranslation(en, key);
      const arabic = readTranslation(ar, key);
      expect(typeof english, `${key} English`).toBe("string");
      expect((english as string).trim().length, `${key} English`).toBeGreaterThan(0);
      expect(typeof arabic, `${key} Arabic`).toBe("string");
      expect((arabic as string).trim().length, `${key} Arabic`).toBeGreaterThan(0);
    }
  });

  it.each(routePolicies)("renders /%s as a substantive English policy", async (_route, policy) => {
    const element = await LegalPolicyPage({ policy });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("<h1");
    expect(html.match(/<section/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(html).toContain("solution@vistabylara.com");
    expect(html).not.toMatch(/legal\.[A-Za-z0-9.]+/);
    expect(html).not.toMatch(/LegalPlaceholder|lorem ipsum/i);
    expect(html.length).toBeGreaterThan(2_500);
  });

  it("renders policy content from the Arabic dictionary when Arabic is active", async () => {
    vi.mocked(getServerLocale).mockResolvedValue("ar");
    const element = await LegalPolicyPage({ policy: "privacy" });
    const html = renderToStaticMarkup(element);

    expect(html).toContain(ar.legal.privacy.title);
    expect(html).toContain(ar.legal.shared.contactHeading);
    expect(html).toContain(`<h1 class="mb-4 text-4xl font-bold text-slate-900 dark:text-white">${ar.legal.privacy.title}</h1>`);
    expect(html).not.toMatch(/legal\.[A-Za-z0-9.]+/);
  });

  it("defaults analytics and advertising consent to denied and offers a bilingual choice", () => {
    const rootLayout = readFileSync(join(repoRoot, "src", "app", "layout.tsx"), "utf8");
    const marketingLayout = readFileSync(
      join(repoRoot, "src", "app", "(marketing)", "layout.tsx"),
      "utf8",
    );
    const banner = readFileSync(
      join(repoRoot, "src", "components", "legal", "analytics-consent-banner.tsx"),
      "utf8",
    );

    expect(rootLayout.indexOf("GOOGLE_CONSENT_DEFAULT_SCRIPT")).toBeLessThan(
      rootLayout.indexOf("GOOGLE_TAG_MANAGER_SCRIPT"),
    );
    expect(rootLayout).toContain("analytics_storage: storedConsent === 'granted' ? 'granted' : 'denied'");
    expect(rootLayout).toContain("ad_storage: 'denied'");
    expect(rootLayout).toContain("ad_user_data: 'denied'");
    expect(rootLayout).toContain("ad_personalization: 'denied'");
    expect(rootLayout).not.toContain("googletagmanager.com/ns.html");
    expect(marketingLayout).toContain("<AnalyticsConsentBanner />");
    expect(banner).toContain('ANALYTICS_CONSENT_KEY = "quantara-analytics-consent"');
    expect(banner).toContain("Essential only");
    expect(banner).toContain("Allow analytics");
    expect(banner).toContain("الأساسي فقط");
    expect(banner).toContain("السماح بالتحليلات");
    expect(banner).toContain('event: "quantara_consent_update"');
    expect(banner).toContain('ad_storage: "denied"');
    expect(banner).toContain('ad_user_data: "denied"');
    expect(banner).toContain('ad_personalization: "denied"');
  });
});
