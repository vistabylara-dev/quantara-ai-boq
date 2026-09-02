"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type CompanyProfile = {
  legalName: string;
  tradeName: string;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  country: string | null;
  taxRegistrationNumber: string | null;
  defaultCurrency: string;
  vatRate: number;
  defaultLanguage: string;
  logoUrl: string | null;
  authorizedSignatoryName: string | null;
  authorizedSignatoryTitle: string | null;
  stampUrl: string | null;
  signatureUrl: string | null;
  defaultTerms: string | null;
  defaultExclusions: string | null;
  defaultValidityDays: number;
};

type Branding = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  documentHeaderColor: string;
  tableHeaderColor: string;
  coverStyle: string;
  logoPosition: string;
  emailSignatureHtml: string;
  footerText: string;
};

type Tab = "profile" | "branding" | "documents";

const inputClass = "mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500";
const labelClass = "block text-sm text-slate-300";
const sublabelClass = "text-slate-400";

export default function CompanySettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [companyData, brandingData] = await Promise.all([
        apiClient.get<CompanyProfile>("/api/company", signal),
        apiClient.get<Branding>("/api/company-branding", signal),
      ]);
      setProfile(companyData);
      setBranding(brandingData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const saveProfile = useCallback(async () => {
    if (!profile) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const updated = await apiClient.put<CompanyProfile>("/api/company", profile);
      setProfile(updated);
      setSaveMessage("Company profile saved.");
    } catch (error) {
      setSaveError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [profile]);

  const saveBranding = useCallback(async () => {
    if (!branding) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const updated = await apiClient.put<Branding>("/api/company-branding", branding);
      setBranding(updated);
      setSaveMessage("Branding saved.");
    } catch (error) {
      setSaveError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [branding]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading company settings</p>
      </div>
    );
  }

  if (loadError || !profile || !branding) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Company settings unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "Could not load company settings."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Company</h1>
        <p className="mt-2 text-sm text-slate-400">Company profile, branding, and document defaults used across generated documents and proposals.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {([["profile", "Company Profile"], ["branding", "Branding"], ["documents", "Document Defaults"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm ${tab === key ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {(saveMessage || saveError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${saveError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {saveError ?? saveMessage}
          </div>
        )}
      </div>

      {tab === "profile" && (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelClass}><span className={sublabelClass}>Legal name</span><input value={profile.legalName} onChange={(e) => setProfile({ ...profile, legalName: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Trade name</span><input value={profile.tradeName} onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Email</span><input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Phone</span><input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Website</span><input value={profile.website ?? ""} onChange={(e) => setProfile({ ...profile, website: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Country</span><input value={profile.country ?? ""} onChange={(e) => setProfile({ ...profile, country: e.target.value })} className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}><span className={sublabelClass}>Address</span><input value={profile.address ?? ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Tax registration number</span><input value={profile.taxRegistrationNumber ?? ""} onChange={(e) => setProfile({ ...profile, taxRegistrationNumber: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Default currency</span><input value={profile.defaultCurrency} onChange={(e) => setProfile({ ...profile, defaultCurrency: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>VAT rate (%)</span><input type="number" value={profile.vatRate} onChange={(e) => setProfile({ ...profile, vatRate: Number(e.target.value) })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Default language</span><input value={profile.defaultLanguage} onChange={(e) => setProfile({ ...profile, defaultLanguage: e.target.value })} className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>
              <span className={sublabelClass}>Company logo URL</span>
              <input value={profile.logoUrl ?? ""} onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })} className={inputClass} placeholder="https://example.com/logo.png" />
              <span className="mt-1 block text-xs text-slate-500">Provide a public PNG, JPG, or GIF image URL. It will appear on your generated BOQs and client proposals.</span>
              {profile.logoUrl && (
                <span className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3">
                  <img
                    src={profile.logoUrl}
                    alt="Company logo preview"
                    className="h-12 w-auto max-w-[160px] rounded-lg border border-slate-800 bg-white object-contain p-1"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "block";
                    }}
                    onLoad={(e) => {
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "none";
                    }}
                  />
                  <span className="hidden text-xs text-rose-300">Could not load this image — check the URL is public and points directly to a PNG, JPG, or GIF file.</span>
                </span>
              )}
            </label>
            <label className={labelClass}><span className={sublabelClass}>Authorized signatory name</span><input value={profile.authorizedSignatoryName ?? ""} onChange={(e) => setProfile({ ...profile, authorizedSignatoryName: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Authorized signatory title</span><input value={profile.authorizedSignatoryTitle ?? ""} onChange={(e) => setProfile({ ...profile, authorizedSignatoryTitle: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Stamp image URL</span><input value={profile.stampUrl ?? ""} onChange={(e) => setProfile({ ...profile, stampUrl: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}><span className={sublabelClass}>Signature image URL</span><input value={profile.signatureUrl ?? ""} onChange={(e) => setProfile({ ...profile, signatureUrl: e.target.value })} className={inputClass} /></label>
          </div>
          <button type="button" onClick={() => void saveProfile()} disabled={isSaving} className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {isSaving ? "Saving…" : "Save company profile"}
          </button>
        </div>
      )}

      {tab === "documents" && (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <label className={labelClass}>
            <span className={sublabelClass}>Default validity (days)</span>
            <input type="number" value={profile.defaultValidityDays} onChange={(e) => setProfile({ ...profile, defaultValidityDays: Number(e.target.value) })} className={`${inputClass} max-w-xs`} />
          </label>
          <label className={`${labelClass} mt-4`}>
            <span className={sublabelClass}>Default terms</span>
            <textarea value={profile.defaultTerms ?? ""} onChange={(e) => setProfile({ ...profile, defaultTerms: e.target.value })} rows={4} className={inputClass} />
          </label>
          <label className={`${labelClass} mt-4`}>
            <span className={sublabelClass}>Default exclusions</span>
            <textarea value={profile.defaultExclusions ?? ""} onChange={(e) => setProfile({ ...profile, defaultExclusions: e.target.value })} rows={4} className={inputClass} />
          </label>
          <button type="button" onClick={() => void saveProfile()} disabled={isSaving} className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {isSaving ? "Saving…" : "Save document defaults"}
          </button>
        </div>
      )}

      {tab === "branding" && (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {([["primaryColor", "Primary colour"], ["secondaryColor", "Secondary colour"], ["accentColor", "Accent colour"], ["documentHeaderColor", "Document header colour"], ["tableHeaderColor", "Table header colour"]] as const).map(([key, label]) => (
                  <label key={key} className={labelClass}>
                    <span className={sublabelClass}>{label}</span>
                    <input type="color" value={branding[key]} onChange={(e) => setBranding({ ...branding, [key]: e.target.value })} className="mt-2 h-11 w-full rounded-2xl border border-slate-800 bg-slate-900" />
                  </label>
                ))}
              </div>
              <label className={labelClass}>
                <span className={sublabelClass}>Cover style</span>
                <select value={branding.coverStyle} onChange={(e) => setBranding({ ...branding, coverStyle: e.target.value })} className={inputClass}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className={labelClass}>
                <span className={sublabelClass}>Logo position</span>
                <select value={branding.logoPosition} onChange={(e) => setBranding({ ...branding, logoPosition: e.target.value })} className={inputClass}>
                  <option value="top-left">Top left</option>
                  <option value="top-center">Top center</option>
                  <option value="top-right">Top right</option>
                </select>
              </label>
              <label className={labelClass}>
                <span className={sublabelClass}>Footer text</span>
                <input value={branding.footerText} onChange={(e) => setBranding({ ...branding, footerText: e.target.value })} className={inputClass} />
              </label>
              <label className={labelClass}>
                <span className={sublabelClass}>Email signature (HTML, sanitized on save)</span>
                <textarea value={branding.emailSignatureHtml} onChange={(e) => setBranding({ ...branding, emailSignatureHtml: e.target.value })} rows={4} className={inputClass} />
              </label>
              <button type="button" onClick={() => void saveBranding()} disabled={isSaving} className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                {isSaving ? "Saving…" : "Save branding"}
              </button>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Preview</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800" style={{ background: branding.coverStyle === "dark" ? branding.primaryColor : "#ffffff" }}>
                <div className="p-6" style={{ textAlign: branding.logoPosition === "top-center" ? "center" : branding.logoPosition === "top-right" ? "right" : "left" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: branding.coverStyle === "dark" ? "#ffffff" : branding.primaryColor }}>
                    {profile.tradeName || profile.legalName || "Your company"}
                  </p>
                </div>
                <div className="px-6 pb-4">
                  <div className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ background: branding.tableHeaderColor }}>Item · Description · Amount</div>
                  <div className="mt-2 h-2 w-1/3 rounded-full" style={{ background: branding.accentColor }} />
                </div>
                <div className="border-t border-slate-200 px-6 py-3 text-center text-[10px]" style={{ color: branding.coverStyle === "dark" ? "#cbd5e1" : "#64748b" }}>
                  {branding.footerText || "Footer text preview"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
