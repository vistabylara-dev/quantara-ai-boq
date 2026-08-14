"use client";

import { Bug, HelpCircle, Lightbulb, Mail, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { siteConfig } from "@/config/site";
import { apiClient } from "@/lib/api/client";
import { LtrText } from "@/lib/i18n/ltr-text";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { SupportContactRequest } from "@/lib/support/contact-request";

export type HelpFeedbackSurface = "PUBLIC" | "SAAS";

type SessionData =
  | { authenticated: false }
  | {
      authenticated: true;
      user: { email: string };
    };

type FormState = {
  requestType: SupportContactRequest["requestType"];
  title: string;
  description: string;
  goal: string;
  email: string;
  company: string;
  consent: boolean;
};

const initialForm: FormState = {
  requestType: "HELP",
  title: "",
  description: "",
  goal: "",
  email: "",
  company: "",
  consent: false,
};

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function HelpFeedbackBubble({
  surface,
  currentRoute,
}: {
  surface: HelpFeedbackSurface;
  currentRoute: string;
}) {
  const { locale, direction, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const previousRouteRef = useRef(currentRoute);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (previousRouteRef.current === currentRoute) return;
    previousRouteRef.current = currentRoute;
    setOpen(false);
  }, [currentRoute]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => closeRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open || form.email) return;
    const controller = new AbortController();
    apiClient
      .get<SessionData>("/api/auth/session", controller.signal)
      .then((session) => {
        if (session.authenticated) {
          setForm((current) => ({ ...current, email: current.email || session.user.email }));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [form.email, open]);

  const openPanel = (requestType?: FormState["requestType"]) => {
    setStatus("idle");
    if (requestType) setForm((current) => ({ ...current, requestType }));
    setOpen(true);
  };

  const chooseType = (requestType: FormState["requestType"]) => {
    setForm((current) => ({ ...current, requestType }));
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;
    if (!form.consent) {
      setStatus("error");
      return;
    }
    setStatus("submitting");

    try {
      await apiClient.post<{ requestId: string; deliveryStatus: "stored" }>("/api/contact", {
        kind: "SUPPORT",
        requestType: form.requestType,
        title: form.title,
        description: form.description,
        goal: form.goal,
        email: form.email,
        company: form.company,
        consent: true,
        context: {
          currentRoute,
          surface,
          locale,
        },
        website: "",
      } satisfies SupportContactRequest);
      setStatus("success");
      requestAnimationFrame(() => successRef.current?.focus());
    } catch {
      setStatus("error");
    }
  };

  return (
    <div data-theme={surface === "PUBLIC" ? "dark" : undefined} dir={direction} className="contents">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="help-feedback-dialog"
        onClick={() => (open ? close(true) : openPanel())}
        className="fixed end-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-blue-500/40 bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:border-[#21C7F3]/40 dark:bg-[#091326] dark:text-[#21C7F3] dark:hover:bg-[#101D34]"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <HelpCircle className="h-5 w-5" aria-hidden="true" />
        <span>{t("support.label")}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] bg-black/45"
          onClick={(event) => {
            if (event.target === event.currentTarget) close(true);
          }}
        >
          <div
            ref={panelRef}
            id="help-feedback-dialog"
            role="dialog"
            dir={direction}
            aria-modal="true"
            aria-labelledby="help-feedback-title"
            className="fixed bottom-4 end-4 max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-start text-slate-900 shadow-2xl dark:border-[#20304D] dark:bg-[#091326] dark:text-white sm:bottom-20 sm:max-h-[calc(100dvh-6rem)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-[#21C7F3]">Quantara</p>
                <h2 id="help-feedback-title" className="mt-1 text-xl font-bold">{t("support.dialogTitle")}</h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => close(true)}
                aria-label={t("support.close")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#20304D] dark:text-slate-300 dark:hover:bg-[#101D34]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => chooseType("FEATURE")} className="min-h-11 rounded-xl border border-slate-200 p-3 text-start hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#20304D] dark:hover:border-[#21C7F3]/60 dark:hover:bg-[#101D34]">
                <Lightbulb className="mb-2 h-5 w-5 text-blue-600 dark:text-[#21C7F3]" aria-hidden="true" />
                <span className="block text-sm font-semibold">{t("support.featureTitle")}</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{t("support.featureDescription")}</span>
              </button>
              <button type="button" onClick={() => chooseType("PROBLEM")} className="min-h-11 rounded-xl border border-slate-200 p-3 text-start hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#20304D] dark:hover:border-[#21C7F3]/60 dark:hover:bg-[#101D34]">
                <Bug className="mb-2 h-5 w-5 text-blue-600 dark:text-[#21C7F3]" aria-hidden="true" />
                <span className="block text-sm font-semibold">{t("support.problemTitle")}</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{t("support.problemDescription")}</span>
              </button>
              <a href={`mailto:${siteConfig.contact.email}`} className="min-h-11 rounded-xl border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#20304D] dark:hover:border-[#21C7F3]/60 dark:hover:bg-[#101D34]">
                <Mail className="mb-2 h-5 w-5 text-blue-600 dark:text-[#21C7F3]" aria-hidden="true" />
                <span className="block text-sm font-semibold">{t("support.emailTitle")}</span>
                <LtrText className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{siteConfig.contact.email}</LtrText>
              </a>
              <a href={siteConfig.contact.whatsappLink} className="min-h-11 rounded-xl border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#20304D] dark:hover:border-[#21C7F3]/60 dark:hover:bg-[#101D34]">
                <MessageCircle className="mb-2 h-5 w-5 text-blue-600 dark:text-[#21C7F3]" aria-hidden="true" />
                <span className="block text-sm font-semibold">{t("support.directTitle")}</span>
                <LtrText className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{siteConfig.contact.whatsapp}</LtrText>
              </a>
            </div>

            <button type="button" onClick={() => chooseType("SALES")} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-start text-sm hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-[#20304D] dark:hover:border-[#21C7F3]/60 dark:hover:bg-[#101D34]">
              <span className="font-semibold">{t("support.salesTitle")}</span>
              <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">{t("support.salesDescription")}</span>
            </button>

            <div className="my-5 border-t border-slate-200 dark:border-[#20304D]" />

            {status === "success" ? (
              <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100">
                <h3 ref={successRef} tabIndex={-1} className="font-bold outline-none">{t("support.successTitle")}</h3>
                <p className="mt-1 text-sm">{t("support.successBody")}</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h3 className="text-base font-bold">{t("support.formHeading")}</h3>

                <div>
                  <label htmlFor="support-request-type" className="mb-1 block text-sm font-medium">{t("support.requestType")}</label>
                  <select id="support-request-type" value={form.requestType} onChange={(event) => setForm({ ...form, requestType: event.target.value as FormState["requestType"] })} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#20304D] dark:bg-[#030508]">
                    <option value="FEATURE">{t("support.typeFeature")}</option>
                    <option value="PROBLEM">{t("support.typeProblem")}</option>
                    <option value="HELP">{t("support.typeHelp")}</option>
                    <option value="SALES">{t("support.typeSales")}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="support-title" className="mb-1 block text-sm font-medium">{t("support.title")}</label>
                  <input ref={titleRef} id="support-title" required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={t("support.titlePlaceholder")} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#20304D] dark:bg-[#030508]" />
                </div>

                <div>
                  <label htmlFor="support-description" className="mb-1 block text-sm font-medium">{t("support.description")}</label>
                  <textarea id="support-description" required maxLength={4000} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={t("support.descriptionPlaceholder")} className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#20304D] dark:bg-[#030508]" />
                </div>

                <div>
                  <label htmlFor="support-goal" className="mb-1 block text-sm font-medium">{t("support.goal")}</label>
                  <textarea id="support-goal" required maxLength={2000} rows={3} value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} placeholder={t("support.goalPlaceholder")} className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#20304D] dark:bg-[#030508]" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="support-email" className="mb-1 block text-sm font-medium">{t("support.email")}</label>
                    <input id="support-email" required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} dir="ltr" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-start text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#20304D] dark:bg-[#030508]" />
                  </div>
                  <div>
                    <label htmlFor="support-company" className="mb-1 block text-sm font-medium">{t("support.company")} <span className="text-xs text-slate-500">({t("support.optional")})</span></label>
                    <input id="support-company" maxLength={255} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#20304D] dark:bg-[#030508]" />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input id="support-consent" required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-[#20304D] dark:bg-[#030508]" />
                  <label htmlFor="support-consent" className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {t("support.consent")} {" "}
                    <Link href="/privacy" className="font-semibold text-blue-600 hover:underline dark:text-[#21C7F3]">{t("support.privacyLink")}</Link>
                  </label>
                </div>

                {status === "error" ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-200">{t("support.error")}</p> : null}

                <button disabled={status === "submitting"} type="submit" className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#21C7F3] dark:text-[#030508] dark:hover:bg-[#5AD9F7]">
                  {status === "submitting" ? t("support.submitting") : t("support.submit")}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
