"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordKeyState = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState("CapsLock"));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/api/auth/login", {
        email: email.trim(),
        password,
      });

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
    <main className="relative min-h-screen overflow-hidden bg-[#030508] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 15%, rgba(14,165,233,0.14), transparent 30%), radial-gradient(circle at 85% 80%, rgba(99,102,241,0.12), transparent 34%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.13) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="absolute end-5 top-5 z-20 sm:end-8 sm:top-8">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#07101D]/85 shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden min-h-[670px] overflow-hidden border-e border-white/10 p-12 lg:flex lg:flex-col lg:justify-between">
            <div
              aria-hidden="true"
              className="absolute -start-32 -top-32 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl"
            />

            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
                  <ShieldCheck className="h-6 w-6 text-sky-300" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                    {t("auth.login.authorization")}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{t("common.appName")}</p>
                </div>
              </div>

              <h2 className="mt-14 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.03em] text-white">
                {t("auth.login.workspaceHeading")}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
                {t("auth.login.workspaceBody")}
              </p>

              <div className="mt-10 space-y-4">
                {[
                  t("auth.login.featureReviewed"),
                  t("auth.login.featureMeasurement"),
                  t("auth.login.featureOutputs"),
                ].map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-sky-300" aria-hidden="true" />
                    <span className="text-sm leading-6 text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center gap-3">
                <LockKeyhole className="h-5 w-5 text-sky-300" aria-hidden="true" />
                <p className="text-sm leading-6 text-slate-300">{t("auth.login.secureNote")}</p>
              </div>
            </div>
          </section>

          <section className="flex min-h-[670px] items-center p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-9">
                <div className="mb-8 h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-xl">
                  <img
                    src="/logo.png"
                    alt={t("common.appName")}
                    className="h-full w-full object-contain"
                  />
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
                  {t("auth.login.authorization")}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                  {t("auth.login.title")}
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">{t("auth.login.subtitle")}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                    {t("auth.login.userId")}
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      dir="ltr"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      onBlur={() => setEmail((current) => current.trim())}
                      aria-invalid={Boolean(error)}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 py-3.5 pe-4 ps-12 text-start text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-400/60 focus:bg-sky-400/[0.035] focus:ring-4 focus:ring-sky-400/10"
                      placeholder={t("auth.login.emailPlaceholder")}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label htmlFor="password" className="text-sm font-medium text-slate-200">
                      {t("auth.login.passcode")}
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-sky-300 transition hover:text-sky-200 hover:underline"
                    >
                      {t("auth.login.forgotPassword")}
                    </Link>
                  </div>

                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      dir="ltr"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={handlePasswordKeyState}
                      onKeyUp={handlePasswordKeyState}
                      aria-invalid={Boolean(error)}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 py-3.5 pe-14 ps-12 text-start text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-sky-400/60 focus:bg-sky-400/[0.035] focus:ring-4 focus:ring-sky-400/10"
                      placeholder={t("auth.login.passwordPlaceholder")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute end-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                      aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                      title={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {capsLockOn && (
                    <p className="mt-2 text-xs font-medium text-amber-300" role="status">
                      {t("auth.login.capsLockOn")}
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] px-4 py-3.5"
                  >
                    <p className="text-sm leading-6 text-rose-200">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-5 py-3.5 text-sm font-semibold text-[#03111A] shadow-[0_12px_32px_rgba(56,189,248,0.16)] transition hover:bg-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {t("auth.login.submitting")}
                    </>
                  ) : (
                    <>
                      {t("auth.login.submit")}
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-7 border-t border-white/10 pt-6 text-center">
                <p className="text-sm text-slate-400">
                  {t("auth.login.newToQuantara")}{" "}
                  <Link
                    href="/register"
                    className="font-semibold text-sky-300 transition hover:text-sky-200 hover:underline"
                  >
                    {t("auth.login.createAccount")}
                  </Link>
                </p>
              </div>

              <p className="mt-8 text-center text-xs leading-5 text-slate-600">
                {t("auth.login.tagline")}
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}