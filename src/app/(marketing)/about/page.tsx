import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import PublicJsonLd from "@/components/seo/public-json-ld";
import { QUANTARA_ENTITY_DEFINITION } from "@/lib/public-site/product-truth";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getPublicSearchPage } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/about");

const searchEntry = getPublicSearchPage("/about");
const pageSchema = buildPublicPageGraph({
  path: "/about",
  title: searchEntry.title,
  description: searchEntry.description,
  breadcrumbs: [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
  ],
});

export default function AboutPage() {
  return (
    <>
      <PublicJsonLd data={pageSchema} />
      <div className="max-w-3xl mx-auto py-24 px-4 flex-1">
        <nav className="mb-8 text-sm" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-slate-500">
            <li>
              <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-900 font-medium" aria-current="page">About</li>
          </ol>
        </nav>
        
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">About Quantara</h1>
          <p className="text-lg text-slate-700 dark:text-slate-300">
            {QUANTARA_ENTITY_DEFINITION} It helps project teams move through supported sources,
            reviewed extraction, dimensions, visible calculations, BOQ organization, validation
            and professional outputs.
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Developed by Vista By Lara</h2>
            <p className="text-slate-700 dark:text-slate-300">
              Quantara is developed by Vista By Lara. The product is intended to reduce avoidable
              administrative work while keeping commercial analysis, risk decisions and
              professional judgement with the responsible construction team.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Approach</h2>
            <p className="text-slate-700 dark:text-slate-300">
              We believe that software should support the professional, not replace them. Construction pricing is complex and carries commercial risk. Quantara focuses on capturing supported information and organizing project records in authorized workspaces. Current security terms apply, and professional review remains required before commercial use.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Contact Us</h2>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl">
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li><strong>Email:</strong> <a href={`mailto:${siteConfig.contact.email}`} className="text-blue-600 hover:underline">{siteConfig.contact.email}</a></li>
                <li><strong>Telephone:</strong> <a href={`tel:${siteConfig.contact.telephone.replace(/\s+/g, '')}`} className="text-blue-600 hover:underline">{siteConfig.contact.telephone}</a></li>
                <li><strong>WhatsApp:</strong> <a href={siteConfig.contact.whatsappLink} className="text-blue-600 hover:underline">{siteConfig.contact.whatsapp}</a></li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
