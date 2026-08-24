# BOQ finalization invariant

This is a production safety boundary. It applies equally to human-authored and AI-authored changes.

## Non-negotiable rule

A BOQ revision may be locked, used for a clean final document, or used as a client-proposal source only when the shared finalization gate reports `lockEligible: true`.

The gate must reject:

- verification that has never run;
- verification from an older BOQ version;
- unresolved critical verification exceptions;
- active items without confirmed quantity and rate provenance.

## Required architecture

1. `evaluateBOQFinalizationGate` is the single presentation/readiness policy.
2. BOQ DTOs and verification DTOs must both expose that policy result.
3. Proposal UI must not offer locking when the policy rejects the revision.
4. Verification UI must never call a stale empty exception list clean.
5. The lock API must re-run verification immediately before `lockBOQ`.
6. `lockBOQ` remains the final transactional authority and must independently reject invalid item data, stale verification, critical exceptions, and incomplete estimate provenance.
7. Documents readiness must consume the BOQ's shared finalization result; a clean exception count alone is insufficient.
8. Draft CSV/HTML and quantities-only review DOCX remain marked as drafts; unresolved critical exceptions still block their generation.
9. Client proposals must reject every generated document whose `isDraft` flag is true, even if the BOQ is later locked.

## Change control

Any change to the finalization gate, BOQ lock route/repository, verification repository/page, proposal source selection, or final-document eligibility must preserve and extend `tests/boq-finalization-gate.test.ts` and `tests/boq-finalization-architecture-contract.test.ts`.

CI must be required on `main`. A pull request that removes, bypasses, weakens, skips, or rewrites these safeguards must not be merged without explicit owner review.
