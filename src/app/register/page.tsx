"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

export default function RegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [role, setRole] = useState("Quantity Surveyor");
  const [country, setCountry] = useState("");
  const [primaryIndustry, setPrimaryIndustry] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [approximateVolume, setApproximateVolume] = useState("");
  const [consent, setConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  let initialPlan = "starter";
  if (typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    const p = searchParams.get("plan");
    if (p) initialPlan = p;
  }
  const [interestTier, setInterestTier] = useState(initialPlan);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/auth/register", { 
        companyName, fullName, email, password, interestTier,
        role, country, primaryIndustry, intendedUse, approximateVolume, consent
      });
      setRegistered(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registered) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h1 className="text-2xl font-semibold text-white">Check your email</h1>
          <p className="mt-3 text-sm text-slate-400">
            We created your company workspace. In this development environment, no email is
            actually sent — the verification link was printed to the server console instead.
            Copy it from there and open it, or go to{" "}
            <Link href="/verify-email" className="text-blue-400 underline hover:text-blue-300">
              /verify-email
            </Link>{" "}
            and paste the token manually.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-12 px-4">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Quantara</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Request Early Access</h1>
        <p className="mt-2 text-sm text-slate-400">Creating an Early Access account does not begin a paid subscription or automatic billing.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300" htmlFor="email">Business Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300" htmlFor="companyName">Company</label>
              <input
                id="companyName"
                required
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300" htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none"
              >
                <option value="Quantity Surveyor">Quantity Surveyor</option>
                <option value="Estimator">Estimator</option>
                <option value="Engineer">Engineer</option>
                <option value="Project Manager">Project Manager</option>
                <option value="Contractor">Contractor</option>
                <option value="Procurement Professional">Procurement Professional</option>
                <option value="Company Owner">Company Owner</option>
                <option value="Consultant">Consultant</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300" htmlFor="country">Country</label>
              <input
                id="country"
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300" htmlFor="primaryIndustry">Primary Industry</label>
              <input
                id="primaryIndustry"
                required
                value={primaryIndustry}
                onChange={(event) => setPrimaryIndustry(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300" htmlFor="intendedUse">Intended Use</label>
              <input
                id="intendedUse"
                required
                value={intendedUse}
                onChange={(event) => setIntendedUse(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300" htmlFor="approximateVolume">Approx. Monthly Project Volume</label>
              <select
                id="approximateVolume"
                value={approximateVolume}
                onChange={(event) => setApproximateVolume(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none"
              >
                <option value="">Select volume...</option>
                <option value="1-5">1-5 projects</option>
                <option value="6-20">6-20 projects</option>
                <option value="21-50">21-50 projects</option>
                <option value="50+">50+ projects</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-300" htmlFor="interestTier">Interest Tier</label>
            <select
              id="interestTier"
              value={interestTier}
              onChange={(event) => setInterestTier(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none"
            >
              <option value="starter">Starter Interest</option>
              <option value="professional">Professional Interest</option>
              <option value="business">Business Interest</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-300" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">At least 8 characters, with a letter and a number.</p>
          </div>

          <div className="flex items-start gap-3 mt-4">
            <input 
              type="checkbox" 
              id="consent" 
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-slate-950" 
            />
            <label htmlFor="consent" className="text-sm text-slate-400">
              I consent to the collection and processing of my information for Early Access evaluation in accordance with the <Link href="/privacy" className="text-blue-400 underline hover:text-blue-300">Privacy Policy</Link>.
            </label>
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Request Access"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-400 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 underline hover:text-blue-300">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
