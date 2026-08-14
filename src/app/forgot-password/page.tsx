"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h1 className="text-2xl font-semibold text-white">Reset your password</h1>

        {submitted ? (
          <p className="mt-3 text-sm text-slate-400">
            If an account exists for that email, we sent a password reset link. Check your
            inbox and spam folder, then follow the secure link to choose a new password.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="mt-6 inline-block text-sm text-blue-400 hover:text-blue-300">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
