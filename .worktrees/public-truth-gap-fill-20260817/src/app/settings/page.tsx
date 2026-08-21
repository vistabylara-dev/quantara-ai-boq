"use client";

import Link from "next/link";
import ThemeSelector from "@/components/settings/theme-selector";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function SettingsPage() {
  const t = useTranslations();
  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("settings.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{t("settings.title")}</h1>
        <p className="mt-3 text-slate-400">{t("settings.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("settings.company")}</p>
          <p className="mt-4 text-sm text-slate-400">{t("settings.companyDesc")}</p>
          <Link href="/settings/company" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            {t("settings.manageCompany")}
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("settings.subscription")}</p>
          <p className="mt-4 text-sm text-slate-400">{t("settings.subscriptionDesc")}</p>
          <Link href="/settings/subscription" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            {t("settings.manageSubscription")}
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("settings.dataPackages")}</p>
          <p className="mt-4 text-sm text-slate-400">{t("settings.dataPackagesDesc")}</p>
          <Link href="/settings/data-packages" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            {t("settings.manageDataPackages")}
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("settings.clientProposals")}</p>
          <p className="mt-4 text-sm text-slate-400">{t("settings.clientProposalsDesc")}</p>
          <Link href="/settings/email-templates" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            {t("settings.manageEmailTemplates")}
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("settings.localeSettings")}</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
              <p className="font-semibold text-white">{t("settings.currency")}</p>
              <p className="mt-1 text-sm text-slate-400">{t("settings.currencyDesc")}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
              <p className="font-semibold text-white">{t("settings.language")}</p>
              <p className="mt-1 text-sm text-slate-400">{t("settings.languageDesc")}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ThemeSelector />

          <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("settings.persistence")}</p>
            <p className="mt-4 text-sm text-slate-400">{t("settings.persistenceDesc")}</p>
            <button className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              {t("settings.resetDemoData")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
