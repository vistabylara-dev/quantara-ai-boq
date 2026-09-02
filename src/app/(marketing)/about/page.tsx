import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import PublicJsonLd from "@/components/seo/public-json-ld";
import { QUANTARA_ENTITY_DEFINITION } from "@/lib/public-site/product-truth";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getPublicSearchPage } from "@/lib/public-site/search-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent } from "@/lib/i18n/translate";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/about", locale);
}

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

const ABOUT_CONTENT = {
  home: "Home",
  breadcrumb: "About",
  title: "About Quantara",
  intro: `${QUANTARA_ENTITY_DEFINITION} It helps project teams move through supported sources, reviewed extraction, dimensions, visible calculations, BOQ organization, validation and professional outputs.`,
  developerTitle: "Developed by Vista By Lara",
  developerBody: "Quantara is developed by Vista By Lara. The product is intended to reduce avoidable administrative work while keeping commercial analysis, risk decisions and professional judgement with the responsible construction team.",
  approachTitle: "Our Approach",
  approachBody: "We believe that software should support the professional, not replace them. Construction pricing is complex and carries commercial risk. Quantara focuses on capturing supported information and organizing project records in authorized workspaces. Current security terms apply, and professional review remains required before commercial use.",
  contactTitle: "Contact Us",
  email: "Email:",
  telephone: "Telephone:",
  whatsapp: "WhatsApp:",
};

export default async function AboutPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const content = translateStructuredContent(t, "publicRoutes.about", ABOUT_CONTENT);
  return (
    <>
      <PublicJsonLd data={pageSchema} />
      <div className="max-w-3xl mx-auto py-24 px-4 flex-1">
        <nav className="mb-8 text-sm" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <li>
              <Link href="/" className="transition-colors hover:text-slate-900 dark:hover:text-white">{content.home}</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-slate-900 dark:text-white" aria-current="page">{content.breadcrumb}</li>
          </ol>
        </nav>
        
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">{content.title}</h1>
          <p className="text-lg text-slate-700 dark:text-slate-300">
            {content.intro}
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{content.developerTitle}</h2>
            <p className="text-slate-700 dark:text-slate-300">
              {content.developerBody}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{content.approachTitle}</h2>
            <p className="text-slate-700 dark:text-slate-300">
              {content.approachBody}
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{content.contactTitle}</h2>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl">
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li><strong>{content.email}</strong> <a dir="ltr" href={`mailto:${siteConfig.contact.email}`} className="text-blue-600 hover:underline dark:text-blue-400">{siteConfig.contact.email}</a></li>
                <li><strong>{content.telephone}</strong> <a dir="ltr" href={`tel:${siteConfig.contact.telephone.replace(/\s+/g, '')}`} className="text-blue-600 hover:underline dark:text-blue-400">{siteConfig.contact.telephone}</a></li>
                <li><strong>{content.whatsapp}</strong> <a dir="ltr" href={siteConfig.contact.whatsappLink} className="text-blue-600 hover:underline dark:text-blue-400">{siteConfig.contact.whatsapp}</a></li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
