import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { 
  ArrowRight, 
  BarChart3, 
  Shield, 
  CheckCircle2, 
  Wallet, 
  TrendingUp, 
  Search, 
  HelpCircle,
  FileText,
  Lock,
  ChevronRight,
  Calculator,
  MessageSquare,
  Users
} from "lucide-react";

// SEO Metadata
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Quantara AI Financial Insights for Small Businesses | QuickBooks & Xero",
  description: "Connect QuickBooks or Xero and turn profit, cash flow, expenses, receivables and payables into plain-English business insights with Quantara.",
  openGraph: {
    title: "Quantara AI Financial Insights for Small Businesses | QuickBooks & Xero",
    description: "Connect QuickBooks or Xero and turn profit, cash flow, expenses, receivables and payables into plain-English business insights with Quantara.",
    type: "website",
    url: "https://quantara.vistabylara.com",
    siteName: "Quantara",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#030508] text-slate-900 dark:text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-blue-500/30">
      
      {/* STRUCTURED DATA FOR SEO/AEO/GEO */}
      <Script id="schema-org" type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "Quantara",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "AI-assisted financial interpretation software that securely reads connected accounting information from QuickBooks and Xero and organizes it into understandable business insights for small business owners.",
              "offers": {
                "@type": "AggregateOffer",
                "priceCurrency": "AED",
                "lowPrice": "149",
                "highPrice": "899"
              },
              "provider": {
                "@type": "Organization",
                "name": "Vista By Lara",
                "url": "https://quantara.vistabylara.com"
              }
            },
            {
              "@type": "WebSite",
              "name": "Quantara",
              "url": "https://quantara.vistabylara.com"
            }
          ]
        })
      }} />

      {/* 1. PUBLIC NAVIGATION */}
      <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/80 dark:bg-[#030508]/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center gap-2">
              <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">Quantara</span>
            </div>
            
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">How It Works</a>
              <a href="#integrations" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">Integrations</a>
              <a href="#use-cases" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">Use Cases</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors">Pricing</a>
            </div>

            <div className="flex items-center space-x-4">
              <Link href="/login" className="hidden sm:block text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Sign In
              </Link>
              <Link href="#preview" className="hidden md:block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                Explore the Product Preview
              </Link>
              <Link href="/register" className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40">
                Request Early Access
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">
            Understand your business finances without becoming an accountant
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto leading-relaxed">
            Quantara connects to your accounting data and turns profit, cash flow, expenses, receivables, payables, and financial trends into clear explanations for business owners.
          </p>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            Ask questions in everyday language. Receive answers supported by your real business numbers, potential risks to review, and practical next steps.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="#preview" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]">
              Explore the Product Preview
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
              See How Quantara Works
            </Link>
          </div>
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pb-16">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <img src="/dashboard-preview.jpg" alt="Sample Quantara workspace using hypothetical financial data. No customer information is displayed." className="w-full h-auto" />
            </div>
            <p className="text-center text-sm text-slate-500 mt-4">Sample Quantara workspace using hypothetical financial data. No customer information is displayed.</p>
          </div>

          {/* Product Proof Strip */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400 mb-16 border-y border-slate-200 dark:border-slate-800 py-4">
            <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-blue-500" /> Read-only accounting access</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Built for small businesses</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-2"><Calculator className="w-4 h-4 text-blue-500" /> Works with QuickBooks and Xero</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-blue-500" /> Cannot move money</span>
          </div>

          {/* Hero Bullet Points */}
          <div className="max-w-2xl mx-auto text-left space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-6">Know what changed. Understand why. Decide what to review next.</h3>
            <ul className="space-y-3 text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" /> See whether your business is genuinely profitable</li>
              <li className="flex items-start gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" /> Understand why cash is increasing or decreasing</li>
              <li className="flex items-start gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" /> Identify expenses that changed unexpectedly</li>
              <li className="flex items-start gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" /> Review upcoming obligations and possible shortfalls</li>
              <li className="flex items-start gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" /> Prepare better questions for your accountant</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. WHAT QUANTARA DOES */}
      <section id="what-it-does" className="py-24 bg-slate-50 dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">One financial workspace. Clear answers from your business data.</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              Quantara is an AI-assisted financial interpretation platform created for small-business owners who want to understand their accounts without learning complex accounting terminology.
            </p>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mt-4">
              It securely reads permitted financial information from your connected accounting system and organizes it into understandable business insights.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Profitability</h3>
              <p className="text-slate-600 dark:text-slate-400">See whether revenue growth is actually producing stronger profit after expenses.</p>
            </div>
            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Cash position</h3>
              <p className="text-slate-600 dark:text-slate-400">Understand the difference between cash in the bank and cash that may already be committed to bills, payroll, tax, suppliers, or other obligations.</p>
            </div>
            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Revenue changes</h3>
              <p className="text-slate-600 dark:text-slate-400">Identify which customers, services, products, or reporting periods contributed to increases or decreases.</p>
            </div>
            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Expense movement</h3>
              <p className="text-slate-600 dark:text-slate-400">Spot meaningful changes in operating costs and understand which categories affected performance.</p>
            </div>
            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Receivables and payables</h3>
              <p className="text-slate-600 dark:text-slate-400">Review money expected from customers and amounts owed to suppliers.</p>
            </div>
            <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Financial trends & Questions</h3>
              <p className="text-slate-600 dark:text-slate-400">Compare periods using clear explanations, and ask questions in normal language to receive answers based on the connected data.</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl text-center max-w-3xl mx-auto">
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              Quantara provides informational decision support. It does not file taxes, audit accounts, move money, or replace a qualified accountant or financial professional.
            </p>
          </div>
        </div>
      </section>

      {/* 4. FEATURE CATEGORIES */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Financial clarity features built for business owners</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              Understand performance, protect cash flow, control costs, and prepare for discussions with your accountant.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 text-left mb-16">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Plain-English financial explanations</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 flex-grow">Translate profit-and-loss, balance-sheet, and cash-flow information into understandable business language.</p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">In Development</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Period-to-period comparison</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 flex-grow">Compare this month with last month, this quarter with the previous quarter, or another selected period.</p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">In Development</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Cash-position overview</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 flex-grow">See available cash alongside expected inflows and upcoming financial obligations.</p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">In Development</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Expense-change detection</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 flex-grow">Identify expense categories that increased or decreased compared with a previous period.</p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">In Development</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Receivables visibility</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 flex-grow">Review outstanding customer balances and identify overdue or concentrated receivables.</p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">In Development</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Natural-language financial questions</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 flex-grow">Ask business questions without using accounting terminology or formulas. Receive number-supported answers.</p>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">Preview UI</span>
              </div>
            </div>
          </div>

          <Link href="/features" className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]">
            Explore the Full Feature Library <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* 5. HOW TO USE QUANTARA */}
      <section id="how-it-works" className="py-24 bg-slate-50 dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">How to use Quantara</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              You do not need to upload spreadsheets manually or understand accounting formulas.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">1</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Create your workspace</h3>
                <p className="text-slate-600 dark:text-slate-400">Set up your company profile, reporting currency, financial year, and preferred reporting periods.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">2</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect QuickBooks or Xero</h3>
                <p className="text-slate-600 dark:text-slate-400">Select your accounting provider and approve the requested read-only permissions.</p>
                <div className="mt-4 inline-block bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-sm px-4 py-2 rounded-lg font-medium border border-emerald-200 dark:border-emerald-800/50">
                  <Lock className="w-4 h-4 inline-block mr-2" /> Quantara cannot create transactions, edit invoices, approve payments, change your ledger, or transfer money.
                </div>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">3</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Confirm the company and reporting period</h3>
                <p className="text-slate-600 dark:text-slate-400">Choose the connected company and select the month, quarter, year, or comparison period you want to understand.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">4</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Open your financial overview</h3>
                <p className="text-slate-600 dark:text-slate-400">Review a clear summary of revenue, expenses, profit, cash position, receivables, payables, and significant changes.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">5</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ask a business question</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Type a question in normal language, such as:</p>
                <ul className="grid sm:grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <li className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">"Why did profit decrease this month?"</li>
                  <li className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">"Which expenses increased the most?"</li>
                  <li className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">"Are customer payments arriving more slowly?"</li>
                  <li className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">"What is putting pressure on cash flow?"</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">6</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Review the supporting numbers</h3>
                <p className="text-slate-600 dark:text-slate-400">Quantara shows the data points, reporting periods, and financial categories used in the explanation.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">7</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Explore follow-up questions</h3>
                <p className="text-slate-600 dark:text-slate-400">Ask for greater detail, compare another period, or investigate a particular revenue or expense category.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">8</div>
                <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-800 mt-4" />
              </div>
              <div className="pb-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Save or export the insight</h3>
                <p className="text-slate-600 dark:text-slate-400">Save important observations to your workspace or export an owner-friendly summary where supported.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">9</div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Discuss important decisions with a professional</h3>
                <p className="text-slate-600 dark:text-slate-400">Use Quantara to understand the situation and prepare better questions. Consult an appropriately qualified professional before making tax, legal, investment, or material financial decisions.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. EXAMPLE QUESTIONS */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Questions you can ask Quantara</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Real questions that small business owners ask to understand performance, cash flow, and planning.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Profit and performance</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li>• Why was profit lower this month?</li>
                <li>• Revenue increased, so why did profit decrease?</li>
                <li>• Which part of the business contributed most to revenue?</li>
                <li>• What changed between this quarter and the previous quarter?</li>
                <li>• Are our margins improving or declining?</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Cash flow</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li>• How much cash may remain after upcoming recorded bills?</li>
                <li>• Which obligations could create cash pressure?</li>
                <li>• Why is cash decreasing even though the business is profitable?</li>
                <li>• Are customer payments arriving later than before?</li>
                <li>• Which weeks or months may require closer attention?</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Expenses</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li>• Which operating expenses increased the most?</li>
                <li>• Are there unusual changes in this month’s expenses?</li>
                <li>• Which recurring costs have the greatest effect on profit?</li>
                <li>• What expense categories should I review?</li>
                <li>• Did payroll, rent, software, or marketing costs change significantly?</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Business planning</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li>• What should I review before hiring another employee?</li>
                <li>• What financial information should I check before a large purchase?</li>
                <li>• What should I review before increasing operating expenses?</li>
                <li>• What should I ask my accountant this month?</li>
                <li>• Which financial issue deserves attention first?</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7. VISIBLE EXAMPLE ANSWER */}
      <section id="preview" className="py-24 bg-blue-600 dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">From accounting numbers to an understandable answer</h2>
            <p className="text-lg text-blue-100 dark:text-slate-400 max-w-2xl mx-auto">
              (Hypothetical example based on common business scenarios)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 md:p-10 text-slate-900 dark:text-slate-100 border border-transparent dark:border-slate-800">
            <div className="flex items-start gap-4 mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Example question</div>
                <div className="text-xl font-bold">Why did profit decrease in July even though revenue increased?</div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-6 flex-1">
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Example Quantara explanation</div>
                <p className="text-lg leading-relaxed">
                  Revenue increased from AED 120,000 in June to AED 137,000 in July, an increase of <strong>AED 17,000</strong>.
                </p>
                <p className="text-lg leading-relaxed">
                  However, total operating expenses increased by <strong>AED 26,500</strong> during the same period. The largest changes were:
                </p>
                <ul className="space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <li>• subcontractor costs: <span className="text-red-600 dark:text-red-400 font-medium">+AED 11,000</span></li>
                  <li>• payroll costs: <span className="text-red-600 dark:text-red-400 font-medium">+AED 7,500</span></li>
                  <li>• advertising costs: <span className="text-red-600 dark:text-red-400 font-medium">+AED 5,000</span></li>
                  <li>• software and operating expenses: <span className="text-red-600 dark:text-red-400 font-medium">+AED 3,000</span></li>
                </ul>
                <p className="text-lg leading-relaxed">
                  Because expenses grew faster than revenue, operating profit decreased from <strong>AED 22,000 to AED 12,500</strong>.
                </p>

                <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-xl border border-amber-200 dark:border-amber-800/50 mt-8">
                  <h4 className="font-bold text-amber-900 dark:text-amber-500 mb-2">What deserves attention</h4>
                  <p className="text-amber-800 dark:text-amber-200/80">The largest contributor was subcontractor cost. Review whether this increase was linked to a temporary project, higher delivery volume, or a permanent change in operating cost.</p>
                </div>

                <div className="bg-slate-50 dark:bg-[#030508] p-5 rounded-xl border border-slate-200 dark:border-slate-800 mt-4">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">Suggested next question</h4>
                  <p className="text-slate-600 dark:text-slate-400 italic">"Did the additional subcontractor cost generate enough revenue to maintain the project margin?"</p>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-500 mt-8">
                  <strong>Professional review reminder:</strong> This explanation is based on the available accounting data and is not accounting, tax, investment, or financial advice. This demonstration uses hypothetical business data and is not a customer case study.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. BENEFITS & OUTCOMES */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">What business owners gain from Quantara</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Quantara does not guarantee financial outcomes. It helps business owners understand existing financial information more clearly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Faster financial understanding</h3>
              <p className="text-slate-600 dark:text-slate-400">Move from reading several reports to reviewing one understandable explanation.</p>
            </div>
            
            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Fewer blind spots</h3>
              <p className="text-slate-600 dark:text-slate-400">Identify meaningful changes in cash, expenses, receivables, payables, revenue, and profit before the next formal review.</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Better accountant conversations</h3>
              <p className="text-slate-600 dark:text-slate-400">Arrive prepared with focused questions supported by the relevant numbers and reporting periods.</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">More confident operational reviews</h3>
              <p className="text-slate-600 dark:text-slate-400">Understand the financial context before considering hiring, purchasing, pricing, or spending decisions.</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Less dependence on accounting terminology</h3>
              <p className="text-slate-600 dark:text-slate-400">Ask what you need to know using the language you already use to run your business.</p>
            </div>

            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">A consistent financial-review habit</h3>
              <p className="text-slate-600 dark:text-slate-400">Use the same structured workflow each week or month instead of relying only on the bank balance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. INDUSTRY SPECIFIC USE CASES */}
      <section id="use-cases" className="py-24 bg-slate-50 dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Built for the financial questions small businesses ask every day</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Agencies and professional services</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Understand project revenue, payroll pressure, contractor costs, overdue client invoices, and month-to-month profitability.</p>
            </div>
            
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Contractors and service companies</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Review job-related income, supplier costs, subcontractor spending, receivables, and the cash required for upcoming work.</p>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Clinics and salons</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Track revenue trends, staffing costs, supplier expenses, recurring overhead, and the effect of seasonal demand.</p>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Restaurants and hospitality businesses</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Understand food costs, payroll, rent, delivery-platform fees, operating margins, and short-term cash pressure.</p>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Ecommerce and retail businesses</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Review sales trends, inventory-related costs, advertising expenditure, refunds, payment delays, and gross-margin movement.</p>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Consultants and freelancers</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">See whether income covers recurring obligations, identify late payments, and understand how individual clients affect overall revenue.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 10. INTEGRATIONS */}
      <section id="integrations" className="py-24 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Connect the accounting platform you already use</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-green-600 dark:text-green-400 font-bold text-2xl">QB</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">QuickBooks integration <span className="text-xs font-normal px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">Planned</span></h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                QuickBooks Online and Xero integrations are planned for a future Early Access release. They are not currently available for production account connection.
              </p>
              <Link href="/register" className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Request Early Access <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-2xl">X</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">Xero integration <span className="text-xs font-normal px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">Planned</span></h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                QuickBooks Online and Xero integrations are planned for a future Early Access release. They are not currently available for production account connection.
              </p>
              <Link href="/register" className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Request Early Access <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-8 rounded-2xl max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-red-900 dark:text-red-400 mb-4">What Quantara does not do</h3>
            <ul className="grid sm:grid-cols-2 gap-3 text-red-800 dark:text-red-300/80 text-sm">
              <li>• edit accounting entries;</li>
              <li>• create or approve invoices;</li>
              <li>• reconcile bank transactions;</li>
              <li>• submit tax returns;</li>
              <li>• initiate or approve payments;</li>
              <li>• transfer money;</li>
              <li>• replace your accountant;</li>
              <li>• provide regulated financial or investment advice.</li>
            </ul>
            <p className="text-xs text-red-700/60 dark:text-red-400/50 mt-6">
              Integration availability, accessible data, and functionality may depend on the provider, country, subscription, permissions, and product configuration.
            </p>
          </div>
        </div>
      </section>

      {/* 11. DIFFERENTIATION */}
      <section className="py-24 bg-slate-50 dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">How Quantara is different</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              Quantara is not accounting software and is not a generic chatbot. It is a read-only interpretation layer that helps business owners understand financial information already recorded in supported accounting platforms.
            </p>
          </div>

          <div className="overflow-x-auto pb-8">
            <table className="w-full text-left min-w-[800px] border-collapse">
              <thead>
                <tr>
                  <th className="p-4 border-b-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold bg-white dark:bg-slate-900/50 rounded-tl-xl">Capability</th>
                  <th className="p-4 border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-slate-900/50 text-center">Static financial report</th>
                  <th className="p-4 border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-slate-900/50 text-center">Generic AI chatbot</th>
                  <th className="p-4 border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-slate-900/50 text-center">Accounting platform</th>
                  <th className="p-4 border-b-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 font-bold text-center rounded-tr-xl">Quantara</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Uses connected business data</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Sometimes</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No by default</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Yes</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Yes</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Explains results in plain English</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Limited</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">General answers</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Varies</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Core purpose</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Supports natural-language questions</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Yes</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Varies</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Yes</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Shows supporting financial numbers</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Yes</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Not from your accounts</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Yes</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Yes</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Explains period-to-period changes</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Manual</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No connected context</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Varies</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Yes</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Identifies issues to review</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Manual</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Generic</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Varies</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Yes</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Suggests accountant discussion points</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Generic</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Limited</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Yes</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Can edit financial records</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Yes</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">No</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Can move money</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Sometimes</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">No</td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Designed for non-finance owners</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Not necessarily</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">General audience</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">Mixed</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10">Yes</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium rounded-bl-xl">Replaces a qualified accountant</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-slate-500 dark:text-slate-400">No</td>
                  <td className="p-4 text-center text-blue-700 dark:text-blue-300 font-semibold bg-blue-50/50 dark:bg-blue-900/10 rounded-br-xl">No</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 12. PRICING */}
      <section id="pricing" className="py-24 relative">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Simple pricing for clearer financial decisions</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-16 max-w-3xl mx-auto">
            Early Access usage limits apply. Feature availability may vary during Early Access. Final commercial plans will be announced before general availability.
          </p>
          
          <div className="grid lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
            
            {/* Starter Package */}
            <div className="bg-white dark:bg-slate-900/40 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm transition-transform hover:-translate-y-1 duration-300 relative text-left">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Starter</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">For freelancers and owner-operated businesses.</p>
              <div className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                AED 149<span className="text-lg text-slate-500 dark:text-slate-400 font-medium">/mo</span>
              </div>
              <div className="text-xs text-slate-500">Excluding 5% UAE VAT</div>
              <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mt-8 mb-8 border-t border-slate-100 dark:border-slate-800 pt-8">
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> 1 company, 1 user</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Monthly financial overview</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Plain-English explanations</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Period comparison</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Expense-change detection</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Early Access limits apply</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> QuickBooks or Xero connection</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Standard support</li>
              </ul>
              <a href="/register?plan=starter" className="block w-full text-center rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm">
                Request Early Access
              </a>
            </div>

            {/* Professional Package */}
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">For growing small businesses and management teams.</p>
              <div className="text-5xl font-extrabold text-blue-600 dark:text-blue-400 mb-2 tracking-tight drop-shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                AED 399<span className="text-lg text-slate-500 dark:text-slate-400 font-medium text-slate-900 dark:text-white">/mo</span>
              </div>
              <div className="text-xs text-slate-500">Excluding 5% UAE VAT</div>
              <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mt-8 mb-8 border-t border-slate-100 dark:border-slate-800 pt-8 font-medium">
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> 1 company, up to 5 users</li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> <strong>Everything in Starter</strong></li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Expanded Early Access limits</li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Cash-flow risk observations</li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Receivables and payables insights</li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Advanced period comparisons</li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Saved insights</li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Exportable owner summaries</li>
                <li className="flex items-start gap-3"><span className="text-blue-600 dark:text-blue-400 mt-0.5">✓</span> Priority support</li>
              </ul>
              <a href="/register?plan=professional" className="block w-full text-center rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                Request Early Access
              </a>
            </div>

            {/* Business Package */}
            <div className="bg-white dark:bg-slate-900/40 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm transition-transform hover:-translate-y-1 duration-300 relative text-left">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Business</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">For established businesses requiring broader access and controls.</p>
              <div className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                AED 899<span className="text-lg text-slate-500 dark:text-slate-400 font-medium">/mo</span>
              </div>
              <div className="text-xs text-slate-500">Excluding 5% UAE VAT</div>
              <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300 mt-8 mb-8 border-t border-slate-100 dark:border-slate-800 pt-8">
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Up to 3 companies, 15 users</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> <strong>Everything in Professional</strong></li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Team roles and permissions</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Multi-company overview (where supported)</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Audit activity</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Structured onboarding</li>
                <li className="flex items-start gap-3"><span className="text-blue-500 mt-0.5">✓</span> Priority support</li>
              </ul>
              <a href="/contact-sales" className="block w-full text-center rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm">
                Contact Sales
              </a>
            </div>

          </div>

          <div className="mt-12 text-sm text-slate-500 dark:text-slate-400 max-w-4xl mx-auto">
            All plans provide informational decision support only. Quantara does not provide accounting, tax, legal, investment, or regulated financial advice. Final plan features and limits should match the functionality available inside the product.
          </div>
        </div>
      </section>

      {/* 13. FAQ */}
      <section className="py-24 bg-slate-50 dark:bg-[#060a12] border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Frequently Asked Questions</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">What is Quantara?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Quantara is an AI-assisted financial interpretation platform created for small-business owners. It connects to accounting platforms like QuickBooks or Xero to provide plain-English explanations of business performance without requiring accounting knowledge.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">How does Quantara work?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">You connect your existing accounting software via read-only access. Quantara analyzes the available financial data and provides a clear summary of profitability, cash flow, and expenses. You can also ask questions in natural language to understand specific trends.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Is Quantara accounting software?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">No. Quantara is a read-only interpretation layer that helps you understand financial information already recorded in your supported accounting platform.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Does Quantara replace an accountant?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">No. Quantara provides informational decision support to help you understand your business. It does not file taxes, audit accounts, or replace the regulated advice of a qualified accountant.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Can Quantara edit my accounting records or transfer money?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">No. Quantara requires strictly read-only access. It cannot create transactions, edit invoices, change your ledger, or initiate money transfers.</p>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">What financial information can Quantara explain?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Subject to the data available from your accounting integration, Quantara covers revenue, expenses, profit, cash position, receivables, payables, and period-to-period changes.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">How does Quantara identify cash-flow risks?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">It compares your current cash position against expected inflows (receivables) and upcoming obligations (payables) to identify periods where expected payments may place pressure on your cash reserves.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">How is financial data protected?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Data is encrypted in transit and at rest. We use secure OAuth connections to accounting providers and do not use your private financial data to train public AI models.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">How much does Quantara cost?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">We offer a Starter plan for AED 149/month (excluding 5% UAE VAT), a Professional plan for AED 399/month, and a Business plan for AED 899/month. All plans include a 14-day free trial.</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Is there a free trial?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Yes, you can try any tier for 14 days free to connect your accounting provider and explore your financial insights before committing.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 14. TECHNICAL PRODUCT FACTS */}
      <section className="py-16 bg-white dark:bg-[#030508]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-50 dark:bg-slate-900/40 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-mono text-slate-600 dark:text-slate-400">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider font-sans">Quantara product facts</h3>
            <ul className="space-y-2">
              <li><strong>Product name:</strong> Quantara</li>
              <li><strong>Product type:</strong> AI-assisted financial interpretation software</li>
              <li><strong>Primary audience:</strong> Small-business owners and management teams</li>
              <li><strong>Primary purpose:</strong> Explain connected business financial data in plain language</li>
              <li><strong>Supported integrations:</strong> QuickBooks and Xero</li>
              <li><strong>Connection model:</strong> Read-only</li>
              <li><strong>Core information covered:</strong> Revenue, expenses, profit, cash flow, receivables, payables, balances, and reporting-period changes, subject to available integration data</li>
              <li><strong>Primary outputs:</strong> Financial explanations, comparisons, observations, questions, and suggested review actions</li>
              <li><strong>Can modify accounting records:</strong> No</li>
              <li><strong>Can initiate payments:</strong> No</li>
              <li><strong>Provides tax filing:</strong> No</li>
              <li><strong>Provides statutory audit:</strong> No</li>
              <li><strong>Provides investment advice:</strong> No</li>
              <li><strong>Replaces a qualified accountant:</strong> No</li>
              <li><strong>Provider:</strong> Vista By Lara</li>
              <li><strong>Service availability:</strong> Subject to supported countries, currencies, accounting-provider access, and product configuration</li>
              <li><strong>Last reviewed:</strong> August 5, 2026</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 15. FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <span className="font-bold text-xl text-white mb-4 block">Quantara</span>
              <p className="text-sm max-w-sm mb-4">
                Plain-English financial insights for small businesses using QuickBooks and Xero.
              </p>
              <div className="text-sm">
                <p>Email: <a href="mailto:solution@vistabylara.com" className="text-blue-400 hover:text-blue-300">solution@vistabylara.com</a></p>
                <p>Phone: <a href="tel:+971507994292" className="text-blue-400 hover:text-blue-300">+971 50 799 4292</a></p>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#integrations" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal & Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/security" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="/data-processing" className="hover:text-white transition-colors">Data Processing Addendum</a></li>
                <li><a href="/subprocessors" className="hover:text-white transition-colors">Subprocessor List</a></li>
                <li><a href="/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</a></li>
                <li><a href="/acceptable-use" className="hover:text-white transition-colors">Acceptable Use Policy</a></li>
                <li><a href="https://vistabylara.com" className="hover:text-white transition-colors">Vista By Lara</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-sm text-center">
            <p>&copy; {new Date().getFullYear()} Vista By Lara. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

