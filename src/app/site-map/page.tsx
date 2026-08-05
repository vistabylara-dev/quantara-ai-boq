import React from "react";
import Link from "next/link";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { Metadata } from "next";
import { publicNavigation, legalNavigation } from "@/config/public-navigation";
import PublicHeader from "@/components/layout/public-header";
import PublicFooter from "@/components/layout/public-footer";

export const metadata: Metadata = {
  title: "HTML Sitemap | Quantara",
  description: "Navigate all public pages, tools, and resources for the Quantara BOQ software platform.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "https://quantara.vistabylara.com/site-map",
  },
};

export default function SiteMapPage() {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://quantara.vistabylara.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Sitemap",
        "item": "https://quantara.vistabylara.com/site-map"
      }
    ]
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <PublicHeader />
      <PublicBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Site Map", href: "/site-map" }]} />
      
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-16">
        
        
        

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Quantara Sitemap</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-12 max-w-2xl">
          A complete overview of Quantara&apos;s public platform pages, industry solutions, resources, and legal policies.
        </p>

        <div className="space-y-12">
          {publicNavigation.map((section, sIndex) => (
            <section key={sIndex} className="border-t border-slate-200 dark:border-slate-800 pt-8">
              <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{section.label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {section.groups.map((group, gIndex) => (
                  <div key={gIndex}>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">{group.label}</h3>
                    <ul className="space-y-3">
                      {group.items.map((item, iIndex) => (
                        <li key={iIndex}>
                          <Link href={item.href} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Legal & Policies</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <ul className="space-y-3">
                  {legalNavigation.map((item, index) => (
                    <li key={index}>
                      <Link href={item.href} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
