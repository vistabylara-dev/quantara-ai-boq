"use client";

import Link from "next/link";
import { useState, type FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

function RegisterForm() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan") || "starter";
  
  const [email, setEmail] = useState("");
  const [interestTier, setInterestTier] = useState(initialPlan);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/auth/register", { email, interestTier });
      setRegistered(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registered) {
    return (
      <div className="mx-auto max-w-md py-12 px-4">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-4">Request received</h1>
          <p className="text-sm text-slate-400 mb-6">
            Thank you for your interest in Quantara Early Access. Your request has been recorded. We will contact you when your account is ready to be provisioned.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-12 px-4">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <p className="text-sm uppercase tracking-[0.28em] text-blue-500 font-semibold mb-2">Quantara AI</p>
        <h1 className="text-2xl font-bold text-white mb-3">Request Early Access</h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Creating an Early Access account does not begin a paid subscription or automatic billing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="email">Business Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="interestTier">Intended Plan</label>
            <select
              id="interestTier"
              required
              value={interestTier}
              onChange={(event) => setInterestTier(event.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="business">Business</option>
            </select>
          </div>

          {error && <p className="text-sm text-rose-400 bg-rose-400/10 p-3 rounded-lg border border-rose-400/20">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:hover:bg-blue-600 disabled:shadow-none mt-2"
          >
            {isSubmitting ? "Submitting Request..." : "Request Access"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <RegisterForm />
    </Suspense>
  );
}
