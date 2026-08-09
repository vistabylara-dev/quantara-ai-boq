import {
  buildPublicPageGraph,
  type PublicBreadcrumbSchemaInput,
  type PublicFaqSchemaInput,
} from "@/lib/public-site/schema";
import {
  getPublicSearchPage,
  type PublicSearchPath,
} from "@/lib/public-site/search-registry";

type PublicJsonLdProps = {
  data: Record<string, unknown>;
  id?: string;
};

type PublicPageJsonLdProps = {
  path: PublicSearchPath;
  breadcrumbs: readonly PublicBreadcrumbSchemaInput[];
  faqs?: readonly PublicFaqSchemaInput[];
  kind?: "webpage" | "tech-article";
  dateModified?: string;
  id?: string;
};

export function serializePublicJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function PublicJsonLd({ data, id }: PublicJsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializePublicJsonLd(data) }}
    />
  );
}

export function PublicPageJsonLd({
  path,
  breadcrumbs,
  faqs,
  kind,
  dateModified,
  id,
}: PublicPageJsonLdProps) {
  const entry = getPublicSearchPage(path);
  const graph = buildPublicPageGraph({
    path,
    title: entry.title,
    description: entry.description,
    breadcrumbs,
    faqs,
    kind,
    dateModified,
  });

  return <PublicJsonLd data={graph} id={id} />;
}
