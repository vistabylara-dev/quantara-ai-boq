"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import type { CommercialAccessDecision } from "@/lib/commercial/commercial-types";
import { clearPendingBoqUnlockIntent, readPendingBoqUnlockIntent } from "@/lib/commercial/pending-unlock-intent";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — Antigravity's real checkout (POST
 * /api/commerce/checkout) hardcodes its Stripe success_url/cancel_url to
 * /settings/subscription?checkout=success|cancelled — there is no way to
 * return the browser straight to the BOQ/project the user was unlocking.
 * This component renders on that landing page and restores that context
 * from the sessionStorage intent CommercialUnlockPanel stored right before
 * redirecting to checkout (see pending-unlock-intent.ts).
 *
 * Query params (?checkout=...) are used ONLY to decide what UI to show —
 * never as proof of entitlement. "Access ready" is only ever declared once
 * a real server call (the same GET /api/boqs/[boqId]/commercial-requirements
 * this app already uses to gate export) returns ALLOW.
 */

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 6; // ~18s bounded — no infinite spinner

type Phase = "cancelled" | "activating" | "access-ready" | "activation-delayed";

export function CheckoutReturnStatus() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get("checkout");
  const [intent] = useState(() => readPendingBoqUnlockIntent());
  const [phase, setPhase] = useState<Phase | null>(null);
  const [pollGeneration, setPollGeneration] = useState(0);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!intent) return;
    if (checkoutParam === "cancelled") {
      setPhase("cancelled");
      return;
    }
    if (checkoutParam !== "success") return;

    setPhase("activating");
    attemptRef.current = 0;
    let cancelled = false;

    async function poll() {
      attemptRef.current += 1;
      try {
        const decision = await apiClient.get<CommercialAccessDecision>(
          `/api/boqs/${encodeURIComponent(intent!.boqId)}/commercial-requirements`,
        );
        if (cancelled) return;
        if (decision.status === "ALLOW") {
          setPhase("access-ready");
          return;
        }
      } catch {
        // Treat a transient failure like "not ready yet" — never surface a
        // raw error here; the bounded-attempts fallback below covers it.
      }
      if (cancelled) return;
      if (attemptRef.current >= MAX_POLL_ATTEMPTS) {
        setPhase("activation-delayed");
        return;
      }
      setTimeout(() => void poll(), POLL_INTERVAL_MS);
    }
    void poll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intent is captured once via useState initializer; pollGeneration is the deliberate manual-retry trigger
  }, [checkoutParam, pollGeneration]);

  const checkAgain = () => setPollGeneration((g) => g + 1);

  const continueToBoq = () => {
    clearPendingBoqUnlockIntent();
    if (intent) router.push(intent.returnTo);
  };

  if (!intent || !phase) return null;

  if (phase === "cancelled") {
    return (
      <div role="status" className="mb-8 rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Checkout cancelled</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Your work is safe and nothing was changed.</h2>
        <button
          type="button"
          onClick={continueToBoq}
          className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Continue My BOQ
        </button>
      </div>
    );
  }

  if (phase === "activating") {
    return (
      <div role="status" aria-live="polite" className="mb-8 rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">Payment received</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Activating your access…</h2>
        <p className="mt-2 text-sm text-slate-400">Your BOQ is safe. This usually takes a few seconds.</p>
      </div>
    );
  }

  if (phase === "activation-delayed") {
    return (
      <div role="status" className="mb-8 rounded-[32px] border border-amber-900 bg-amber-950/20 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400">Still activating</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Your payment was received. Access is still being activated.</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={checkAgain}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Check again
          </button>
          <button
            type="button"
            onClick={continueToBoq}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Return to my BOQ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="mb-8 rounded-[32px] border border-emerald-900 bg-emerald-950/20 p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">✓ Your access is ready</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Your BOQ is waiting exactly where you left it.</h2>
      <button
        type="button"
        onClick={continueToBoq}
        className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
      >
        Continue My BOQ
      </button>
    </div>
  );
}

export default CheckoutReturnStatus;
