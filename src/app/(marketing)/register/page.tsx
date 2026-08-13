"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { getPublicAccessOptions } from "@/config/pricing";
import { useTranslations } from "@/lib/i18n/locale-provider";

function AccessOptionsFieldset({
  selectedOption,
  onSelect,
}: {
  selectedOption: string;
  onSelect: (option: string) => void;
}) {
  const t = useTranslations();
  const publicAccessOptions = getPublicAccessOptions(t);

  return (
    <fieldset>
      <legend className="text-3xl font-bold text-slate-900 dark:text-white mb-6">{t("publicContent.accountSetup.choiceHeading")}</legend>
      <p id="access-options-help" className="text-slate-600 dark:text-slate-400 mb-8">
        {t("publicContent.accountSetup.choiceHelp")}
      </p>

      <div className="space-y-6">
        {publicAccessOptions.map((option, index) => {
          const optionId = `access-option-${index}`;
          const descriptionId = `${optionId}-description`;
          const featuresId = `${optionId}-features`;
          const isSelected = selectedOption === option.key;

          return (
            <div
              key={option.key}
              className={`rounded-2xl p-6 ring-1 transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                isSelected
                  ? "ring-2 ring-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-md"
                  : "ring-slate-200 dark:ring-slate-800 bg-white dark:bg-slate-900/50"
              }`}
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <input
                    id={optionId}
                    type="radio"
                    name="accessOption"
                    value={option.key}
                    checked={isSelected}
                    onChange={() => onSelect(option.key)}
                    aria-describedby={`${descriptionId} ${featuresId}`}
                    className="sr-only"
                  />
                  <label htmlFor={optionId} className="flex cursor-pointer items-center gap-3">
                    <span aria-hidden="true" className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? "border-blue-600" : "border-slate-300 dark:border-slate-600"}`}>
                      {isSelected && <span className="w-3 h-3 rounded-full bg-blue-600" />}
                    </span>
                    <span className={`text-xl font-semibold ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}>
                      {option.name}
                    </span>
                  </label>
                </div>
                <p className="max-w-48 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {option.commercialTerms}
                </p>
              </div>
              <p id={descriptionId} className="text-sm text-slate-600 dark:text-slate-400 mb-4 pl-8">{option.description}</p>
              <ul id={featuresId} className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-8 grid sm:grid-cols-2 gap-x-4">
                {option.features.map((feature) => (
                  <li key={feature} className="flex gap-x-2">
                    <CheckCircle2 className="h-5 w-4 flex-none text-blue-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function RegisterPage() {
  const t = useTranslations();
  const publicAccessOptions = getPublicAccessOptions(t);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [role, setRole] = useState("Quantity Surveyor");
  const [country, setCountry] = useState("");
  const [primaryIndustry, setPrimaryIndustry] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [approximateVolume, setApproximateVolume] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<string>(publicAccessOptions[0].key);
  const [consent, setConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (registered) successHeadingRef.current?.focus();
  }, [registered]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/auth/register", { 
        companyName, fullName, email, password,
        role, country, primaryIndustry, intendedUse: intendedUse || selectedPackage, approximateVolume, consent
      });
      setRegistered(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registered) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h1 ref={successHeadingRef} tabIndex={-1} className="text-2xl font-semibold text-white outline-none">Check your email</h1>
          <p className="mt-3 text-sm text-slate-400">
            {t("publicContent.accountSetup.success")}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-12 px-4">
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Form Section */}
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 lg:sticky lg:top-24 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Quantara</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{t("publicContent.accountSetup.title")}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {t("publicContent.accountSetup.intro")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300" htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor="email">Business Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300" htmlFor="companyName">Company</label>
                <input
                  id="companyName"
                  required
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor="role">Role</label>
                <select
                  id="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none"
                >
                  <option value="Quantity Surveyor">Quantity Surveyor</option>
                  <option value="Estimator">Estimator</option>
                  <option value="Engineer">Engineer</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Procurement Professional">Procurement Professional</option>
                  <option value="Company Owner">Company Owner</option>
                  <option value="Consultant">Consultant</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300" htmlFor="country">Country</label>
                <input
                  id="country"
                  required
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300" htmlFor="approximateVolume">Monthly Project Volume</label>
                <select
                  id="approximateVolume"
                  value={approximateVolume}
                  onChange={(event) => setApproximateVolume(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none"
                >
                  <option value="">Select volume...</option>
                  <option value="1-5">1-5 projects</option>
                  <option value="6-20">6-20 projects</option>
                  <option value="21-50">21-50 projects</option>
                  <option value="50+">50+ projects</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">At least 8 characters, with a letter and a number.</p>
            </div>

            <div className="flex items-start gap-3 mt-4">
              <input 
                type="checkbox" 
                id="consent" 
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-slate-950" 
              />
              <label htmlFor="consent" className="text-sm text-slate-400">
                I consent to the collection of my information in accordance with the <Link href="/privacy" className="text-blue-400 underline hover:text-blue-300">Privacy Policy</Link>.
              </label>
            </div>

            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Submitting Request...
                  </span>
                ) : (
                  t("publicContent.accountSetup.submitPrefix", {
                    option: publicAccessOptions.find((option) => option.key === selectedPackage)?.name ?? selectedPackage,
                  })
                )}
              </button>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                We use this information to review your request and contact you. Do not submit confidential project documents through this form.
              </p>
            </div>
          </form>

          <div className="mt-6 text-sm text-slate-400 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 underline hover:text-blue-300">Sign in</Link>
          </div>
        </div>

        <AccessOptionsFieldset selectedOption={selectedPackage} onSelect={setSelectedPackage} />
      </div>
    </div>
  );
}
