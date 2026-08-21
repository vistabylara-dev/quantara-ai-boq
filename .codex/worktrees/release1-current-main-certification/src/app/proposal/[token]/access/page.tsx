"use client";

import { useCallback, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { PortalShell } from "../../portal-shell";

type PageProps = { params: Promise<{ token: string }> };

export default function ProposalAccessPage(props: PageProps) {
  const params = use(props.params);
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/public/proposals/${params.token}/access`, { passcode });
      router.push(`/proposal/${params.token}`);
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [params.token, passcode, router]);

  return (
    <PortalShell>
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Protected proposal</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Enter access passcode</h1>
        <p className="mt-2 text-sm text-slate-500">This proposal is protected. Enter the passcode you were given to continue.</p>

        <input
          type="password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && !isSubmitting && passcode.trim() && void submit()}
          placeholder="Passcode"
          className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm text-slate-900 outline-none focus:border-slate-500"
        />
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSubmitting || !passcode.trim()}
          className="mt-4 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSubmitting ? "Verifying…" : "Continue"}
        </button>
      </div>
    </PortalShell>
  );
}
