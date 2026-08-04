import Link from "next/link";
import Script from "next/script";
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
      <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-500/30">
        
        {/* Navigation */}
        <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20">
                Q
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Quantara <span className="text-blue-500">AI</span></span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="#features" className="hidden text-sm font-medium hover:text-white sm:block transition">Features</Link>
              <Link href="#faq" className="hidden text-sm font-medium hover:text-white sm:block transition">FAQ</Link>
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-slate-200 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                Login
              </Link>
            </div>
          </div>
        </nav>

        <main>
          {/* Hero Section */}
          <section className="relative overflow-hidden pt-24 pb-32">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"></div>
            <div className="relative mx-auto max-w-7xl px-6 text-center">
              <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-8 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                Enterprise BOQ Engine V1.0
              </span>
              <h1 className="mx-auto max-w-5xl text-5xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-8xl">
                Advanced <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Quantity Intelligence</span> & Geo AI
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed">
                Transform your construction projects with Quantara AI BOQ by Vista By Lara. The premier enterprise platform for intelligent Bill of Quantities management in Dubai and the UAE.
              </p>
              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-blue-600 px-8 py-4 text-base font-bold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-600/25 active:scale-95"
                >
                  Login to Workspace
                </Link>
                <Link
                  href="#features"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-8 py-4 text-base font-bold text-white transition hover:bg-slate-800 hover:border-slate-600 active:scale-95"
                >
                  Explore Capabilities
                </Link>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="py-24 bg-slate-900/50 border-t border-slate-800/50">
            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center mb-20">
                <h2 className="text-3xl font-bold text-white sm:text-5xl tracking-tight">Engineered for Precision</h2>
                <p className="mt-4 text-slate-400 max-w-2xl mx-auto">Our specialized AI models process complex architectural data directly into structured quantity workflows.</p>
              </div>

              <div className="grid gap-8 md:grid-cols-3">
                {/* Feature 1 */}
                <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 transition hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                  <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                    <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Geo AI Integration</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">
                    Utilize localized mapping and regional market analytics specifically tailored for Dubai and the broader UAE construction sector.
                  </p>
                </div>
                {/* Feature 2 */}
                <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 transition hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                  <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                    <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Industry Engines</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">
                    Pre-configured calculation logic and rulesets designed for structural, architectural, MEP, and civil engineering disciplines.
                  </p>
                </div>
                {/* Feature 3 */}
                <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 transition hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                  <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                    <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Local Persistence</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">
                    High-performance local storage and caching ensures your BOQ structures are secure, always accessible, and incredibly fast to edit.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section id="faq" className="py-24 border-t border-slate-800/50">
            <div className="mx-auto max-w-4xl px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-white sm:text-4xl">Frequently Asked Questions</h2>
              </div>
              <div className="space-y-6">
                
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-2">What is Quantara AI BOQ?</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Quantara is an enterprise-grade platform developed by Vista By Lara that leverages Artificial Intelligence to automate, structure, and manage Bills of Quantities for large-scale construction and engineering projects in the UAE.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-2">How does Geo AI improve Quantity Surveying?</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    By integrating geographical data specific to the region (such as Dubai logistics, local supplier constraints, and site conditions), our Geo AI can predict material wastage, delivery logistics costs, and provide a much more accurate contextual BOQ estimation.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-2">Is my project data secure?</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Absolutely. Quantara AI uses advanced encryption and secure enterprise persistence layers to guarantee that your proprietary pricing models and project details remain strictly confidential and sovereign.
                  </p>
                </div>

              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-950 py-16">
          <div className="mx-auto max-w-7xl px-6 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
                  Q
                </div>
                <span className="text-lg font-bold text-white">Quantara <span className="text-blue-500">AI</span></span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Empowering the future of construction through advanced quantity intelligence and spatial data.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-6">Contact Us</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <a href="mailto:solution@vistabylara.com" className="hover:text-blue-400 transition">solution@vistabylara.com</a>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <a href="tel:+971507994292" className="hover:text-blue-400 transition">+971 50 799 4292</a>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>Dubai, UAE</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-6">Legal & Corporate</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li><a href="https://www.vistabylara.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition">Vista By Lara Official</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-6 mt-16 pt-8 border-t border-slate-900 text-center">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} Quantara AI by Vista By Lara. All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}
