"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";

export const ANALYTICS_CONSENT_KEY = "quantara-analytics-consent";

type ConsentChoice = "granted" | "denied";

function updateGoogleConsent(choice: ConsentChoice) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "quantara_consent_update",
    analytics_storage: choice,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  window.gtag?.("consent", "update", {
      analytics_storage: choice,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false);
  const { locale } = useLocale();
  const copy = locale === "ar"
    ? {
        label: "تفضيلات التحليلات",
        title: "خيارات الخصوصية",
        body: "تستخدم Quantara التخزين الأساسي لتشغيل الموقع. وبموافقتك، تساعدنا التحليلات على معرفة الصفحات المفيدة. ويظل تخزين الإعلانات معطلاً.",
        policy: "اقرأ سياسة ملفات تعريف الارتباط",
        essential: "الأساسي فقط",
        allow: "السماح بالتحليلات",
      }
    : {
        label: "Analytics preferences",
        title: "Your privacy choices",
        body: "Quantara uses essential storage to operate the website. With your permission, analytics helps us understand which pages are useful. Advertising storage remains disabled.",
        policy: "Read the Cookie Policy",
        essential: "Essential only",
        allow: "Allow analytics",
      };

  useEffect(() => {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (stored === "granted" || stored === "denied") {
      updateGoogleConsent(stored);
      return;
    }
    setVisible(true);
  }, []);

  function choose(choice: ConsentChoice) {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
    updateGoogleConsent(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      aria-label={copy.label}
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 p-5 text-white shadow-2xl"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 className="text-base font-bold">{copy.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            {copy.body}
          </p>
          <Link href="/cookie-policy" className="mt-2 inline-block text-sm font-semibold text-blue-300 hover:text-blue-200">
            {copy.policy}
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-900"
          >
            {copy.essential}
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            {copy.allow}
          </button>
        </div>
      </div>
    </section>
  );
}
