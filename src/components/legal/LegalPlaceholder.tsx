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
      <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 p-8 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Quantara Support</h2>
          <ul className="space-y-2">
            <li><strong>Email:</strong> <a href="mailto:solution@vistabylara.com" className="text-blue-600 hover:underline">solution@vistabylara.com</a></li>
            <li><strong>Telephone:</strong> <a href="tel:+971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
            <li><strong>WhatsApp:</strong> <a href="https://wa.me/971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
          </ul>
        </div>
        <div>
          <p><strong>Support availability:</strong> Support requests can be submitted 24 hours a day. Response times may vary during Early Access.</p>
        </div>
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <p>Quantara is an AI-assisted BOQ and construction-estimating platform operated by Vista By Lara.</p>
          <p className="mt-2">© 2026 Vista By Lara. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
