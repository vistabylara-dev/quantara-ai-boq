"use client";

import React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  name: string;
  item?: string; // Optional because the last item is usually not a link
}

export interface PublicBreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function PublicBreadcrumb({ items }: PublicBreadcrumbProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm">
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((breadcrumb, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <React.Fragment key={index}>
              <li>
                {isLast || !breadcrumb.item ? (
                  <span className="text-slate-900 dark:text-white font-medium" aria-current="page">
                    {breadcrumb.name}
                  </span>
                ) : (
                  <Link 
                    href={breadcrumb.item} 
                    className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    {breadcrumb.name}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li className="text-slate-400 dark:text-slate-600" aria-hidden="true">
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
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": schemaItems.map((breadcrumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": breadcrumb.name,
      "item": breadcrumb.item ? (breadcrumb.item.startsWith('http') ? breadcrumb.item : `https://quantara.vistabylara.com${breadcrumb.item}`) : undefined
    }))
  };
}
