import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import FinancialPreview from '@/components/landing/FinancialPreview';

export const metadata: Metadata = {
  title: 'Quantara: Plain-English Financial Insights for Small Businesses',
  description: 'Connect QuickBooks or Xero and turn business financial reports into clear explanations, cash-flow warnings and practical next steps with Quantara.',
  alternates: {
    canonical: 'https://quantara.vistabylara.com',
  },
  openGraph: {
    title: 'Quantara: Plain-English Financial Insights for Small Businesses',
    description: 'Connect QuickBooks or Xero and turn business financial reports into clear explanations, cash-flow warnings and practical next steps with Quantara.',
    url: 'https://quantara.vistabylara.com',
    siteName: 'Quantara',
    images: [
      {
        url: 'https://quantara.vistabylara.com/icon.jpg',
        width: 1200,
        height: 630,
        alt: 'Quantara Financial Co-Pilot Interface',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quantara: Plain-English Financial Insights for Small Businesses',
    description: 'Connect QuickBooks or Xero and turn business financial reports into clear explanations.',
    images: ['https://quantara.vistabylara.com/icon.jpg'],
  },
};

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://quantara.vistabylara.com/#organization",
        "name": "Vista By Lara",
        "url": "https://www.vistabylara.com/",
        "logo": {
          "@type": "ImageObject",
          "url": "https://quantara.vistabylara.com/icon.jpg"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+971507994292",
          "contactType": "customer service",
          "email": "solution@vistabylara.com"
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://quantara.vistabylara.com/#website",
        "url": "https://quantara.vistabylara.com/",
        "name": "Quantara",
        "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
        "inLanguage": "en-US"
      },
      {
        "@type": "WebApplication",
        "@id": "https://quantara.vistabylara.com/#software",
        "name": "Quantara",
        "url": "https://quantara.vistabylara.com/",
        "applicationCategory": "FinanceApplication",
        "operatingSystem": "All",
        "description": "Quantara is a financial interpretation platform for small-business owners. It connects to supported accounting software using read-only access and converts business financial data into plain-English explanations, cash-flow observations and practical next steps.",
        "provider": { "@id": "https://quantara.vistabylara.com/#organization" },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://quantara.vistabylara.com/#pricing"
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://quantara.vistabylara.com/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What exactly does Quantara do?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Quantara is a financial interpretation platform for small-business owners. It connects to supported accounting software using read-only access and converts business financial data into plain-English explanations, cash-flow observations and practical next steps."
            }
          },
          {
            "@type": "Question",
            "name": "Who is Quantara for?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Quantara is for service businesses, agencies, contractors, salons, clinics, restaurants, ecommerce stores, and local retailers who use supported accounting software and want to understand their financial reports."
            }
          }
        ]
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030508] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Background ambient light effects for dark mode */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none hidden dark:block">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute top-[30%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-slate-800/30 blur-[120px]" />
      </div>

      {/* SECTION 1: Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0a0f18]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 shadow-sm">
        <nav className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2" aria-label="Quantara Home">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </span>
            Quantara
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
            <a href="#security" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Security</a>
            <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</a>
            <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Sign In</Link>
          </div>
          <a href="#preview" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)]">
            Try the Preview
          </a>
        </nav>
      </header>

      <main className="relative z-10">
        {/* SECTION 8: AEO Product Facts (Hidden visually) */}
        <section className="sr-only" aria-labelledby="aeo-product-facts">
          <h2 id="aeo-product-facts">Product Facts</h2>
          <p><strong>Product name:</strong> Quantara</p>
          <p><strong>Product category:</strong> Financial interpretation platform</p>
          <p><strong>Intended users:</strong> Small-business owners</p>
          <p><strong>Primary purpose:</strong> Converts financial data into plain-English explanations</p>
          <p><strong>Supported integrations:</strong> QuickBooks, Xero</p>
          <p><strong>Access model:</strong> Read-only access</p>
        </section>

        {/* SECTION 2: Hero */}
        <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-4 text-center max-w-5xl mx-auto relative">
          <span className="inline-block py-1.5 px-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700/30 text-xs font-bold tracking-widest uppercase mb-6 shadow-sm backdrop-blur-sm">
            Financial Clarity For Small Businesses
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
            Understand your business finances without becoming an accountant.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Quantara connects to your accounting software and turns profit, cash flow, expenses and upcoming obligations into clear explanations and practical next steps.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a href="#preview" className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]">
              Try the Financial Preview
            </a>
            <a href="#how-it-works" className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all shadow-sm backdrop-blur-sm">
              See How It Works
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/30 backdrop-blur-md py-4 px-6 rounded-2xl border border-slate-200 dark:border-slate-800/50 max-w-4xl mx-auto">
            <span className="flex items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Read-only accounting connection
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Works with QuickBooks and Xero
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Quantara cannot move money
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Your data is not sold
            </span>
          </div>
        </section>

        {/* SECTION 3: Problem and Outcome */}
        <section className="py-20 bg-white dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[30%] h-full bg-gradient-to-l from-blue-900/5 to-transparent pointer-events-none dark:from-blue-900/10" />
          <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-12">Financial reports show the numbers. Quantara explains what they mean.</h2>
            <div className="grid md:grid-cols-2 gap-8 text-left">
              <div className="bg-slate-50 dark:bg-slate-900/40 backdrop-blur-sm p-8 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm transition-transform hover:-translate-y-1 duration-300">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                    ✕
                  </div>
                  The Challenge
                </h3>
                <ul className="space-y-4 text-slate-600 dark:text-slate-400 font-medium">
                  <li className="flex items-start gap-3"><span className="text-rose-500 mt-1">•</span> P&L statements are difficult to interpret.</li>
                  <li className="flex items-start gap-3"><span className="text-rose-500 mt-1">•</span> Cash in the bank does not always equal available cash.</li>
                  <li className="flex items-start gap-3"><span className="text-rose-500 mt-1">•</span> A profitable business can still face a cash shortage.</li>
                  <li className="flex items-start gap-3"><span className="text-rose-500 mt-1">•</span> Business owners often receive reports without knowing what action to take.</li>
                </ul>
              </div>
              <div className="bg-blue-50/50 dark:bg-blue-900/10 backdrop-blur-sm p-8 rounded-2xl border border-blue-100 dark:border-blue-800/40 shadow-sm shadow-blue-500/5 transition-transform hover:-translate-y-1 duration-300">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    ✓
                  </div>
                  The Outcome
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-6 font-medium bg-white/50 dark:bg-black/20 p-3 rounded-lg">With Quantara, the owner can understand:</p>
                <ul className="space-y-4 text-slate-700 dark:text-slate-400">
                  <li className="flex items-start gap-3"><span className="text-emerald-500 mt-1">•</span> whether the business is genuinely profitable;</li>
                  <li className="flex items-start gap-3"><span className="text-emerald-500 mt-1">•</span> why a month performed better or worse;</li>
                  <li className="flex items-start gap-3"><span className="text-emerald-500 mt-1">•</span> whether upcoming bills create a cash-flow risk;</li>
                  <li className="flex items-start gap-3"><span className="text-emerald-500 mt-1">•</span> what deserves attention this week;</li>
                  <li className="flex items-start gap-3"><span className="text-emerald-500 mt-1">•</span> what question should be discussed with an accountant.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: How It Works */}
        <section id="how-it-works" className="py-24 bg-slate-50 dark:bg-[#030508] relative">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-16">How Quantara Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: 1, title: 'Connect your accounting software', desc: 'The connection is strictly read-only. Quantara securely reads reports, balances, and transaction summaries to analyze performance. It cannot edit records, create invoices, or move money.' },
                { step: 2, title: 'Ask questions in normal language', desc: 'No need to build complex formulas. Ask things like:\n\n"Why was profit lower this month?"\n"Will there be enough cash for upcoming bills?"\n"Which expenses increased?"' },
                { step: 3, title: 'Receive explanations and next steps', desc: 'Quantara provides a direct answer supported by exact numbers. It highlights important risks and recommends a concrete next action (such as consulting your qualified professional).' }
              ].map((item, i) => (
                <div key={i} className="bg-white dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative hover:border-blue-500/50 transition-colors duration-300">
                  <div className="w-12 h-12 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center absolute -top-6 -left-6 border-4 border-slate-50 dark:border-[#030508] shadow-lg shadow-blue-500/30 text-lg">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-2">{item.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: Core Features */}
        <section id="features" className="py-24 bg-white dark:bg-[#060a12] border-t border-slate-200 dark:border-slate-800/50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-16">Features built for non-finance owners</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Plain-English Explanations', desc: 'Translate profit-and-loss, balance-sheet and cash-flow information into understandable language.', icon: 'M4 6h16M4 12h16M4 18h7' },
                { title: 'Ask Your Business Questions', desc: 'Allow owners to ask questions using normal language instead of accounting terminology.', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                { title: 'Cash-Flow Early Warnings', desc: 'Highlight upcoming obligations, expected inflows and possible shortfalls before they become urgent.', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
                { title: 'Monthly Performance Comparison', desc: 'Explain what changed between reporting periods and identify major contributors.', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
                { title: 'Expense Change Detection', desc: 'Surface unusual or meaningful expense increases and decreases in plain sight.', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
                { title: 'Decision Support', desc: 'Help users evaluate hiring, spending, pricing and timing using available business data.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              ].map((feature, i) => (
                <article key={i} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 7: Who It Is For */}
        <section className="py-24 bg-slate-50 dark:bg-[#030508] relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-4 relative z-10">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-12">Who Quantara is for</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> Suitable for:
                </h3>
                <ul className="space-y-4 text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" /> Service businesses & Agencies</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" /> Contractors & Builders</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" /> Salons & Clinics</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" /> Restaurants & Local retailers</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" /> Ecommerce stores</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" /> Small companies using supported accounting software</li>
                </ul>
              </div>
              <div className="bg-slate-100 dark:bg-slate-900/20 p-8 rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm opacity-80">
                <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-rose-500">✕</span> Not suitable for:
                </h3>
                <ul className="space-y-4 text-slate-500 dark:text-slate-500">
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Businesses without organized accounting data</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Companies requiring full enterprise financial planning</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Tax filing or statutory audit</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Investment management or regulated financial advice</li>
                  <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" /> Replacing a qualified accountant or CFO</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8: Differentiation */}
        <section className="py-24 bg-white dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50">
          <div className="max-w-5xl mx-auto px-4 overflow-x-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-12">Why Quantara is different</h2>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full min-w-[600px] text-left border-collapse bg-white dark:bg-slate-900/30">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                    <th className="py-5 px-6 text-slate-600 dark:text-slate-300 font-semibold w-1/3">Capability</th>
                    <th className="py-5 px-6 text-slate-500 dark:text-slate-400 font-medium text-center border-l border-slate-200 dark:border-slate-800">Traditional report</th>
                    <th className="py-5 px-6 text-slate-500 dark:text-slate-400 font-medium text-center border-l border-slate-200 dark:border-slate-800">Generic AI chatbot</th>
                    <th className="py-5 px-6 text-blue-700 dark:text-blue-400 font-bold text-center border-l border-slate-200 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/20">Quantara</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {[
                    ['Uses the business\'s connected financial data', true, false, true],
                    ['Explains numbers in plain English', false, true, true],
                    ['Provides a recommended next step', false, false, true],
                    ['Maintains read-only access', null, null, true],
                    ['Does not replace professional advice', true, null, true]
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">{row[0]}</td>
                      <td className="py-4 px-6 text-center border-l border-slate-100 dark:border-slate-800/50">
                        {row[1] === true ? <span className="text-emerald-500 dark:text-emerald-400 font-bold">Yes</span> : row[1] === false ? <span className="text-slate-400 dark:text-slate-600">No</span> : <span className="text-slate-300 dark:text-slate-700">-</span>}
                      </td>
                      <td className="py-4 px-6 text-center border-l border-slate-100 dark:border-slate-800/50">
                        {row[2] === true ? <span className="text-emerald-500 dark:text-emerald-400 font-bold">Yes</span> : row[2] === false ? <span className="text-slate-400 dark:text-slate-600">No</span> : <span className="text-slate-300 dark:text-slate-700">-</span>}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10">
                        {row[3] === true ? 'Yes' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 9: Trust, Privacy and Security */}
        <section id="security" className="py-24 bg-slate-900 dark:bg-black text-white relative border-t border-slate-800">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
            <h2 className="text-3xl font-bold mb-8">Trust, Privacy and Security</h2>
            <p className="text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              We know your financial data is highly sensitive. Here is exactly how we handle it:
            </p>
            <div className="grid sm:grid-cols-2 gap-6 text-left max-w-4xl mx-auto mb-12">
              <div className="bg-slate-800/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-slate-700 dark:border-slate-800">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Read-only connection
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">Quantara connects to your software strictly in read-only mode. We cannot modify records, approve bills, or initiate transactions.</p>
              </div>
              <div className="bg-slate-800/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-slate-700 dark:border-slate-800">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Your data is not sold
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">Your financial data is used exclusively to provide you with insights. We do not sell data or advertising to third parties.</p>
              </div>
              <div className="bg-slate-800/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-slate-700 dark:border-slate-800">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  Private AI processing
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">We explicitly prevent your private financial data from being used to train public generative AI models.</p>
              </div>
              <div className="bg-slate-800/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl border border-slate-700 dark:border-slate-800">
                <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
                  Easy Disconnect
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">You can revoke accounting access and request account deletion at any time, directly from your settings panel.</p>
              </div>
            </div>
            <div className="flex justify-center gap-8 text-sm font-medium text-blue-400">
              <a href="/privacy" className="hover:text-blue-300 underline underline-offset-4">Read Privacy Policy</a>
              <a href="/terms" className="hover:text-blue-300 underline underline-offset-4">Read Terms of Service</a>
            </div>
          </div>
        </section>

        {/* SECTION 10: Pricing */}
        <section id="pricing" className="py-24 bg-slate-50 dark:bg-[#030508] relative">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-16 max-w-2xl mx-auto">Choose the plan that fits your business. Start with a 14-day free trial on any tier.</p>
            
            <div className="grid lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
              
              {/* Starter Package */}
              <div className="bg-white dark:bg-slate-900/40 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm transition-transform hover:-translate-y-1 duration-300 relative text-left">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Starter</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">For freelancers and small contractors.</p>
                <div className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                  AED 149<span className="text-lg text-slate-500 dark:text-slate-400 font-medium">/mo</span>
                </div>
                <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mt-8 mb-8 border-t border-slate-100 dark:border-slate-800 pt-8">
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> 1 User, 1 Company</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> 2 Projects</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> 10 AI BOQs / month</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> 5 Technical Reports / month</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> 5 Watermark-Free Downloads</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> PDF & Excel Export</li>
                </ul>
                <a href="/register?plan=starter" className="block w-full text-center rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm">
                  Start Free Trial
                </a>
              </div>

              {/* Professional Package (Most Popular) */}
              <div className="bg-white dark:bg-slate-900/80 p-8 rounded-3xl shadow-2xl shadow-blue-900/10 dark:shadow-blue-900/30 border-2 border-blue-500 dark:border-blue-500 relative overflow-hidden backdrop-blur-md transform lg:-translate-y-4 text-left z-10">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500" />
                <div className="absolute top-0 right-8 -translate-y-1">
                  <span className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-b-lg shadow-sm">
                    Most Popular
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 mt-2 flex items-center gap-2">
                  Professional
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Full power for growing teams.</p>
                <div className="text-5xl font-extrabold text-blue-600 dark:text-blue-400 mb-2 tracking-tight drop-shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                  AED 399<span className="text-lg text-slate-500 dark:text-slate-400 font-medium text-slate-900 dark:text-white">/mo</span>
                </div>
                <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mt-8 mb-8 border-t border-slate-100 dark:border-slate-800 pt-8 font-medium">
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> 5 Users, 1 Company</li>
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> 10 Projects</li>
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> 50 AI BOQs / month</li>
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> 25 Technical Reports / month</li>
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Full Industry Libraries</li>
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> AI BOQ & Tech Report Generators</li>
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> PDF, Excel, Word Export</li>
                  <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Company Branding & Usage Dashboard</li>
                </ul>
                <a href="/register?plan=pro" className="block w-full text-center rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                  Start Professional Trial
                </a>
              </div>

              {/* Business Package */}
              <div className="bg-white dark:bg-slate-900/40 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm transition-transform hover:-translate-y-1 duration-300 relative text-left">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Business</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">For large teams and enterprises.</p>
                <div className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                  AED 899<span className="text-lg text-slate-500 dark:text-slate-400 font-medium">/mo</span>
                </div>
                <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mt-8 mb-8 border-t border-slate-100 dark:border-slate-800 pt-8">
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> 15 Users, 3 Companies</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Unlimited Projects (Fair Use)</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Higher AI & Report Limits</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Advanced AI capabilities</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Team Permissions & Workflows</li>
                  <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Audit Logs & Onboarding</li>
                </ul>
                <a href="/register?plan=business" className="block w-full text-center rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm">
                  Start Free Trial
                </a>
              </div>

            </div>
          </div>
        </section>

        {/* SECTION 11: Interactive Preview */}
        <section id="preview" className="py-24 bg-white dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-6">Try the Financial Preview</h2>
            <p className="text-center text-slate-600 dark:text-slate-400 mb-12 max-w-xl mx-auto">
              Enter hypothetical numbers below to see how Quantara explains financial data. <br/>(Your entered data is not saved).
            </p>
            <div className="bg-slate-50 dark:bg-slate-900/30 p-1 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
              <FinancialPreview />
            </div>
          </div>
        </section>

        {/* SECTION 12: FAQ */}
        <section id="faq" className="py-24 bg-slate-50 dark:bg-[#030508]">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                { q: 'What exactly does Quantara do?', a: 'Quantara is a financial interpretation platform for small-business owners. It connects to supported accounting software using read-only access and converts business financial data into plain-English explanations, cash-flow observations and practical next steps.' },
                { q: 'Does Quantara replace my accountant?', a: 'No. Quantara is informational decision support software. It helps you understand your reports so you can have better, more informed conversations with your qualified professional accountant or tax adviser.' },
                { q: 'Is the connection read-only?', a: 'Yes. Quantara requests strictly read-only permissions when connecting to your accounting software. It cannot edit your records, approve invoices, or move money.' },
                { q: 'Is my data used to train AI models?', a: 'No. We explicitly prevent your private financial data from being used to train public generative AI models.' }
              ].map((faq, i) => (
                <details key={i} className="group bg-white dark:bg-slate-900/50 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 transition-colors" open={i === 0}>
                  <summary className="font-semibold text-slate-900 dark:text-white cursor-pointer list-none flex justify-between items-center text-lg">
                    {faq.q}
                    <span className="group-open:rotate-180 transition-transform text-blue-500">▼</span>
                  </summary>
                  <p className="text-slate-600 dark:text-slate-400 mt-4 leading-relaxed pr-6">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 13: Final CTA */}
        <section className="py-24 bg-blue-600 dark:bg-blue-900 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 to-indigo-600 dark:from-blue-950 dark:to-indigo-900 opacity-90" />
          <div className="max-w-4xl mx-auto px-4 relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-8 tracking-tight">Your financial reports already contain the answers. Quantara helps you understand them.</h2>
            <p className="text-blue-100 text-lg mb-12 font-medium">No accounting expertise required. Read-only access. Clear explanations.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#preview" className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-bold text-blue-700 hover:bg-slate-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                Try the Preview
              </a>
              <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-transparent border-2 border-blue-200/30 dark:border-blue-700/50 backdrop-blur-sm px-8 py-4 text-base font-bold text-white hover:bg-white/10 transition-all">
                Join Early Access
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* SECTION 14: Footer */}
      <footer className="bg-slate-900 dark:bg-black text-slate-400 py-16 border-t border-slate-800">
        <div className="container mx-auto px-4 max-w-6xl grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">Support</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              <li><a href="mailto:solution@vistabylara.com" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">Company</h4>
            <div className="space-y-2 text-sm text-slate-500">
              <p className="font-medium text-slate-300">Vista By Lara</p>
              <p>solution@vistabylara.com</p>
              <p>+971507994292</p>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 max-w-6xl pt-8 border-t border-slate-800 text-xs text-slate-500 text-center md:text-left space-y-4">
          <p className="max-w-4xl leading-relaxed">
            <strong className="text-slate-400">Important Disclaimer:</strong> Quantara is an informational decision-support tool. We are not licensed accountants, tax advisers, investment advisers, or financial advisers. Always consult a qualified professional before making financial decisions.
          </p>
          <p>© {new Date().getFullYear()} Vista By Lara. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
