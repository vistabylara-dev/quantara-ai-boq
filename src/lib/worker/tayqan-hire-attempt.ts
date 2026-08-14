/**
 * TAYQAN-1 — pure, framework-free state machine for the hire button's
 * Idempotency-Key. Extracted out of the page component so the rule "never
 * mint a new key merely because a response was lost" is unit-testable
 * without a DOM/React test harness (this repo has none).
 *
 * The key for a hire attempt on a given BOQ must stay stable across an
 * uncertain retry (a POST whose response never arrived) so the server's
 * idempotency-key uniqueness constraint — not client trickery — is what
 * actually guarantees a second click can't create a second WorkerRun. A key
 * should only be replaced once either (a) the run's existence for this
 * attempt is definitively known (a success response, or a confirmed-via-
 * lookup run), or (b) the user picks a different BOQ, which is a genuinely
 * new hire intent, not a retry of the old one.
 */

export type HireAttemptKeyState = { boqId: string; key: string } | null;

/**
 * The key to send on a hire click for `boqId`: the same one still pending
 * for that exact BOQ, or a freshly generated one otherwise (first attempt
 * for this BOQ, a previous attempt was resolved, or the BOQ changed).
 */
export function nextHireIdempotencyKey(
  boqId: string,
  state: HireAttemptKeyState,
  generateKey: () => string,
): string {
  if (state && state.boqId === boqId) return state.key;
  return generateKey();
}
