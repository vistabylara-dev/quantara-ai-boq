"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import {
  hasActiveLeadDismissal,
  hasDashboardLeadSessionBeenShown,
  hasPermanentLeadSubmission,
  inferLeadPackageInterest,
  isDashboardLeadCaptureEligiblePath,
  isLeadCaptureEligiblePath,
  mergeAuthenticatedLeadPrefill,
  recordDashboardLeadSessionShown,
  recordLeadDismissal,
  recordPermanentLeadSubmission,
  resolveLeadAttribution,
  storeLeadPackageInterest,
  type LeadAttribution,
  type LeadPrefillSession,
} from "@/lib/marketing/lead-capture-client";

const AUTO_OPEN_DELAY_MS = 15_000;
const MEANINGFUL_SCROLL_RATIO = 0.35;

type LeadForm = {
  fullName: string;
  email: string;
  mobile: string;
  company: string;
  industry: string;
  marketingConsent: boolean;
  website: string;
};

const INITIAL_FORM: LeadForm = {
  fullName: "",
  email: "",
  mobile: "",
  company: "",
  industry: "",
  marketingConsent: false,
  website: "",
};

const EMPTY_ATTRIBUTION: LeadAttribution = {
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
};

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function LeadCapturePopup({
  mode,
}: {
  mode: "public" | "dashboard";
}) {
  const pathname = usePathname() || "/";
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(INITIAL_FORM);
  const [packageInterest, setPackageInterest] = useState("");
  const [attribution, setAttribution] = useState<LeadAttribution>(EMPTY_ATTRIBUTION);
  const [dashboardSession, setDashboardSession] = useState<LeadPrefillSession | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const statusRef = useRef(status);
  const explicitPackageInterestRef = useRef(false);
  statusRef.current = status;
  const eligiblePath = mode === "public"
    ? isLeadCaptureEligiblePath(pathname)
    : isDashboardLeadCaptureEligiblePath(pathname);

  const dismiss = useCallback(() => {
    if (statusRef.current !== "success" && mode === "public") recordLeadDismissal();
    setOpen(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, [mode]);

  useEffect(() => {
    if (mode !== "dashboard" || !eligiblePath) {
      setDashboardSession(null);
      return;
    }

    const controller = new AbortController();
    apiClient
      .get<LeadPrefillSession>("/api/auth/session", controller.signal)
      .then((session) => {
        setDashboardSession(session);
        setForm((current) => mergeAuthenticatedLeadPrefill(current, session));
      })
      .catch(() => setDashboardSession({ authenticated: false }));
    return () => controller.abort();
  }, [eligiblePath, mode]);

  useEffect(() => {
    setOpen(false);
    setStatus("idle");
    setErrorMessage("");
    explicitPackageInterestRef.current = false;

    if (!eligiblePath) return;
    if (mode === "public" && (hasPermanentLeadSubmission() || hasActiveLeadDismissal())) return;
    if (
      mode === "dashboard"
      && (dashboardSession?.authenticated !== true || hasDashboardLeadSessionBeenShown())
    ) return;

    setPackageInterest(mode === "public" ? inferLeadPackageInterest(pathname) : "");
    setAttribution(resolveLeadAttribution(window.location.search));

    let opened = false;
    let retryTimer: number | undefined;

    const stopListening = () => {
      window.removeEventListener("scroll", handleScroll);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };

    const attemptOpen = () => {
      if (opened) return;
      if (mode === "public" && (hasPermanentLeadSubmission() || hasActiveLeadDismissal())) return;
      if (mode === "dashboard" && hasDashboardLeadSessionBeenShown()) return;
      if (document.querySelector('[aria-modal="true"]')) {
        retryTimer = window.setTimeout(attemptOpen, 3_000);
        return;
      }
      opened = true;
      if (mode === "dashboard") recordDashboardLeadSessionShown();
      stopListening();
      setOpen(true);
    };

    const handleScroll = () => {
      const scrollableDistance = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        0,
      );
      if (
        scrollableDistance > 0
        && window.scrollY / scrollableDistance >= MEANINGFUL_SCROLL_RATIO
      ) {
        attemptOpen();
      }
    };

    const delayTimer = window.setTimeout(attemptOpen, AUTO_OPEN_DELAY_MS);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.clearTimeout(delayTimer);
      stopListening();
    };
  }, [dashboardSession, eligiblePath, mode, pathname]);

  useEffect(() => {
    if (mode !== "public" || !isLeadCaptureEligiblePath(pathname)) return;

    const rememberElement = (element: Element | null, explicit: boolean) => {
      if (!(element instanceof HTMLElement)) return;
      if (!explicit && explicitPackageInterestRef.current) return;
      const value = element.dataset.leadPackageInterest;
      if (!value) return;
      if (explicit) explicitPackageInterestRef.current = true;
      const stored = storeLeadPackageInterest(value);
      if (stored) setPackageInterest(stored);
    };

    const handleInteraction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      rememberElement(target.closest("[data-lead-package-interest]"), true);
    };

    document.addEventListener("pointerdown", handleInteraction, true);
    document.addEventListener("focusin", handleInteraction, true);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const mostVisible = entries
            .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55)
            .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
          if (mostVisible) rememberElement(mostVisible.target, false);
        },
        { threshold: [0.55, 0.75] },
      );
      document
        .querySelectorAll("[data-lead-package-interest]")
        .forEach((element) => observer?.observe(element));
    }

    return () => {
      document.removeEventListener("pointerdown", handleInteraction, true);
      document.removeEventListener("focusin", handleInteraction, true);
      observer?.disconnect();
    };
  }, [mode, pathname]);

  useEffect(() => {
    if (!open || mode !== "public") return;
    const controller = new AbortController();
    apiClient
      .get<LeadPrefillSession>("/api/auth/session", controller.signal)
      .then((session) => setForm((current) => mergeAuthenticatedLeadPrefill(current, session)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [mode, open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismiss, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;
    if (!form.marketingConsent) {
      setStatus("error");
      setErrorMessage("Please confirm marketing consent before submitting.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      await apiClient.post<{ received: true }>("/api/marketing/leads", {
        fullName: form.fullName,
        email: form.email,
        mobile: form.mobile,
        company: form.company,
        industry: form.industry,
        packageInterest,
        page: pathname,
        ...attribution,
        marketingConsent: true,
        website: form.website,
      });
      if (mode === "public") recordPermanentLeadSubmission();
      else recordDashboardLeadSessionShown();
      setStatus("success");
      requestAnimationFrame(() => successRef.current?.focus());
    } catch (error) {
      setStatus("error");
      setErrorMessage(getApiErrorMessage(error));
    }
  };

  if (!open || !eligiblePath) return null;

  return (
    <div
      data-theme="dark"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        id="marketing-lead-capture-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketing-lead-capture-title"
        aria-describedby="marketing-lead-capture-description"
        dir="ltr"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-blue-400/25 bg-[#07101f] p-5 text-start text-white shadow-2xl shadow-blue-950/50 sm:p-7"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          aria-label="Close lead form"
          className="absolute end-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="pe-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Quantara</p>
          <h2 id="marketing-lead-capture-title" className="mt-2 text-2xl font-bold sm:text-3xl">
            {t("leadCapture.title")}
          </h2>
          <p id="marketing-lead-capture-description" className="mt-3 text-sm leading-6 text-slate-300">
            {t("leadCapture.description")}
          </p>
        </div>

        {status === "success" ? (
          <div className="mt-7 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-100" role="status" aria-live="polite">
            <p ref={successRef} tabIndex={-1} className="font-semibold outline-none">
              {t("leadCapture.success")}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="lead-full-name" className="mb-1.5 block text-sm font-medium text-slate-200">
                  {t("leadCapture.fullName")} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="lead-full-name"
                  name="fullName"
                  required
                  autoComplete="name"
                  maxLength={160}
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#030508] px-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
              </div>

              <div>
                <label htmlFor="lead-email" className="mb-1.5 block text-sm font-medium text-slate-200">
                  {t("leadCapture.email")} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="lead-email"
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#030508] px-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
              </div>

              <div>
                <label htmlFor="lead-mobile" className="mb-1.5 block text-sm font-medium text-slate-200">
                  {t("leadCapture.mobile")} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="lead-mobile"
                  name="mobile"
                  required
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  placeholder="+971 50 123 4567"
                  value={form.mobile}
                  onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#030508] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
              </div>

              <div>
                <label htmlFor="lead-company" className="mb-1.5 block text-sm font-medium text-slate-200">
                  Company
                </label>
                <input
                  id="lead-company"
                  name="company"
                  autoComplete="organization"
                  maxLength={255}
                  value={form.company}
                  onChange={(event) => setForm({ ...form, company: event.target.value })}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#030508] px-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
              </div>

              <div>
                <label htmlFor="lead-industry" className="mb-1.5 block text-sm font-medium text-slate-200">
                  {t("leadCapture.industry")} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="lead-industry"
                  name="industry"
                  required
                  list="quantara-lead-industries"
                  maxLength={160}
                  value={form.industry}
                  onChange={(event) => setForm({ ...form, industry: event.target.value })}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-[#030508] px-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
                <datalist id="quantara-lead-industries">
                  <option value="Construction & Contracting" />
                  <option value="Quantity Surveying & Cost Consultancy" />
                  <option value="MEP Contracting" />
                  <option value="Fit-Out & Interior Contracting" />
                  <option value="Facilities Management" />
                  <option value="Engineering Consultancy" />
                  <option value="Real Estate Development" />
                </datalist>
              </div>
            </div>

            {packageInterest ? (
              <p className="rounded-xl border border-blue-400/15 bg-blue-400/5 px-3 py-2 text-xs text-blue-100">
                {t("leadCapture.packageInterest")} <span className="font-semibold">{packageInterest}</span>
              </p>
            ) : null}

            <div className="absolute -start-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              <label htmlFor="lead-website">Website</label>
              <input
                id="lead-website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="lead-marketing-consent"
                name="marketingConsent"
                required
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(event) => setForm({ ...form, marketingConsent: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-[#030508] text-blue-500 focus:ring-blue-400"
              />
              <label htmlFor="lead-marketing-consent" className="text-xs leading-5 text-slate-300">
                {t("leadCapture.marketingConsent")}
              </label>
            </div>

            {status === "error" ? (
              <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100">
                {errorMessage || "Please check the form and try again."}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="min-h-12 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "submitting" ? t("leadCapture.submitting") : t("leadCapture.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
