import React from "react";
import Link from "next/link";

export default function LegalPlaceholder({ title }: { title: string }) {
  return (
    <div className="max-w-3xl mx-auto py-24 px-4 min-h-[60vh] flex flex-col justify-center">
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline flex items-center gap-2 text-sm font-medium">
          ← Back to Home
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">{title}</h1>
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-6 rounded-xl shadow-sm">
        <p className="text-amber-800 dark:text-amber-200 text-lg leading-relaxed">
          Legal documentation is being finalized for the Quantara Early Access release. Please contact{" "}
          <a href="mailto:legal@vistabylara.com" className="font-bold underline hover:text-amber-900 dark:hover:text-amber-100">
            legal@vistabylara.com
          </a>{" "}
          for current data-processing or contractual information.
        </p>
      </div>
    </div>
  );
}
