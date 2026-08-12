import React from "react";

export default function CookiePolicyPage() {
  return (
    <main className="container mx-auto px-4 py-16 min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-bold mb-6">Cookie Policy</h1>
      <p className="text-lg max-w-2xl text-slate-600 dark:text-slate-400">
        Legal documentation is being finalized for the Quantara Early Access release. Please contact{" "}
        <a href="mailto:legal@vistabylara.com" className="text-blue-600 hover:underline dark:text-blue-400">
          legal@vistabylara.com
        </a>{" "}
        for current data-processing or contractual information.
      </p>
    </main>
  );
}
