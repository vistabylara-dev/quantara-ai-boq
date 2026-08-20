# Quantara advanced website and SaaS SEO, AEO and GEO audit

Reviewed: 20 August 2026
Branch: `audit/website-seo-aeo-geo-20260820`
Original audit base: `c5718491cf9d832743cbc90db60bc6c81b1e0701`
Reconciled release base: `c1e739ae658d45ea5aa0197eddcab0ecd3c4e853`
Scope: Quantara's public website and the public representation of the SaaS. Authenticated workflow execution, production infrastructure, private customer data and deployment are outside this audit.

## Executive verdict

The branch now has a coherent, evidence-led public search system rather than a collection of disconnected marketing pages.

- 65 static public content routes are registered centrally: 61 indexable and four intentionally noindex.
- Another 43 integration detail routes bring the public shell inventory to 108 routes and the sitemap to 104 URLs.
- Four incomplete legal placeholders are deliberately `noindex, nofollow`.
- Every registered route has a unique, length-bounded title and description, a self-canonical and an explicit robots state.
- A new UAE BOQ software comparison and Quantara eligibility page compares seven products without an arbitrary score or unsupported winner claim.
- Public SaaS claims now expose availability, limitations, dependencies and evidence status instead of presenting every code path as universally deployed.
- The marketing site is consistently dark and preserves the approved Arabic/RTL public experience. Six rewritten pages without matching Arabic content remain explicitly English/LTR rather than serving stale or mismatched translations.
- Repeated regional copy was replaced with distinct Dubai, Abu Dhabi, Saudi Arabia, Qatar and Oman procurement contexts.
- Structured data is centralized and tied to visible page content. Fabricated reviews, ratings, offers, prices, business addresses and geocoordinates remain absent.

This work improves crawlability, answer extraction, buyer comprehension and internal topical authority. It does not prove future traffic, rankings, AI citations or conversion uplift.

## Audit standard and evidence hierarchy

Claims were accepted in this order:

1. Current source code plus focused automated tests.
2. Current public page copy and the centralized capability register.
3. Official vendor or government documentation for competitor and regional facts.
4. Explicit editorial assessment, labelled as interpretation rather than fact.

The audit rejected search snippets, affiliate roundups, invented market statistics, fabricated reviews, unsupported awards, unverified customer outcomes and assumed production availability.

## Primary deliverables

### 1. UAE BOQ software comparison and eligibility page

Route: `/boq-software-comparison-uae`

The page compares:

- Quantara
- RIB CostX
- RIB Candy
- Procore Estimating
- Autodesk Forma Takeoff
- STACK
- PlanSwift

The comparison covers buyer fit, supported inputs, BOQ or estimating workflow, takeoff, controls, outputs, pricing transparency and UAE procurement questions. Desktop users receive a keyboard-focusable comparison table. Smaller screens receive readable product cards rather than a compressed desktop table.

Fairness controls:

- Factual competitor capability statements link to official sources.
- Buyer-fit and UAE notes are identified as editorial assessments.
- “Not publicly documented” means the reviewed sources did not confirm a claim; it does not mean a product lacks the capability.
- Features, editions, add-ons, regions and prices are date-stamped and must be rechecked before procurement.
- Product names and trademarks remain with their owners; no affiliation is implied.
- No universal winner, paid placement, star score or false precision is used.

Official-source families include RIB product and pricing pages, Procore UAE product and pricing pages, Autodesk Takeoff documentation, STACK product/support/pricing pages and PlanSwift product/checkout pages. The page itself contains the direct evidence links and a review date.

### 2. Quantara eligibility logic

Quantara is presented as suitable where the required outcome is a governed, human-reviewed BOQ workflow from supported sources.

| Buyer requirement | Public eligibility result |
| --- | --- |
| Reviewed CSV/XLSX intake | Suitable, with mapping, validation and approval requirements |
| Reusable internal catalogue and company items | Suitable with entitlement and governed-data conditions |
| Private client proposal review | Suitable with locked/checked source and configured delivery conditions |
| Arabic and RTL authenticated workspace/output | Suitable with conditions; not Arabic OCR, translation or source parsing |
| Automatic drawing takeoff | Not suitable today |
| OCR for scanned or image-only PDFs | Not suitable today |
| CAD, BIM or IFC quantity extraction | Not suitable today |

The page tells buyers not to shortlist Quantara when automatic geometry measurement, OCR or model-based takeoff is mandatory. This boundary is a commercial trust asset, not a weakness to hide.

### 3. Public SaaS capability truth

`src/lib/public-site/product-truth.ts` is the public claim contract. The feature register now distinguishes `Available`, `Controlled access`, `Limited` and `Not available`.

Newly surfaced source-and-test-reviewed capabilities include:

- client records;
- mapped and validated CSV/XLSX intake;
- an internal supplier and rate catalogue without live supplier feeds;
- a reusable company item library with governed-data and entitlement conditions;
- voice-assisted single-field change proposals requiring signed confirmation;
- private client proposal review that is not e-signature or contractual approval;
- revocable private technical-report sharing with provider/storage dependencies; and
- Arabic/RTL public and authenticated presentation with explicit limits around Arabic OCR, automatic translation and source parsing.

Explicit non-capabilities remain visible:

- automatic drawing measurement or takeoff;
- CAD, BIM and IFC model import for quantity extraction;
- scanned-PDF OCR;
- a public typed multi-operation proposal flow with selective approval;
- verified single sign-on; and
- anonymous or unauthenticated checkout; eligible plan checkout requires an account and an approved active synchronized provider mapping.

Evidence labels apply only to entries that actually carry reviewed evidence. Source/test review does not establish production deployment, account enablement, provider configuration or durable production storage.

## Technical SEO result

The complete route and keyword matrix is maintained in `docs/public-seo-geo-aeo-audit.md` and `docs/public-search-intent-map.md`.

### Metadata and indexation

- `src/lib/public-site/search-registry.ts` is the source of truth for path, intent, title, description and indexability.
- `src/lib/public-site/public-route-paths.ts` keeps middleware and client-shell routing aligned without shipping metadata to every browser.
- The sitemap derives from 61 indexable registry entries plus 43 integration detail routes, for 104 URLs.
- Thin legal placeholders, authentication utilities, authenticated application routes and token-sharing pages are excluded from public search indexing.
- `/industry-engines`, `/proposal/*` and `/technical-report/*` are crawl-blocked because they are authenticated or private sharing surfaces.
- The comparison page is linked from navigation, the comparison hub, homepage, feature page, pricing page and construction-estimating page.

### Language and canonical policy

- Public pages support approved English and Arabic presentation on shared canonical URLs. Distinct Arabic URLs are not published, so metadata exposes `en-AE` and `x-default` alternates only.
- There is no false `ar-AE` hreflang.
- Middleware supplies the pathname to the root layout. Localized public pages honor the persisted locale with matching document language and direction.
- The comparison page and five deeply rewritten regional pages remain explicitly `en-AE`/LTR until matching Arabic content is reviewed, preventing stale positional translations from being paired with new capability IDs.
- Every registered page owns its self-canonical through the metadata helper.

### Structured data

The public graph uses stable Organization, WebSite and SoftwareApplication identities. Page builders add the appropriate visible-content graph: WebPage, BreadcrumbList, FAQPage, TechArticle, ItemList and, for genuine step-based guides, HowTo with matching HowToStep nodes.

Guardrails:

- no `LocalBusiness` until a public address and coordinates are verified;
- no aggregate rating or review schema without real, attributable reviews;
- no Offer or price schema without verified public commercial terms;
- no awards, certifications, customers or outcomes inferred from absent evidence;
- no application-wide bilingual or GCC service-coverage schema beyond verified truth; and
- FAQ markup is semantic support, not a rich-result or ranking guarantee.

## AEO and GEO result

The public templates use direct-answer introductions, visible limitations, specific FAQs and consistent entity relationships. The strongest citation-ready elements are:

- a stable definition of Quantara and its professional-review boundary;
- answer-first BOQ, extraction, review and comparison pages;
- explicit “does” and “does not” capability statements;
- a dated official-source comparison methodology;
- visible regional procurement context instead of city-name substitution; and
- internal topic clusters spanning core product, PDF/OCR, measurement, industries, regions, comparisons and education.

Five regional pages were rewritten because their prior substantive string overlap was about 70%. Pairwise long-string overlap is now approximately 1–2%, with distinct subjects:

- Dubai: eSupply, Dubai Municipality permit separation and fit-out/MEP addenda;
- Abu Dhabi: Government Procurement Gate, supplier qualification and shortlisting boundaries;
- Saudi Arabia: Etimad, Saudi Building Code context and Arabic-source limitations;
- Qatar: classification, tender securities, unified procurement and Ashghal participation context; and
- Oman: official eTendering, local-content records and subcontract quotation exchange.

Government facts link to primary public sources. The copy does not claim procurement approval, local compliance, local rates or official endorsement.

## Theme, readability and accessibility result

The marketing layout deliberately uses a dark presentation. Shared comparison, knowledge, regional and industry templates plus their hubs now use one coherent dark palette with readable headings, body text, borders and focus states.

Defects found and corrected during rendered verification:

- blue links below WCAG AA contrast on several knowledge/legal pages;
- slate-500 evidence labels on slate-950 cards in the feature register;
- an About breadcrumb with light-theme-only colors;
- homepage capability links causing 20 pixels of horizontal overflow at desktop width;
- a wide desktop comparison table without a keyboard-focusable scroll region;
- duplicate landmark names around that table;
- a mobile footer disclaimer squeezed into one quarter of the available width; and
- English-only rewritten pages inheriting Arabic document semantics or stale positional translations.

The comparison table has a dedicated accessible region label and visible focus ring. FAQ disclosures retain a visible open/closed indicator. External source links identify new-tab behavior for assistive technology.

## Validation record

| Check | Result | Meaning |
| --- | --- | --- |
| Focused registry/product-truth/schema/middleware unit tests | Pass | 55 focused tests passed across six files covering the public registry, product truth, schema, middleware, sales truth and dictionary parity gates |
| TypeScript `--noEmit` | Pass | The reconciled TypeScript compiled under Node 24.17.0 and npm 11.13.0 |
| ESLint | Pass with documented worktree wrapper caveat | The complete configured targets passed using the repository config and local plugin root; the standard wrapper also reports a duplicate `@next/next` plugin-resolution conflict caused by this nested worktree, not a source diagnostic |
| Production build | Pass | Next.js 15.5.22 compiled and generated 151 of 151 static pages |
| Cloudflare/OpenNext compatibility build | Pass | OpenNext built the worker and verified Prisma workerd packaging and fetch-only Undici bundling; no deploy command ran |
| 108-route Playwright registry sweep | Pass | All four production-mode checks passed, covering HTTP, metadata, canonicals, robots, H1, JSON-LD, language and overflow |
| Representative dark-theme Axe sweep | Pass | Eight high-risk public routes passed after correcting the floating companion landmark, CTA and muted-text contrast, and pricing heading order |
| Arabic public localization and English-only exceptions | Pass | Six production-mode tests passed; localized routes render Arabic/RTL, integration H1s are localized, and the six reviewed English-only rewrites remain English/LTR |
| 390×844 priority-route and navigation pass | Pass | Five routes plus mobile menu and comparison discovery passed without horizontal overflow |
| `git diff --check` | Pass | No whitespace-error blocker remains |
| Production deployment and custom domain | Tracked in release verification | This source audit does not infer production state; the exact deployed SHA and custom-domain alias must be verified separately |
| Field Core Web Vitals and Search Console | Not measured | Requires deployed traffic and authorized measurement data |

These results apply to the locally validated release source on 2026-08-20. Re-run the affected gates if the branch changes before merge.

## Residual opportunities, not blockers

1. Compress or replace `/logo.png`; the source asset is much larger than its 48×48 display use.
2. Add route-specific social images only when the editorial benefit justifies the maintenance burden; the shared images are currently the baseline.
3. Publish distinct, complete Arabic URLs before adding `ar-AE` hreflang; cookie-selected localization on a shared canonical is not a separate crawlable Arabic URL.
4. Add verified reviewer authorship, editorial policy, customer evidence and case studies only when named sources and permissions exist.
5. Run a preview crawl, social-card validation and lab performance pass for each release, then verify the exact custom-domain deployment SHA.
6. Use Search Console, analytics and field performance data after launch to prioritize titles, snippets, content refreshes and conversion paths. Do not invent a traffic forecast.

## Reviewer instructions for Kimi, Claude and OpenAI

Use this prompt with the branch or patch:

> Review only Quantara's public website and its public SaaS representation on branch `audit/website-seo-aeo-geo-20260820`. Treat source code and tests as evidence of implementation, not proof of production deployment. Verify every public claim against `src/lib/public-site/product-truth.ts`, visible page copy, tests or a linked official source. Do not reward keyword density, unsupported schema, fake local-business details, invented reviews, arbitrary competitor scores or false Arabic hreflang. Report findings as Blocker, Major, Minor or Verified. For each finding, include file and line, user/search impact, evidence and the smallest safe correction. Separately evaluate: metadata/canonicals/indexation; answer quality; AI citation readiness; competitor fairness; Quantara eligibility boundaries; schema-visible-content parity; UAE/GCC regional uniqueness; dark-theme contrast; keyboard/mobile readability; and whether any local test result is incorrectly presented as production proof.

Minimum files to inspect:

- `src/lib/public-site/search-registry.ts`
- `src/lib/public-site/public-route-paths.ts`
- `src/lib/public-site/product-truth.ts`
- `src/lib/public-site/schema.ts`
- `src/app/(marketing)/layout.tsx`
- `src/app/(marketing)/features/page.tsx`
- `src/app/(marketing)/boq-software-comparison-uae/page.tsx`
- `src/components/layout/public-header.tsx`
- `src/components/layout/public-footer.tsx`
- the five country/city pages named above
- `tests/e2e/public-search-complete.spec.ts`
- `tests/public-site-registry.test.ts`
- `tests/public-product-truth.test.ts`
- `tests/public-structured-data.test.ts`

Reviewer acceptance questions:

1. Can every indexable route answer one clear intent without conflicting metadata?
2. Does each schema node describe visible, current content?
3. Are unsupported Quantara capabilities clearly unavailable or conditional?
4. Can a buyer understand when Quantara should not be shortlisted?
5. Are competitor facts backed by stable official pages and dated fairly?
6. Are English and Arabic semantics truthful on the first server response?
7. Can keyboard and phone users reach and read the comparison?
8. Are local validation, preview validation, production availability and business outcomes kept separate?

## Release boundary

This document records source-audit findings and does not itself prove GitHub, preview or production state. Release status belongs in evidence tied to the final pull request, merge SHA, deployment ID and verified custom domain. The website audit requires no production-data, Prisma-schema or migration change.
