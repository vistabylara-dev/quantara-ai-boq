"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { apiClient } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function ContactSalesPage() {
  const t = useTranslations();
  const [formData, setFormData] = useState({
    fullName: "",
    businessEmail: "",
    companyName: "",
    country: "",
    role: "",
    companyType: "Main Contractor",
    constructionDiscipline: "",
    monthlyVolume: "1-5",
    currentBoqProcess: "",
    requiredInputs: "",
    requiredOutputs: "",
    numberOfUsers: "1-5",
    preferredContactMethod: "Email",
    message: "",
    consent: false,
  });
  
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status === "success") successHeadingRef.current?.focus();
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      await apiClient.post("/api/contact", {
        kind: "SALES",
        ...formData,
        website: "",
      });

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage(t("publicContent.contactSales.error"));
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-24 px-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-900/50 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">✓</div>
          <h1 ref={successHeadingRef} tabIndex={-1} className="text-2xl font-bold text-white mb-4 outline-none">{t("publicContent.contactSales.successTitle")}</h1>
          <p className="text-slate-400 mb-8">
            {t("publicContent.contactSales.successBody")}
          </p>
          <Link href="/" className="inline-block bg-slate-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-700 transition-colors">
            {t("publicContent.contactSales.returnHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030508] py-24">
      <div className="max-w-6xl mx-auto px-4">
        <PublicBreadcrumb items={[{ name: t("legal.shared.home"), item: "/" }, { name: t("publicContent.contactSales.breadcrumb") }]} />

        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">{t("publicContent.contactSales.pageTitle")}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              {t("publicContent.contactSales.intro")}
            </p>
            <div className="bg-blue-900/20 p-6 rounded-2xl border border-blue-800/50 mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicContent.contactSales.teamTitle")}</h3>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2"><strong>{t("publicContent.contactSales.email")}</strong> <a dir="ltr" href={`mailto:${siteConfig.contact.email}`} className="text-blue-600 hover:underline">{siteConfig.contact.email}</a></li>
                <li className="flex gap-2"><strong>{t("publicContent.contactSales.telephone")}</strong> <a dir="ltr" href={`tel:${siteConfig.contact.telephone.replace(/\s+/g, '')}`} className="text-blue-600 hover:underline">{siteConfig.contact.telephone}</a></li>
                <li className="flex gap-2"><strong>{t("publicContent.contactSales.whatsapp")}</strong> <a dir="ltr" href={siteConfig.contact.whatsappLink} className="text-blue-600 hover:underline">{siteConfig.contact.whatsapp}</a></li>
              </ul>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                {t("publicContent.contactSales.timing")}
              </p>
            </div>
            
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("publicContent.contactSales.whyTitle")}</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc ps-4">
                <li>{t("publicContent.contactSales.whyProcess")}</li>
                <li>{t("publicContent.contactSales.whyFormats")}</li>
                <li>{t("publicContent.contactSales.walkthrough")}</li>
                <li>{t("publicContent.contactSales.whyTeam")}</li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t("publicContent.contactSales.formTitle")}</h2>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.fullName")}</label>
                  <input id="fullName" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="businessEmail" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.businessEmail")}</label>
                  <input id="businessEmail" required value={formData.businessEmail} onChange={e => setFormData({...formData, businessEmail: e.target.value})} type="email" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyName" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.companyName")}</label>
                  <input id="companyName" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="country" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.country")}</label>
                  <input id="country" required value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="role" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.role")}</label>
                  <input id="role" required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="companyType" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.companyType")}</label>
                  <select id="companyType" required value={formData.companyType} onChange={e => setFormData({...formData, companyType: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="Main Contractor">{t("publicContent.contactSales.mainContractor")}</option>
                    <option value="Subcontractor">{t("publicContent.contactSales.subcontractor")}</option>
                    <option value="Consultancy">{t("publicContent.contactSales.consultancy")}</option>
                    <option value="Developer">{t("publicContent.contactSales.developer")}</option>
                    <option value="Other">{t("publicContent.contactSales.other")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="constructionDiscipline" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.discipline")}</label>
                  <input id="constructionDiscipline" required value={formData.constructionDiscipline} onChange={e => setFormData({...formData, constructionDiscipline: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="monthlyVolume" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.monthlyVolume")}</label>
                  <input id="monthlyVolume" required value={formData.monthlyVolume} onChange={e => setFormData({...formData, monthlyVolume: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label htmlFor="currentBoqProcess" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.currentProcess")}</label>
                <input id="currentBoqProcess" required value={formData.currentBoqProcess} onChange={e => setFormData({...formData, currentBoqProcess: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="requiredInputs" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.inputFormats")}</label>
                  <input id="requiredInputs" required value={formData.requiredInputs} onChange={e => setFormData({...formData, requiredInputs: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="requiredOutputs" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.outputFormats")}</label>
                  <input id="requiredOutputs" required value={formData.requiredOutputs} onChange={e => setFormData({...formData, requiredOutputs: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="numberOfUsers" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.users")}</label>
                  <input id="numberOfUsers" required value={formData.numberOfUsers} onChange={e => setFormData({...formData, numberOfUsers: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="preferredContactMethod" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.preferredMethod")}</label>
                  <select id="preferredContactMethod" required aria-label={t("publicContent.contactSales.preferredMethod")} value={formData.preferredContactMethod} onChange={e => setFormData({...formData, preferredContactMethod: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="Email">{t("publicContent.contactSales.methodEmail")}</option>
                    <option value="Phone">{t("publicContent.contactSales.methodPhone")}</option>
                    <option value="WhatsApp">{t("publicContent.contactSales.methodWhatsapp")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t("publicContent.contactSales.message")}</label>
                <textarea id="message" required value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 resize-none"></textarea>
              </div>

              <div className="flex items-start gap-3 mt-4 pt-2">
                <input 
                  type="checkbox" 
                  id="consent" 
                  required
                  checked={formData.consent}
                  onChange={(e) => setFormData({...formData, consent: e.target.checked})}
                  className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-slate-950" 
                />
                <label htmlFor="consent" className="text-xs text-slate-500">
                  {t("publicContent.contactSales.consent")}
                </label>
              </div>

              {status === "error" && (
                <div role="alert" className="text-rose-400 text-sm font-medium p-3 bg-rose-900/20 rounded-lg mt-2">
                  {errorMessage}
                </div>
              )}

              <button disabled={status === "submitting"} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-70 mt-4">
                {status === "submitting" ? t("publicContent.contactSales.submitting") : t("publicContent.contactSales.submit")}
              </button>
              
              <div className="pt-4 border-t border-slate-800 mt-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                  {t("publicContent.contactSales.privacyNotice")} <Link href="/privacy" className="text-blue-600 hover:underline">{t("publicContent.contactSales.privacyLink")}</Link>.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
      </div>
  );
}
