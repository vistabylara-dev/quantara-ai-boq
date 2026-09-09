# Quantara sales pilot — 9 September 2026

## What is implemented

An English/Arabic public sales advisor selects reviewed product answers and a
qualification question, then links to existing feature, pricing, registration
and contact-sales routes. It cannot change prices, issue arbitrary payment
links, grant entitlements or claim a sale. The owner can review the latest 50
stored contact requests and budget readiness at `/admin/sales-agent`.

This is an inbound advisor, not an autonomous outbound closer. Prospect
discovery, email sequences, response ingestion and agent-to-payment attribution
are not implemented. No outbound messages or prospect-data purchases are made.

## Deployment requirements

1. Review CI and apply only `20260909170000_sales_agent_budget` through the
   established migration procedure after confirming the correct target DB.
   Do not run blanket migrations against an unverified production database.
2. `SALES_AGENT_OPENAI_API_KEY`: dedicated key, Production only. Never reuse
   `OPENAI_API_KEY` or TAYQAN configuration. The owner reports saving this key
   in Vercel; that configuration has not been independently verified.
3. `SALES_AGENT_IP_HASH_SECRET`: independent random secret, at least 32
   characters. Used only for daily per-IP abuse control. Do not log raw IPs.
4. `SALES_AGENT_ENABLED=true`: opt-in after migration and checks. Missing/false
   keeps the public UI hidden and the route unavailable. A missing key, secret,
   expired pricing review, DB error or exhausted allowance uses reviewed
   non-AI answers and makes no paid request.
5. Verify public English/Arabic rendering, disabled behavior, owner-only status,
   real reservation concurrency, one live answer and unchanged existing checkout.

No deployment or secret is changed by adding this source. Existing Stripe,
TAYQAN, auth, BOQ and client-job implementation is untouched.

## Budget design

The approved ceiling is AED 50/month for this pilot's OpenAI requests. The
database records **reserved allowance**, not claimed actual provider spend.
Each attempted provider call reserves 10 fils. At most 500 calls fit in a UAE
calendar month, with additional limits of 30 calls/day globally and 10/day/IP.
Reservations commit before network activity under a PostgreSQL row lock, shared
by all application replicas using the same database. Global request IDs prevent
repeat billing on replay. A failed or ambiguous request keeps its reservation;
there is no automatic provider retry and no release-on-timeout loophole.

Model is fixed to `gpt-4.1-mini-2025-04-14`; inputs are bounded to 12,000 UTF-8
bytes and output to 300 tokens. No provider tools, images, search, embeddings or
alternative models are allowed. OpenAI's listed rates checked 2026-09-09 are
$0.40 input and $1.60 output per million tokens:
https://developers.openai.com/api/docs/models/gpt-4.1-mini
Using the conservative input bound of 12,000 tokens plus framing, this costs
under $0.006 per request, well below 10 fils including conversion headroom.
Review pricing before `2026-10-09T00:00:00Z`; AI calls stop after that date.

The bound covers only calls through this code and this shared ledger. Never
reuse the key in another application, or enable it in a Preview deployment
against a separate budget database. Hosting, mailbox and external lead-data
costs are outside this OpenAI allowance and have not been authorized here.

## Privacy and product truth

The UI explains that OpenAI may process messages and requests no confidential
data. Only the latest four short user messages plus the current question go to
the provider with `store:false`; the app does not persist chat text. The model
returns only allowlisted answer/question IDs. The server renders approved copy
and links, preventing generated terms, discounts, unsupported promises or URLs
from reaching the visitor. Retained budget records contain HMAC IP digests,
dates and operational status, not conversation content.

Owner inquiry access is protected by the existing platform-owner authorization.
Stored inquiries are not labelled as delivered emails or paid conversions.

## Remaining work before autonomous outreach

Confirm target segments and sending mailbox; provide a source of independently
verified business leads; implement consent/suppression and opt-out handling,
durable scheduled messages, reply ingestion, duplicate prevention and limits.
Any discovery API calls must share this allowance or receive a separately
approved cap. Purchase attribution must use authenticated company identity and
verified Stripe state, never a chat statement or success-page visit. Do not
enable outbound delivery merely because the sales API key is present.
