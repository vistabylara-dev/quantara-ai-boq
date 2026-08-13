"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import {
  buildSubscriptionPricingHref,
  normalizePublicPriceCode,
  normalizeSafeInternalPath,
  readPendingPricingIntent,
  storePendingPricingIntent,
} from "@/lib/commercial/pricing-intent";


function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/auth/login", { email, password });

      const queryPriceCode = normalizePublicPriceCode(searchParams.get("priceCode"));
      if (queryPriceCode) storePendingPricingIntent(queryPriceCode);
      const pendingPriceCode = queryPriceCode ?? readPendingPricingIntent();

      if (pendingPriceCode) {
        router.push(buildSubscriptionPricingHref(pendingPriceCode));
      } else {
        router.push(normalizeSafeInternalPath(searchParams.get("next")));
      }
      router.refresh();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-void min-h-screen flex flex-col justify-center items-center selection:bg-[#00F0FF]/30 font-sans relative overflow-hidden">
      <div className="scanline"></div>

      {/* Cyber Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,transparent_70%)] rounded-full blur-3xl z-0"></div>

      <div className="fixed top-6 end-6 z-10">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[360px] relative z-10 cyber-panel cyber-border p-10 rounded-sm">
        <div className="flex flex-col items-center justify-center mb-8 border-b border-white/10 pb-6">
          <div className="mb-5 h-20 w-20">
            <img src="/logo.png" alt={t("common.appName")} className="h-full w-full object-contain" />
          </div>
          <span className="terminal-text text-[10px] text-[#00F0FF] uppercase tracking-[0.3em] mb-1">{t("auth.login.authorization")}</span>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase">{t("auth.login.title")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <label htmlFor="email" className="terminal-text block text-[10px] text-slate-500 uppercase tracking-widest mb-1 group-focus-within:text-[#00F0FF] transition-colors">{t("auth.login.userId")}</label>
            <input
              id="email"
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-black/20 border border-white/10 py-3 px-4 text-sm text-[#00F0FF] placeholder:text-slate-700 focus:ring-0 focus:border-[#00F0FF]/50 focus:bg-[#00F0FF]/5 transition-all duration-300 outline-none terminal-text text-start"
              placeholder="operator@quantara.sys"
            />
          </div>
          <div className="relative group">
            <div className="flex justify-between items-end mb-1">
              <label htmlFor="password" className="terminal-text block text-[10px] text-slate-500 uppercase tracking-widest group-focus-within:text-[#00F0FF] transition-colors">{t("auth.login.passcode")}</label>
            </div>
            <input
              id="password"
              type="password"
              dir="ltr"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-black/20 border border-white/10 py-3 px-4 text-sm text-[#00F0FF] placeholder:text-slate-700 focus:ring-0 focus:border-[#00F0FF]/50 focus:bg-[#00F0FF]/5 transition-all duration-300 outline-none terminal-text tracking-[0.2em] text-start"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-[#FF0055]/10 border border-[#FF0055]/30">
               <span className="w-2 h-2 rounded-full bg-[#FF0055] animate-pulse"></span>
               <p className="terminal-text text-[10px] text-[#FF0055] uppercase tracking-wider">{error}</p>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] py-4 text-[11px] font-bold uppercase tracking-[0.4em] hover:bg-[#00F0FF] hover:text-[#030508] transition-all duration-300 active:scale-[0.98] disabled:opacity-50 overflow-hidden"
            >
              <span className="relative z-10">{isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}</span>
              <div className="absolute inset-0 bg-[#00F0FF] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
            </button>
          </div>
        </form>
      </div>

      <p className="fixed bottom-6 terminal-text text-[9px] text-slate-600 uppercase tracking-[0.3em] z-10">
        {t("auth.login.tagline")}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
