import {
  PUBLIC_CONTENT_REVIEW_DATE,
  PUBLIC_SITE_ORIGIN,
} from "@/lib/public-site/search-registry";
import { QUANTARA_ENTITY_DEFINITION } from "@/lib/public-site/product-truth";
import { siteConfig } from "@/config/site";

export const PUBLIC_ENTITY_IDS = {
  organization: `${PUBLIC_SITE_ORIGIN}/#organization`,
  website: `${PUBLIC_SITE_ORIGIN}/#website`,
  software: `${PUBLIC_SITE_ORIGIN}/#software`,
} as const;

export type PublicBreadcrumbSchemaInput = {
  name: string;
  path?: string;
};

export type PublicFaqSchemaInput = {
  question: string;
  answer: string;
};

export type PublicPageSchemaInput = {
  path: string;
  title: string;
  description: string;
  breadcrumbs: readonly PublicBreadcrumbSchemaInput[];
  faqs?: readonly PublicFaqSchemaInput[];
  howTo?: {
    name: string;
    description?: string;
    steps: readonly string[];
  };
  kind?: "webpage" | "tech-article";
  dateModified?: string;
};

type JsonLdNode = Record<string, unknown>;

function normalizePublicPath(path: string): string {
  if (!path || path === "/") return "/";

  if (/^https?:\/\//i.test(path)) {
    const parsed = new URL(path);
    if (parsed.origin !== PUBLIC_SITE_ORIGIN) {
      throw new Error(`Public schema URL must use ${PUBLIC_SITE_ORIGIN}`);
    }
    return parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "");
  }

  const normalized = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return normalized === "//" ? "/" : normalized;
}

export function canonicalPublicUrl(path: string): string {
  const normalizedPath = normalizePublicPath(path);
  return normalizedPath === "/"
    ? `${PUBLIC_SITE_ORIGIN}/`
    : `${PUBLIC_SITE_ORIGIN}${normalizedPath}`;
}

export function inferPublicPathFromSchema(schema: unknown): string | null {
  if (!schema || typeof schema !== "object") return null;

  const record = schema as Record<string, unknown>;
  const directUrl = record.url;
  if (typeof directUrl === "string") {
    try {
      return normalizePublicPath(directUrl);
    } catch {
      return null;
    }
  }

  const graph = record["@graph"];
  if (!Array.isArray(graph)) return null;

  for (const node of graph) {
    const inferredPath = inferPublicPathFromSchema(node);
    if (inferredPath) return inferredPath;
  }

  return null;
}

export function buildPublicEntityGraph(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": PUBLIC_ENTITY_IDS.organization,
        name: "Vista By Lara",
        url: `${PUBLIC_SITE_ORIGIN}/`,
        logo: `${PUBLIC_SITE_ORIGIN}/logo.png`,
        email: siteConfig.contact.email,
        telephone: siteConfig.contact.telephone.replace(/[^+\d]/g, ""),
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "sales and product requirements",
          email: siteConfig.contact.email,
          telephone: siteConfig.contact.telephone.replace(/[^+\d]/g, ""),
          availableLanguage: ["English"],
        },
      },
      {
        "@type": "WebSite",
        "@id": PUBLIC_ENTITY_IDS.website,
        url: `${PUBLIC_SITE_ORIGIN}/`,
        name: "Quantara",
        inLanguage: "en-AE",
        publisher: { "@id": PUBLIC_ENTITY_IDS.organization },
        about: { "@id": PUBLIC_ENTITY_IDS.software },
      },
      {
        "@type": "SoftwareApplication",
        "@id": PUBLIC_ENTITY_IDS.software,
        name: "Quantara",
        url: `${PUBLIC_SITE_ORIGIN}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: QUANTARA_ENTITY_DEFINITION,
        audience: {
          "@type": "BusinessAudience",
          audienceType: "Construction professionals reviewing BOQ workflows",
        },
        publisher: { "@id": PUBLIC_ENTITY_IDS.organization },
        provider: { "@id": PUBLIC_ENTITY_IDS.organization },
      },
    ],
  };
}

export function buildPublicPageGraph({
  path,
  title,
  description,
  breadcrumbs,
  faqs = [],
  howTo,
  kind = "webpage",
  dateModified = PUBLIC_CONTENT_REVIEW_DATE,
}: PublicPageSchemaInput): Record<string, unknown> {
  const canonicalUrl = canonicalPublicUrl(path);
  const pageId = `${canonicalUrl}#webpage`;
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const faqId = `${canonicalUrl}#faq`;
  const articleId = `${canonicalUrl}#article`;
  const howToId = `${canonicalUrl}#how-to`;

  const pageNode: JsonLdNode = {
    "@type": "WebPage",
    "@id": pageId,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: "en-AE",
    isPartOf: { "@id": PUBLIC_ENTITY_IDS.website },
    about: { "@id": PUBLIC_ENTITY_IDS.software },
    breadcrumb: { "@id": breadcrumbId },
  };

  const graph: JsonLdNode[] = [pageNode];
  const pageParts: JsonLdNode[] = [];

  if (kind === "tech-article") {
    pageNode.mainEntity = { "@id": articleId };
    graph.push({
      "@type": "TechArticle",
      "@id": articleId,
      headline: title,
      description,
      url: canonicalUrl,
      inLanguage: "en-AE",
      dateModified,
      mainEntityOfPage: { "@id": pageId },
      publisher: { "@id": PUBLIC_ENTITY_IDS.organization },
      about: { "@id": PUBLIC_ENTITY_IDS.software },
    });
  }

  graph.push({
    "@type": "BreadcrumbList",
    "@id": breadcrumbId,
    itemListElement: breadcrumbs.map((breadcrumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: breadcrumb.name,
      ...(breadcrumb.path
        ? { item: canonicalPublicUrl(breadcrumb.path) }
        : index === breadcrumbs.length - 1
          ? { item: canonicalUrl }
          : {}),
    })),
  });

  if (howTo && howTo.steps.length > 0) {
    pageParts.push({ "@id": howToId });
    graph.push({
      "@type": "HowTo",
      "@id": howToId,
      name: howTo.name,
      description: howTo.description ?? description,
      url: canonicalUrl,
      inLanguage: "en-AE",
      isPartOf: { "@id": pageId },
      step: howTo.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        text: step,
      })),
    });
  }

  const visibleFaqs = faqs.filter(
    (faq) => faq.question.trim().length > 0 && faq.answer.trim().length > 0,
  );
  if (visibleFaqs.length > 0) {
    pageParts.push({ "@id": faqId });
    graph.push({
      "@type": "FAQPage",
      "@id": faqId,
      url: canonicalUrl,
      isPartOf: { "@id": pageId },
      mainEntity: visibleFaqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  if (pageParts.length > 0) {
    pageNode.hasPart = pageParts.length === 1 ? pageParts[0] : pageParts;
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
