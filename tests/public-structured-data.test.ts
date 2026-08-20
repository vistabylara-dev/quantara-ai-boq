import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QUANTARA_ENTITY_DEFINITION } from "@/lib/public-site/product-truth";
import {
  PUBLIC_ENTITY_IDS,
  buildPublicEntityGraph,
  buildPublicPageGraph,
  canonicalPublicUrl,
} from "@/lib/public-site/schema";

const repoRoot = process.cwd();

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

  it("builds HowTo markup from the same visible instructional steps", () => {
    const steps = ["Confirm the source revision.", "Review every captured row."];
    const nodes = graphNodes(buildPublicPageGraph({
      path: "/how-to-review-ai-extracted-boq",
      title: "How to Review an AI-Extracted BOQ",
      description: "A review workflow.",
      breadcrumbs: [{ name: "Home", path: "/" }, { name: "Review" }],
      howTo: {
        name: "AI-extracted BOQ review workflow",
        steps,
      },
      kind: "tech-article",
    }));

    const howTo = nodes.find((node) => node["@type"] === "HowTo");
    expect(howTo).toMatchObject({
      name: "AI-extracted BOQ review workflow",
      step: steps.map((text, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text,
      })),
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

  it("builds FAQPage markup from the same FAQ collection rendered visibly", () => {
    for (const componentPath of [
      "src/components/layout/seo-landing-page.tsx",
      "src/components/layout/knowledge-page.tsx",
      "src/components/layout/industry-landing-page.tsx",
      "src/components/layout/regional-landing-page.tsx",
      "src/components/layout/comparison-page.tsx",
    ]) {
      const source = readFileSync(join(repoRoot, componentPath), "utf8");
      expect(source, `${componentPath} must pass FAQs to the schema builder`).toMatch(
        /faqs:\s*(?:(?:content|props)\.)?faqs|faqs:\s*schemaFaqs/,
      );
      expect(source, `${componentPath} must visibly render the same FAQs`).toMatch(
        /(?:(?:content|props)\.)?faqs\.map/,
      );
    }
  });
});
