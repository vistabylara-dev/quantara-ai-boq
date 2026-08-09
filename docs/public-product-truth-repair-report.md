# Quantara public product-truth repair report

Reviewed: 2026-08-09
Scope: `feat/website-product-truth-seo-geo-aeo` public website, search discovery, public routing and related guardrails. Production deployment and the in-app Guide are outside this change.

## Executive summary

The branch replaces the obsolete AI-proposal-first website story with a review-led professional BOQ workflow. Product capability, search metadata, canonical URLs, schema entities, sitemap entries and public-route ownership use central sources. The final re-audit also corrects two implementation mismatches: plain PDF paragraph text is not represented as a BOQ candidate, and technical-report generation is limited rather than unqualified availability.

## Branch/base SHAs

- Original website commit: `5a64f6eae532c8e78357c2292bdb048bb642804b`.
- Original merge base: `b8deae0d58d853ac273651e78654e296a2148b13`.
- Current main incorporated: `06ee5d2a8394fae522ea252225b359da157a3a59`.
- Conflict-free integration merge: `e945896`.
- The final repair commit SHA is recorded in the draft PR and final certification because a commit cannot truthfully include its own SHA.

## Files changed

The original website commit changed 100 files: 16 added, 84 modified and none removed. Its scope is marketing pages, public layouts/navigation, metadata, structured data, routing, tests and documentation. The current-main integration adds only Release 1 extraction and quantity-integrity implementation/tests. Final completion edits are limited to public truth, affected public pages, private-utility metadata, shell ownership, audit documents and public-site tests.

## Product-truth architecture

- `src/lib/public-site/product-truth.ts` owns the entity definition, review notice and public capability statuses.
- `src/lib/public-site/search-registry.ts` owns public intent, titles, descriptions, index policy, canonicals and social metadata.
- `src/lib/public-site/schema.ts` owns canonical Organization, WebSite, SoftwareApplication and page-graph IDs.
- `src/lib/public-site/public-route-paths.ts` owns the client/edge-safe public path contract.
- Status-bearing SEO cards now reference Product Truth capability IDs; pages cannot independently choose `Available`, `Limited` or `Not available` badges.

## Homepage changes

The homepage presents Quantara as AI-assisted BOQ workflow software for construction professionals. Voice and connected sources are secondary, explicitly status-governed capabilities. It does not present silent AI execution, automatic takeoff, OCR, self-service purchase or replacement of professional judgement.

## Nine-stage workflow

1. Project setup
2. Supported sources
3. Reviewed extraction
4. Dimensions
5. Visible calculations
6. BOQ organization
7. Professional review
8. Validation
9. Professional outputs

The former Speak / AI proposal / approve-AI-change narrative is not the homepage workflow.

## Features corrections

The Features page renders the central capability register. Text PDF, spreadsheet import, reviewed extraction, BOQ management and supported BOQ outputs are available within their stated review boundaries. Google Drive and voice remain controlled access. Calculations, source attribution, scanned-page detection and technical-report generation are limited. OCR, automatic drawing takeoff, model-file import, typed multi-change/selective approval and SSO are unavailable.

## OCR corrections

The implementation reports `OCR_IMPLEMENTATION_STATUS = "NOT_IMPLEMENTED"`. Public copy distinguishes image-only page detection from OCR extraction. No public page represents OCR as available; scanned content requires manual transcription and review.

## Voice wording

Voice is limited to supported BOQ contexts and a narrow single-change proposal/apply separation. A transcript is a proposal, not an automatic data mutation. Human confirmation is required. Typed multi-operation and selective-approval workflows are not published as current capabilities.

## Google Drive wording

Google Drive project-file import is controlled access. It requires an authorized workspace connection, entitlement and supported file type. The public navigation links to the controlled capability entry, not the protected Integrations screen. Other connected applications are not presented as live.

## Traceability wording

Quantara retains supported source identity/evidence, calculation inputs/formulas and output-level BOQ/template/revision/checksum records. BOQ items and rendered outputs do not provide a complete durable field-to-source chain for every value. Public wording therefore says limited source attribution, not full end-to-end traceability.

## Pricing corrections

The public site states that self-service subscription checkout is not currently offered. Controlled Early Access scope, entitlements and commercial terms are confirmed separately in writing. Obsolete Starter, Professional and AED 15,000 Enterprise offers, Buy/Subscribe CTAs and unverified entitlements are absent and regression-tested.

## Technical report wording

Current technical-report generation accepts DOCX and uses local filesystem storage. It is now `LIMITED`: supported only in configured environments, and durable production storage must be confirmed during Controlled Early Access. Other technical-report formats and voice/typed AI report editing are not published as available. Separate BOQ document generation supports PDF, XLSX, CSV, DOCX and HTML workflows subject to review and format-specific controls.

## BOQ educational corrections

The BOQ definition now describes measured work sections, item descriptions, units, quantities, preliminaries, provisional sums, pricing columns and procurement/measurement context. It is not reduced to “materials + parts + labour,” and it does not imply RICS approval, certification or endorsement. Spreadsheet comparisons preserve Excel as a legitimate complementary tool.

## SEO metadata

The registry accounts for 62 public content routes: 58 indexable and four thin legal placeholders marked noindex. Every registered route has a unique title and description within the configured 60/155-character limits, a self canonical, en-AE alternate, robots policy, Open Graph data and Twitter data.

## GEO/AEO

Commercial and informational pages use direct answers, visible FAQs where relevant, UAE/GCC context, role-specific workflow language and explicit limitations. Regional pages do not claim local rates, tax calculation, authority approval, UAE hosting or regulatory compliance. Unsupported prevalence claims were removed from the takeoff comparison.

## Structured data

The marketing layout emits one Organization, WebSite and SoftwareApplication entity graph. Page templates emit WebPage, BreadcrumbList, visible FAQPage and TechArticle nodes where applicable. No ratings, reviews, offers, prices, awards, certifications or invented LocalBusiness address are published.

## Public routing

The search registry and public path contract are equal. Middleware imports the path-only contract. Representative signed-out marketing paths are tested directly against middleware, while `/dashboard` remains protected. Login/account utilities and private token/admin utilities carry noindex metadata and remain outside the sitemap.

## Sitemap

`src/app/sitemap.ts` derives URLs only from indexable search-registry entries. Authentication, private token, protected application and four thin noindex legal routes are excluded.

## Public shell isolation

Static marketing routes use PublicHeader/PublicFooter and bypass AppShell through the shared public path contract. The authenticated `/industries/[industryId]` route was moved outside the marketing route group so it cannot receive both shells. Private proposal and technical-report token surfaces continue to bypass authenticated chrome.

## Tests

Focused guardrails pass 28/28 checks covering route/registry equality, signed-out middleware behavior, OCR implementation-to-public-status consistency, PDF text-versus-table-candidate boundaries, capability-ID status centralization, exact sitemap inclusion, account/private utility noindex metadata, public shell ownership, canonical schema entity IDs, visible FAQ/schema coupling and obsolete pricing regressions. The final public Playwright audit passes 28/28 desktop/mobile checks for the 12 required routes, one H1/main, public header/footer, app-shell absence, metadata, JSON-LD, horizontal overflow, console/page errors, navigation, footer and CTA links, theme persistence and protected dynamic-industry routing.

## Remaining limitations

- OCR extraction from scanned or image-only PDFs is unavailable.
- Automatic drawing measurement, object counting and final takeoff are unavailable.
- CAD, BIM and IFC model import is unavailable.
- Plain PDF paragraph text is stored but is not automatically converted into BOQ candidates.
- Technical reports are DOCX-only and require confirmed durable production storage.
- Source attribution is partial, not complete field-level end-to-end traceability.
- Voice is controlled, narrow and confirmation-gated; typed multi-change/selective approval is unavailable.
- Google Drive depends on authorization, entitlement and supported files; generic connected apps are not represented as live.
- Live checkout, payment webhook activation and customer billing portal are unavailable.
- SSO, guaranteed accuracy, local rates, tax calculation, regulatory validation and data-residency commitments are not published.

## Claims deliberately NOT published

- Full Source-Linked Traceability — Live
- Project Source Centre — Live
- Voice — Live
- Connected Applications — Live
- OCR extraction from scanned PDFs
- Automatic drawing measurement or automatic takeoff
- Automatic or certified BOQ creation from any source
- Replacement of a quantity surveyor, estimator or responsible professional
- Guaranteed accuracy, savings, delivery time or return on investment
- UAE hosting, UAE data residency, authority approval or regulatory compliance
- Arabic OCR/translation, UAE VAT calculation or verified local rate databases
- SSO, 24/7 support, unlimited projects or unverified enterprise entitlements
- Public self-service prices, Buy Now, Subscribe Now or automatic paid activation
- Ratings, reviews, awards, certifications or professional endorsement
