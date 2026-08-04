import Link from "next/link";
import Script from "next/script";
import { demoProjects } from "@/data/demo-projects";
import { demoIndustries } from "@/config/industries";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quantara AI BOQ | Advanced Quantity Intelligence & Geo AI in UAE",
  description: "Transform your construction projects with Quantara AI BOQ by Vista By Lara. The premier enterprise platform for Quantity Intelligence and Geo AI in Dubai and the UAE.",
  keywords: ["AI BOQ", "Quantity Surveying UAE", "Geo AI Construction", "Dubai Project Management", "Vista By Lara", "Quantity Intelligence"],
};

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Quantara AI BOQ",
        "operatingSystem": "Web",
        "applicationCategory": "BusinessApplication",
        "description": "Enterprise-grade AI-powered Bill of Quantities (BOQ) management platform powered by Geo AI and structural intelligence.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "provider": {
          "@id": "#organization"
        }
      },
      {
        "@type": "Organization",
        "@id": "#organization",
        "name": "Vista By Lara",
        "url": "https://www.vistabylara.com",
        "email": "solution@vistabylara.com",
        "telephone": "+971507994292",
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+971507994292",
          "contactType": "Customer Support",
          "email": "solution@vistabylara.com",
          "availableLanguage": ["English", "Arabic"]
        },
        "location": {
          "@type": "Place",
          "name": "Dubai, UAE"
        }
      }
    ]
  };

  return (
    <>
      <Script
        id="schema-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full">
        
        {/* SEO Visually Hidden Header for Screen Readers / Crawlers */}
        <header className="sr-only">
          <h1>Quantara AI BOQ: Quantity intelligence for Construction and Engineering in UAE</h1>
        </header>

        <article className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] items-start">
          
          {/* Main Content Area */}
          <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-10 w-full overflow-hidden shadow-xl" aria-labelledby="hero-heading">
            <span className="inline-flex rounded-full bg-slate-900 px-4 py-1 text-[10px] sm:text-xs uppercase tracking-[0.32em] text-slate-400 font-semibold mb-6">
              Advanced Quantity Intelligence & Geo AI
            </span>
            <div className="space-y-4">
              <h2 id="hero-heading" className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tight leading-tight">
                Quantara AI BOQ Platform
              </h2>
              <p className="max-w-2xl text-base sm:text-lg text-slate-400 leading-relaxed">
                A production-minded foundation for project-based Bill of Quantities management, powered by specialized industry engines, advanced Geo AI algorithms, and local data persistence.
              </p>
            </div>
            
            {/* Live Metrics Grid */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="System Metrics">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-center transition hover:border-slate-700">
                <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-slate-500 font-medium">Projects</p>
                <p className="mt-2 sm:mt-3 text-3xl font-bold text-white">{demoProjects.length}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-center transition hover:border-slate-700">
                <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-slate-500 font-medium">Engines</p>
                <p className="mt-2 sm:mt-3 text-3xl font-bold text-white">{demoIndustries.length}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-center transition hover:border-slate-700">
                <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-slate-500 font-medium">Storage</p>
                <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-bold text-emerald-400">Ready</p>
              </div>
            </div>

            {/* CTAs */}
            <nav className="mt-10 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center" aria-label="Primary Actions">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-8 py-4 text-sm font-semibold text-white transition hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/20 active:scale-95"
              >
                Open Dashboard Access
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-8 py-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white active:scale-95"
              >
                Manage Active Projects
              </Link>
            </nav>
          </section>

          {/* Sidebar / Quick Start */}
          <aside className="space-y-6 w-full flex flex-col">
            
            <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-8 w-full shadow-lg" aria-labelledby="getting-started-heading">
              <h3 id="getting-started-heading" className="text-xl font-semibold text-white mb-6">Getting Started Guide</h3>
              <ul className="space-y-4 text-slate-400">
                <li className="rounded-3xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700">
                  <h4 className="font-semibold text-white text-base">1. Create a New Project</h4>
                  <p className="mt-2 text-sm leading-relaxed">Choose an industry engine and begin structuring your BOQ items with our Geo AI assistance.</p>
                </li>
                <li className="rounded-3xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700">
                  <h4 className="font-semibold text-white text-base">2. Review Industry Engines</h4>
                  <p className="mt-2 text-sm leading-relaxed">Inspect engine section sets, rules, and intelligent validation guidance tailored for each specific trade.</p>
                </li>
                <li className="rounded-3xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700">
                  <h4 className="font-semibold text-white text-base">3. View the Catalogue</h4>
                  <p className="mt-2 text-sm leading-relaxed">Reference standardized catalogue items to quickly construct recurring BOQ work packages.</p>
                </li>
              </ul>
            </section>

            <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-8 w-full shadow-lg" aria-labelledby="highlights-heading">
              <h3 id="highlights-heading" className="text-xl font-semibold text-white mb-6">Workspace Highlights</h3>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-center transition hover:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium">Recent Engine</p>
                  <p className="mt-2 text-sm sm:text-base font-semibold text-white truncate" title={demoIndustries[0]?.name}>{demoIndustries[0]?.name}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 flex flex-col justify-center transition hover:border-slate-700">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium">Active Sample</p>
                  <p className="mt-2 text-sm sm:text-base font-semibold text-white truncate" title={demoProjects[0]?.name}>{demoProjects[0]?.name}</p>
                </div>
              </div>
            </section>

          </aside>
        </article>
      </main>
    </>
  );
}
