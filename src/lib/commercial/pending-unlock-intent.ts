/**
 * CANVA-HUMAN-JOURNEY-FINAL — Antigravity's real checkout (POST
 * /api/commerce/checkout) hardcodes its Stripe success_url/cancel_url to
 * /settings/subscription — there is no way to pass a BOQ-specific return
 * path through Stripe's redirect today. This sessionStorage-backed intent
 * is the standard client-side mitigation: remember which BOQ/project the
 * user was trying to unlock right before leaving for checkout, so the
 * generic settings page can still send them back to the exact project
 * instead of stranding them. Query params (checkout=success/cancelled) only
 * ever restore UI context here — they are never treated as proof of
 * entitlement; that always comes from a real server call.
 */

const STORAGE_KEY = "quantara:pending-boq-unlock";

export type PendingBoqUnlockIntent = {
  boqId: string;
  returnTo: string;
};

function isValidReturnTo(returnTo: string): boolean {
  return returnTo.startsWith("/") && !returnTo.startsWith("//");
}

export function storePendingBoqUnlockIntent(intent: PendingBoqUnlockIntent): void {
  if (!isValidReturnTo(intent.returnTo)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — the return-state UX
    // simply won't be able to restore context; checkout itself is unaffected.
  }
}

export function readPendingBoqUnlockIntent(): PendingBoqUnlockIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBoqUnlockIntent>;
    if (typeof parsed.boqId !== "string" || typeof parsed.returnTo !== "string" || !isValidReturnTo(parsed.returnTo)) {
      return null;
    }
    return { boqId: parsed.boqId, returnTo: parsed.returnTo };
  } catch {
    return null;
  }
}

export function clearPendingBoqUnlockIntent(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — see storePendingBoqUnlockIntent.
  }
}
