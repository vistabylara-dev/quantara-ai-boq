import { PUBLIC_CONTENT_REVIEW_DATE, PUBLIC_SITE_ORIGIN } from "@/lib/public-site/search-registry";

const content = `# Quantara AI BOQ

> Quantara is drawing-to-BOQ quantity takeoff software for quantity surveyors, estimators, contractors, consultants and specialist trade teams.

## Core workflow

- Select a supported industry and upload the complete project drawing set.
- Generate a structured, quantity-complete unpriced Bill of Quantities (BOQ).
- Retain calculation evidence and drawing provenance for supported quantities.
- Record assumptions, exclusions, unresolved evidence and confidence instead of silently inventing scope.
- Add commercial rates only when the responsible team is ready to price the BOQ.
- Review, revise, lock and produce BOQ documents, proposals, technical reports, spreadsheets and client previews.

## Supported estimator industries

Construction, interior fit-out, furniture, MEP, electrical, HVAC, plumbing, firefighting, joinery and landscaping.

Facilities Management is not currently a supported autonomous estimator industry.

## Important boundaries

Quantara does not invent market rates. Outputs require review by the responsible construction professional before tender, procurement, contractual or construction use. Results depend on legible, coordinated and supported project evidence; unclear or missing scope is surfaced for resolution.

## Authoritative pages

- Product: ${PUBLIC_SITE_ORIGIN}/
- AI BOQ software: ${PUBLIC_SITE_ORIGIN}/ai-boq-software
- Quantity surveying software: ${PUBLIC_SITE_ORIGIN}/quantity-surveying-software
- Industries: ${PUBLIC_SITE_ORIGIN}/industries
- Features: ${PUBLIC_SITE_ORIGIN}/features
- Pricing: ${PUBLIC_SITE_ORIGIN}/pricing
- Security: ${PUBLIC_SITE_ORIGIN}/security
- Contact: ${PUBLIC_SITE_ORIGIN}/contact-sales
- Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml

Last reviewed: ${PUBLIC_CONTENT_REVIEW_DATE}
`;

export function GET() {
  return new Response(content, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
