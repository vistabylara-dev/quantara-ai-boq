import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import PublicFooter from "@/components/layout/public-footer";
import { publicFeatures } from "@/lib/config/features";

export const metadata: Metadata = {
  title: "Features | Quantara Early Access",
  description: "Explore the features available in Quantara's Early Access BOQ platform, features in development, and planned capabilities.",
  alternates: {
    canonical: "/features",
  },
  openGraph: {
    title: "Features | Quantara Early Access",
    description: "Explore the features available in Quantara's Early Access BOQ platform, features in development, and planned capabilities.",
    url: "https://quantara.vistabylara.com/features",
    siteName: "Quantara",
  },
};

export default function FeaturesPage() {
  const liveFeatures = publicFeatures.filter(f => f.status === "live");
  const previewFeatures = publicFeatures.filter(f => f.status === "preview");
  const inDevFeatures = publicFeatures.filter(f => f.status === "development");
  const plannedFeatures = publicFeatures.filter(f => f.status === "planned");

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#030508] text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2" aria-label="Quantara Home">
            <img src="/logo.png" alt="Quantara Logo" className="w-8 h-8 rounded-lg shadow-sm" />
            Quantara
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-slate-900 dark:text-white">Features</Link>
            <Link href="/contact-sales" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Contact Sales</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Sign In</Link>
            <Link href="/register" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 py-2">
              Request Early Access
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">Product Features</h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Quantara is currently in Controlled Early Access. Below is the status of our core BOQ and estimating capabilities.
            </p>
          </div>

          <div className="space-y-16">
            {liveFeatures.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                  Live in Early Access
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {liveFeatures.map((f, i) => (
                    <div key={i} className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h3 className="text-lg font-bold mb-2">{f.name}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{f.shortDescription}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {previewFeatures.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
                  Preview UI
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {previewFeatures.map((f, i) => (
                    <div key={i} className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm opacity-90">
                      <h3 className="text-lg font-bold mb-2">{f.name}</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">{f.shortDescription}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {inDevFeatures.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                  In Development
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {inDevFeatures.map((f, i) => (
                    <div key={i} className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm opacity-80">
                      <h3 className="text-lg font-bold mb-2">{f.name}</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">{f.shortDescription}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {plannedFeatures.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span>
                  Planned
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {plannedFeatures.map((f, i) => (
                    <div key={i} className="p-6 bg-slate-100 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm opacity-70">
                      <h3 className="text-lg font-bold mb-2">{f.name}</h3>
                      <p className="text-slate-500 dark:text-slate-500 text-sm">{f.shortDescription}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
      
      <PublicFooter />
    </div>
  );
}
