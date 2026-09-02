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
    .map((entry) => {
      const enUrl = `${PUBLIC_SITE_ORIGIN}${entry.path === "/" ? "" : entry.path}`;
      const arUrl = `${PUBLIC_SITE_ORIGIN}/ar${entry.path === "/" ? "" : entry.path}`;
      return {
        url: enUrl,
        lastModified: new Date(PUBLIC_CONTENT_REVIEW_DATE),
        changeFrequency: entry.changeFrequency ?? "monthly",
        priority: entry.priority ?? 0.8,
        alternates: {
          languages: {
            "en-AE": enUrl,
            "ar-AE": arUrl,
            "x-default": enUrl,
          }
        }
      };
    });

  const integrationPages = PUBLIC_INTEGRATION_PATHS.map((path) => ({
    url: `${PUBLIC_SITE_ORIGIN}${path}`,
    lastModified: new Date(PUBLIC_CONTENT_REVIEW_DATE),
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  return [...registeredPages, ...integrationPages];
}
