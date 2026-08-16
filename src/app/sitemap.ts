import { MetadataRoute } from "next";
import { PUBLIC_INTEGRATION_PATHS } from "@/lib/public-site/public-integration-ids";
import {
  PUBLIC_CONTENT_REVIEW_DATE,
  PUBLIC_SEARCH_PAGES,
  PUBLIC_SITE_ORIGIN,
} from "@/lib/public-site/search-registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const registeredPages = PUBLIC_SEARCH_PAGES
    .filter((entry) => entry.indexable !== false)
    .map((entry) => ({
      url: `${PUBLIC_SITE_ORIGIN}${entry.path === "/" ? "" : entry.path}`,
      lastModified: new Date(PUBLIC_CONTENT_REVIEW_DATE),
      changeFrequency: entry.changeFrequency ?? "monthly",
      priority: entry.priority ?? 0.8,
    }));

  const integrationPages = PUBLIC_INTEGRATION_PATHS.map((path) => ({
    url: `${PUBLIC_SITE_ORIGIN}${path}`,
    lastModified: new Date(PUBLIC_CONTENT_REVIEW_DATE),
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  return [...registeredPages, ...integrationPages];
}