import React from "react";
import Link from "next/link";
import { canonicalPublicUrl } from "@/lib/public-site/schema";

export interface BreadcrumbItem {
  name: string;
  item?: string; // Optional because the last item is usually not a link
}

export interface PublicBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  tone?: "auto" | "light" | "dark";
}

export default function PublicBreadcrumb({
  items,
  className = "mb-8 text-sm",
  tone = "auto",
}: PublicBreadcrumbProps) {
  if (!items || items.length === 0) return null;

  const currentClass = tone === "light"
    ? "text-slate-900"
    : tone === "dark"
      ? "text-white"
      : "text-white";
  const linkClass = tone === "light"
    ? "text-slate-500 hover:text-slate-900"
    : tone === "dark"
      ? "text-slate-300 hover:text-white"
      : "text-slate-400 hover:text-white";
  const separatorClass = tone === "light"
    ? "text-slate-400"
    : tone === "dark"
      ? "text-slate-500"
      : "text-slate-600";

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((breadcrumb, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <React.Fragment key={`${breadcrumb.name}-${index}`}>
              <li>
                {isLast || !breadcrumb.item ? (
                  <span className={`${currentClass} font-medium`} aria-current="page">
                    {breadcrumb.name}
                  </span>
                ) : (
                  <Link 
                    href={breadcrumb.item} 
                    className={`${linkClass} transition-colors`}
                  >
                    {breadcrumb.name}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li className={separatorClass} aria-hidden="true">
                  /
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Helper to generate JSON-LD schema from the same BreadcrumbItem array
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  // Always ensure Home is the first element for the schema if it's not already
  const schemaItems = [...items];
  if (schemaItems.length === 0 || schemaItems[0].name !== "Home") {
    schemaItems.unshift({ name: "Home", item: "https://quantara.vistabylara.com/" });
  }

  return {
    "@type": "BreadcrumbList",
    "itemListElement": schemaItems.map((breadcrumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": breadcrumb.name,
      "item": breadcrumb.item
        ? canonicalPublicUrl(breadcrumb.item)
        : index === schemaItems.length - 1
          ? undefined
          : canonicalPublicUrl("/"),
    }))
  };
}
