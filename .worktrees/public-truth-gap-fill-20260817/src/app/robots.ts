import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/catalogue",
        "/clients",
        "/company-library",
        "/dashboard",
        "/data-library",
        "/imports",
        "/integrations",
        "/marketplace",
        "/projects",
        "/proposal",
        "/settings",
        "/suppliers",
        "/technical-report",
        "/templates",
      ],
    },
    sitemap: "https://quantara.vistabylara.com/sitemap.xml",
  };
}
