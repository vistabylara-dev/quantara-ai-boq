"use client";

import { useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type RecoveryResult = {
  recovered: boolean;
  roleChanged: boolean;
  status: "completed" | "already_completed";
};

export default function PlatformOwnerRecoveryPage() {
  const [isRecovering, setIsRecovering] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function recoverOwner() {
    setIsRecovering(true);
    setError(null);

    try {
      const recovery = await apiClient.post<RecoveryResult>(
        "/api/admin/platform-owner-recovery",
        { confirm: "BOOTSTRAP_PLATFORM_OWNER" },
      );
      setResult(recovery);
    } catch (recoveryError) {
      setError(getApiErrorMessage(recoveryError));
    } finally {
      setIsRecovering(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111F] px-4 py-16 text-white">
      <section className="mx-auto max-w-xl rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
          Production recovery
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Platform owner recovery</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          This action succeeds only for the active, verified account whose email
          exactly matches the server-configured platform owner. The result is
          written to the platform audit log.
        </p>

        {result ? (
          <div role="status" className="mt-6 rounded-2xl border border-emerald-700 bg-emerald-950/40 p-4 text-emerald-200">
            Platform owner recovery {result.status === "completed" ? "completed" : "was already completed"}.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void recoverOwner()}
            disabled={isRecovering}
            className="mt-6 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRecovering ? "Recovering owner access…" : "Recover platform owner"}
          </button>
        )}

        {error && (
          <div role="alert" className="mt-6 rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-rose-200">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}
