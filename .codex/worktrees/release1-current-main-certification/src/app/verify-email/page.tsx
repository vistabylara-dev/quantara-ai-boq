"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submitToken = async (value: string) => {
    if (!value.trim()) return;
    setStatus("pending");
    setError(null);
    try {
      await apiClient.post("/api/auth/verify-email", { token: value.trim() });
      setStatus("success");
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
      setStatus("error");
    }
  };

  useEffect(() => {
    const initialToken = searchParams.get("token");
    if (initialToken) {
      void submitToken(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitToken(token);
  };

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h1 className="text-2xl font-semibold text-white">Verify your email</h1>

        {status === "success" ? (
          <>
            <p className="mt-3 text-sm text-emerald-300">Your email is verified. You can sign in now.</p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-400">
              Paste the verification token from the development console link.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Verification token"
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              {error && <p className="text-sm text-rose-300">{error}</p>}
              <button
                type="submit"
                disabled={status === "pending"}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {status === "pending" ? "Verifying..." : "Verify email"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
