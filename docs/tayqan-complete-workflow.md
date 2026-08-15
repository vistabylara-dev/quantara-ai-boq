# TAYQAN — Paid Digital QS Product Contract

This document is the canonical implementation contract for TAYQAN. Do not replace it with a pricing-only or navigation-only implementation.

## Customer journey

`Floating TAYQAN → Projects → Project → TAYQAN workspace → hire package → Stripe Checkout → verified entitlement → intake conversation → persistent work order → source processing → evidence review → quantity preparation → rate preparation when requested → BOQ assembly → final governed QA → Ready for Acceptance`

The browser's `checkout=success` query parameter is never payment authority. A signed Stripe webhook / authoritative Stripe subscription state is required.

## Packages

| Package | Price | Billing | Access |
|---|---:|---|---|
| TAYQAN Day Hire | AED 299 | one-time | 24 hours |
| TAYQAN Week Hire | AED 999 | one-time | 7 days |
| TAYQAN Monthly / Digital QS | AED 2,499 | recurring monthly | Stripe billing period |

Canonical price codes: `tayqan_day_299`, `tayqan_week_999`, `tayqan_monthly_2499`.

TAYQAN is commercially independent from Starter / Professional / Business. A company may hold a normal Quantara subscription and TAYQAN Monthly simultaneously.

## Persistent work order

Exactly one `TayqanWorkOrder` exists per paid intake session. Refresh/retry must reuse it. The work order persists its current stage, target BOQ, blockers, overrides, QA run and event history. It must never recreate a completed source job or silently start a second BOQ because a page was refreshed.

Stages:

1. `SOURCE_DISCOVERY` — resolve project, target BOQ and source inventory.
2. `SOURCE_PROCESSING` — reuse completed classification/preprocessing/table-extraction jobs; enqueue only missing supported work.
3. `EVIDENCE_REVIEW` — require professional confirmation/correction/rejection of extracted evidence.
4. `QUANTITY_PREPARATION` — use confirmed quantities/calculations; ask when a dimension/quantity is genuinely missing.
5. `RATE_PREPARATION` — quantities-only skips rates; otherwise use an exact valid matched rate or ask for an approved unit cost/source.
6. `BOQ_ASSEMBLY` — use the existing governed extraction-to-BOQ import service; preserve quantity provenance; do not fabricate margin.
7. `VALIDATION` — run the existing TAYQAN `REVIEW_EXISTING_BOQ` worker as final QA and surface material questions.
8. `READY_FOR_ACCEPTANCE` — stop. Human final acceptance remains required.

## Truth and capability boundaries

TAYQAN may only use capabilities that exist in Quantara. Current supported foundations include project file storage, source classification, PDF page preprocessing, structured CSV/XLSX/PDF table extraction, extracted-entity professional review, deterministic quantity formulas, reviewed extraction-to-BOQ import, rate catalogue records and final BOQ QA.

TAYQAN must never fabricate missing geometry, dimensions, quantities, rates, drawing revision authority or unsupported OCR/computer-vision output. If a source cannot produce governed evidence, the work order pauses and asks for supported/manual evidence.

## Never automatic

TAYQAN does **not** automatically lock, issue, approve, tender-submit, or contractually certify a BOQ. The final state is **Ready for Acceptance**.

## Regression freeze

Do not modify unrelated Starter/Professional/Business subscription behavior, refunds, catalogue datasets, auth, recovery endpoints, Autodesk/Google Drive contracts, or the successful Save/Lock/Generate BOQ path to implement TAYQAN.
