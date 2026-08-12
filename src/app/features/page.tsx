import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quantara Features & Roadmap",
  description: "Explore Quantara's current features, active development, and planned capabilities.",
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030508] text-slate-900 dark:text-slate-100 font-sans antialiased py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium inline-block hover:underline">
            &larr; Back to Home
          </Link>
        </div>
        
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">Financial clarity features built for business owners</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
            Discover what Quantara can do for your business today, what we are actively building, and our future roadmap.
          </p>
        </div>

        {/* Section 1: Preview UI (Current Features) */}
        <section className="mb-24">
          <div className="border-l-4 border-blue-500 pl-6 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Preview UI</h2>
            <p className="text-slate-600 dark:text-slate-400">Features currently available in the early access preview.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Understand Performance */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">Understand performance</h3>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Plain-English financial explanations</h4>
                <p className="text-slate-600 dark:text-slate-400">Translate profit-and-loss, balance-sheet, and cash-flow information into understandable business language.</p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Period-to-period comparison</h4>
                <p className="text-slate-600 dark:text-slate-400">Compare this month with last month, this quarter with the previous quarter, or another selected period.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Profit-driver analysis</h4>
                <p className="text-slate-600 dark:text-slate-400">See which revenue and expense movements had the greatest effect on profitability.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Revenue trend explanations</h4>
                <p className="text-slate-600 dark:text-slate-400">Understand whether revenue growth is consistent, seasonal, customer-dependent, or concentrated in a particular area.</p>
              </div>
            </div>

            {/* Protect Cash Flow */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">Protect cash flow</h3>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Cash-position overview</h4>
                <p className="text-slate-600 dark:text-slate-400">See available cash alongside expected inflows and upcoming financial obligations.</p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Cash-flow risk signals</h4>
                <p className="text-slate-600 dark:text-slate-400">Identify periods in which expected payments may place pressure on the business’s cash position.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Receivables visibility</h4>
                <p className="text-slate-600 dark:text-slate-400">Review outstanding customer balances and identify overdue or concentrated receivables.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Payables visibility</h4>
                <p className="text-slate-600 dark:text-slate-400">Understand upcoming supplier bills and other recorded obligations that may affect available cash.</p>
              </div>
            </div>

            {/* Control Costs */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">Control costs</h3>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Expense-change detection</h4>
                <p className="text-slate-600 dark:text-slate-400">Identify expense categories that increased or decreased compared with a previous period.</p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Unusual movement review</h4>
                <p className="text-slate-600 dark:text-slate-400">Surface meaningful financial changes that deserve human review.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Recurring-cost visibility</h4>
                <p className="text-slate-600 dark:text-slate-400">See the operating costs that repeatedly affect margins and cash flow.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Margin awareness</h4>
                <p className="text-slate-600 dark:text-slate-400">Understand whether increased sales are producing stronger margins or being offset by higher costs.</p>
              </div>
            </div>

            {/* Ask and investigate & Prepare */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">Ask, investigate, and prepare</h3>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Natural-language financial questions</h4>
                <p className="text-slate-600 dark:text-slate-400">Ask business questions without using accounting terminology or formulas. Receive number-supported answers connected to relevant totals, changes, periods, and categories.</p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Decision-support scenarios</h4>
                <p className="text-slate-600 dark:text-slate-400">Review the possible financial effect of hiring, spending, payment timing, pricing, or other business decisions using available data.</p>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Priority summary & Accountant discussion points</h4>
                <p className="text-slate-600 dark:text-slate-400">See which financial matters may deserve attention first, and generate a list of questions or observations to review with your qualified accountant.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: In Development */}
        <section className="mb-24">
          <div className="border-l-4 border-amber-500 pl-6 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">In Development</h2>
            <p className="text-slate-600 dark:text-slate-400">Capabilities our team is currently building and testing.</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-slate-600 dark:text-slate-400 italic">Content to be updated in Priority 9.</p>
          </div>
        </section>

        {/* Section 3: Planned Capabilities */}
        <section>
          <div className="border-l-4 border-purple-500 pl-6 mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Planned Capabilities</h2>
            <p className="text-slate-600 dark:text-slate-400">Future updates and integrations coming to Quantara.</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-slate-600 dark:text-slate-400 italic">Content to be updated in Priority 9.</p>
          </div>
        </section>
        
      </div>
    </div>
  );
}
