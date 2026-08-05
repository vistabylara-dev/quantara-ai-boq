import React from "react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security",
  description: "Security information for Quantara Early Access.",
};

export default function SecurityPage() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-4 min-h-[70vh]">
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline flex items-center gap-2 text-sm font-medium">
          ← Back to Home
        </Link>
      </div>
      
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Security</h1>
        <p className="text-xl text-slate-600 dark:text-slate-400">
          Quantara is in Early Access.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <ul className="space-y-4 text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              Access to authenticated areas requires user authentication.
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              Quantara is designed around least-privilege and read-only integration principles.
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              Quantara uses authenticated access controls. Additional security and data-processing documentation is being finalized for the Early Access release.
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              Accounting integrations are not yet available in production.
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              Security controls and data-processing documentation will be updated as the product progresses toward general availability.
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-1">✓</span>
              Security questions may be submitted through the published contact channel.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
