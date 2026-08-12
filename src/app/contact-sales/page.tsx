"use client";

import { useState } from "react";
import { submitContactSalesRequest } from "./actions";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function ContactSalesPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const result = await submitContactSalesRequest(formData);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrorMsg(result.message || "Please check your inputs and try again.");
    }
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030508] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 py-20">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-6 inline-block hover:underline">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Contact Sales</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Fill out the form below to learn more about our enterprise and professional plans.
        </p>

        {isSuccess ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-8 text-center flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-400 mb-2">Thank you. Your request has been received.</h2>
            <p className="text-emerald-800 dark:text-emerald-300">
              Our team will contact you using the details provided.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {errorMsg}
              </div>
            )}
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                <input type="text" id="fullName" name="fullName" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label htmlFor="businessEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Business Email</label>
                <input type="email" id="businessEmail" name="businessEmail" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Company</label>
                <input type="text" id="company" name="company" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label htmlFor="country" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Country</label>
                <input type="text" id="country" name="country" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="accountingPlatform" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Accounting Platform</label>
              <select id="accountingPlatform" name="accountingPlatform" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Platform...</option>
                <option value="QuickBooks">QuickBooks</option>
                <option value="Xero">Xero</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="businessSize" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Business Size (Employees)</label>
                <select id="businessSize" name="businessSize" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Size...</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="200+">200+</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="numberOfEntities" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Number of Entities</label>
                <select id="numberOfEntities" name="numberOfEntities" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Entities...</option>
                  <option value="1">1</option>
                  <option value="2-5">2-5</option>
                  <option value="6+">6+</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="useCase" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Primary Use Case</label>
              <textarea id="useCase" name="useCase" rows={3} required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="How do you plan to use Quantara?"></textarea>
            </div>

            <div className="space-y-2">
              <label htmlFor="contactMethod" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Preferred Contact Method</label>
              <select id="contactMethod" name="contactMethod" required className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
              </select>
            </div>

            <div className="flex items-start gap-3">
              <input type="checkbox" id="privacyConsent" name="privacyConsent" required className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800" />
              <label htmlFor="privacyConsent" className="text-sm text-slate-600 dark:text-slate-400">
                I agree to the <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link> and consent to being contacted regarding this request.
              </label>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-4 px-6 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
