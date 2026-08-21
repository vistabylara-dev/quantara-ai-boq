import Link from "next/link";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { getLegalNavigation, getPublicNavigation } from "@/config/public-navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";
import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import { buildPublicPageGraph } from "@/lib/public-site/schema";

export const metadata = createPublicPageMetadata("/site-map");

export default async function SiteMapPage() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const navigation = getPublicNavigation(t);
  const legalNavigation = getLegalNavigation(t);
  const breadcrumbItems = [
    { name: t("publicLanding.home"), item: "/" },
    { name: t("publicContent.navigation.siteMap"), item: "/site-map" },
  ];
  const page = getPublicSearchPage("/site-map");
  const jsonLd = buildPublicPageGraph({
    path: page.path,
    title: page.title,
    description: page.description,
    breadcrumbs: breadcrumbItems.map((item) => ({
      name: item.name,
      path: item.item,
    })),
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#030508] text-slate-100">
      <PublicJsonLd data={jsonLd} />
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-6 md:py-20">
        <PublicBreadcrumb items={breadcrumbItems} />
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">{t("publicContent.navigation.siteMapTitle")}</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-12 max-w-2xl">
          {t("publicContent.navigation.siteMapIntro")}
        </p>

        <div className="space-y-12">
          {navigation.map((section) => (
            <section key={section.label} className="border-t border-slate-200 dark:border-slate-800 pt-8">
              <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{section.label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {section.groups.map((group) => (
                  <div key={group.label}>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">{group.label}</h3>
                    <ul className="space-y-3">
                      {group.items.map((item) => (
                        <li key={`${item.label}-${item.href}`}>
                          <Link href={item.href} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {item.label}
                          </Link>
                          {item.status && (
                            <span className="ms-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              ({item.status})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{t("publicContent.navigation.legalPolicies")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <ul className="space-y-3">
                  {legalNavigation.map((item) => (
                    <li key={item.href}>
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
      </div>
    </div>
  );
}
