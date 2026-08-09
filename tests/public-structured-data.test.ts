import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { QUANTARA_ENTITY_DEFINITION } from "@/lib/public-site/product-truth";
import {
  PUBLIC_ENTITY_IDS,
  buildPublicEntityGraph,
  buildPublicPageGraph,
  canonicalPublicUrl,
} from "@/lib/public-site/schema";

const repoRoot = process.cwd();
const marketingRoot = join(repoRoot, "src", "app", "(marketing)");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

type JsonLdNode = Record<string, unknown>;

function graphNodes(schema: Record<string, unknown>): JsonLdNode[] {
  return schema["@graph"] as JsonLdNode[];
}

describe("public structured-data guardrails", () => {
  it("builds one canonical Organization, WebSite and SoftwareApplication identity", () => {
    const nodes = graphNodes(buildPublicEntityGraph());

    expect(nodes.map((node) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
    ]);
    expect(nodes.map((node) => node["@id"])).toEqual([
      PUBLIC_ENTITY_IDS.organization,
      PUBLIC_ENTITY_IDS.website,
      PUBLIC_ENTITY_IDS.software,
    ]);

    const website = nodes[1];
    const software = nodes[2];
    expect(website.publisher).toEqual({ "@id": PUBLIC_ENTITY_IDS.organization });
    expect(website.about).toEqual({ "@id": PUBLIC_ENTITY_IDS.software });
    expect(software.description).toBe(QUANTARA_ENTITY_DEFINITION);
    expect(software.publisher).toEqual({ "@id": PUBLIC_ENTITY_IDS.organization });
  });

  it("builds page, article, breadcrumb and visible-FAQ nodes from one input", () => {
    const title = "How to Review BOQ Information";
    const description = "A direct, professional review workflow.";
    const question = "What must a reviewer confirm?";
    const answer = "A reviewer must confirm the source, unit, quantity and assumptions.";
    const nodes = graphNodes(buildPublicPageGraph({
      path: "/how-to-review-ai-extracted-boq",
      title,
      description,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Resources", path: "/resources" },
        { name: title },
      ],
      faqs: [{ question, answer }],
      kind: "tech-article",
    }));

    expect(nodes.map((node) => node["@type"])).toEqual([
      "WebPage",
      "TechArticle",
      "BreadcrumbList",
      "FAQPage",
    ]);
    expect(nodes[0]).toMatchObject({
      url: canonicalPublicUrl("/how-to-review-ai-extracted-boq"),
      name: title,
      description,
      isPartOf: { "@id": PUBLIC_ENTITY_IDS.website },
      about: { "@id": PUBLIC_ENTITY_IDS.software },
    });
    expect(nodes[1]).toMatchObject({
      headline: title,
      description,
      publisher: { "@id": PUBLIC_ENTITY_IDS.organization },
    });
    expect(nodes[2].itemListElement).toHaveLength(3);
    expect(nodes[3]).toMatchObject({
      mainEntity: [{
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      }],
    });
  });

  it("does not add fabricated commercial or social-proof properties", () => {
    const schemas = JSON.stringify([
      buildPublicEntityGraph(),
      buildPublicPageGraph({
        path: "/features",
        title: "Features",
        description: "Current product capabilities.",
        breadcrumbs: [{ name: "Home", path: "/" }, { name: "Features" }],
      }),
    ]);

    expect(schemas).not.toMatch(/"aggregateRating"\s*:/);
    expect(schemas).not.toMatch(/"review"\s*:/);
    expect(schemas).not.toMatch(/"offers"\s*:/);
    expect(schemas).not.toMatch(/"priceCurrency"\s*:/);
    expect(schemas).not.toMatch(/"award"\s*:/);
    expect(schemas).not.toMatch(/"@type"\s*:\s*"LocalBusiness"/);
  });

  it("rejects an external origin when canonicalizing public schema URLs", () => {
    expect(() => canonicalPublicUrl("https://example.com/features")).toThrow(
      "Public schema URL must use",
    );
  });

  it("only keeps FAQPage markup beside a visible public FAQ source", () => {
    for (const file of collectSourceFiles(marketingRoot)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes('"@type": "FAQPage"')) continue;
      expect(source.toLowerCase(), file).toContain("faq");
    }
  });
});
