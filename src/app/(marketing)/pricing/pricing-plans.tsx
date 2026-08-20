"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buildRegisterPricingHref, normalizePublicPriceCode, storePendingPricingIntent } from "@/lib/commercial/pricing-intent";

type BillingCycle = "monthly" | "annual";

type PlanCycleDetail = {
  amount: string;
  priceCode: string;
};

export type PricingPlan = {
  key: "starter" | "professional" | "business";
  name: string;
  recommended: boolean;
  features: string[];
  ctaLabel: string;
  monthly: PlanCycleDetail;
  annual: PlanCycleDetail;
};

export type PricingPlansLabels = {
  monthly: string;
  annual: string;
  perMonth: string;
  perYear: string;
  recommended: string;
};

type PricingPlansProps = {
  plans: PricingPlan[];
  labels: PricingPlansLabels;
};

export default function PricingPlans({ plans, labels }: PricingPlansProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <div>
      <div className="mx-auto flex max-w-xs items-center justify-center rounded-full border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setBillingCycle("monthly")}
          aria-pressed={billingCycle === "monthly"}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            billingCycle === "monthly"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          {labels.monthly}
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle("annual")}
          aria-pressed={billingCycle === "annual"}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            billingCycle === "annual"
              ? "bg-blue-600 text-white"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          {labels.annual}
        </button>
      </div>

      <div className="isolate mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-8 sm:mt-16 lg:grid-cols-3">
        {plans.map((plan) => {
          const cycle = billingCycle === "monthly" ? plan.monthly : plan.annual;
          const periodLabel = billingCycle === "monthly" ? labels.perMonth : labels.perYear;
          const trustedPriceCode = normalizePublicPriceCode(cycle.priceCode);
          const registerHref = trustedPriceCode ? buildRegisterPricingHref(trustedPriceCode) : "/register";

          return (
            <div
              key={plan.key}
              className={`rounded-3xl p-8 ring-1 ${
                plan.recommended
                  ? "bg-white ring-2 ring-blue-600 shadow-xl dark:bg-slate-900"
                  : "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  className={`text-lg font-semibold leading-8 ${
                    plan.recommended ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"
                  }`}
                >
                  {plan.name}
                </h2>
                {plan.recommended && (
                  <span className="rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                    {labels.recommended}
                  </span>
                )}
              </div>

              <p className="mt-6 flex items-baseline gap-2 text-start">
                <span dir="ltr" className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {cycle.amount}
                </span>
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{periodLabel}</span>
              </p>

              <Link
                href={registerHref}
                data-price-code={cycle.priceCode}
                onClick={() => {
                  if (trustedPriceCode) storePendingPricingIntent(trustedPriceCode);
                }}
                className={`mt-8 block rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  plan.recommended
                    ? "bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                }`}
              >
                {plan.ctaLabel}
              </Link>

              <ul className="mt-8 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <CheckCircle2 className="h-6 w-5 flex-none text-blue-600" aria-hidden="true" />
                    <span dir="auto">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
