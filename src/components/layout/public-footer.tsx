"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { publicNavigation, legalNavigation } from "@/config/public-navigation";
import { siteConfig } from "@/config/site";
import { QUANTARA_ENTITY_DEFINITION } from "@/lib/public-site/product-truth";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function PublicFooter() {
  const t = useTranslations();
  const getSectionItems = (sectionLabel: string) => {
    const section = publicNavigation.find(s => s.label === sectionLabel);
    if (!section) return [];
    // Flatten all items from all groups in the section for the footer
    return section.groups.flatMap(g => g.items);
  };

  const platformItems = getSectionItems("Platform");
  const solutionsItems = getSectionItems("Solutions");
  const resourcesItems = getSectionItems("Resources");
  const comparisonsItems = getSectionItems("Comparisons");
  const regionalItems = getSectionItems("Regional");
  const companyItems = getSectionItems("Company");

  return (
    <footer className="py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 mb-12">
          
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2 mb-6" aria-label="Quantara Home">
              <Image
                src="/logo.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 object-contain"
              />
              Quantara
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium max-w-sm">
              {t("publicSite.footer.description1")}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
              {QUANTARA_ENTITY_DEFINITION} {t("publicSite.footer.description2Suffix")}
            </p>

            <div className="mt-8 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <p>{t("publicSite.footer.emailLabel")} <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-slate-900 dark:hover:text-white">{siteConfig.contact.email}</a></p>
              <p>{t("publicSite.footer.telephoneLabel")} <a href={`tel:${siteConfig.contact.telephone.replace(/\s+/g, '')}`} className="hover:text-slate-900 dark:hover:text-white">{siteConfig.contact.telephone}</a></p>
              <p>{t("publicSite.footer.whatsappLabel")} <a href={siteConfig.contact.whatsappLink} className="hover:text-slate-900 dark:hover:text-white">{siteConfig.contact.whatsapp}</a></p>
            </div>
          </div>

          {/* Platform */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.platform")}</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {platformItems.slice(0, 7).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Solutions & Comparisons */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.solutions")}</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400 mb-8">
              {solutionsItems.slice(0, 5).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>

            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.comparisons")}</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {comparisonsItems.slice(0, 5).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.resources")}</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {resourcesItems.slice(0, 8).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Regional */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.regional")}</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {regionalItems.slice(0, 7).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company & Legal */}
          <div className="col-span-1 lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-8">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.workflowReviewTitle")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                {t("publicSite.footer.workflowReviewBody")}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                {t("publicSite.footer.workflowReviewNote")}
              </p>
              <Link href="/contact-sales" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                {t("common.contactSales")} &rarr;
              </Link>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.company")}</h3>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                {companyItems.map((item, index) => (
                  <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
                ))}
                <li><Link href="/site-map" className="hover:text-slate-900 dark:hover:text-white">{t("publicSite.footer.htmlSitemap")}</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicSite.footer.legal")}</h3>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                {legalNavigation.map((item, index) => (
                  <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            {t("publicSite.footer.copyright", { year: new Date().getFullYear() })}
          </div>
        </div>
      </div>
    </footer>
  );
}
