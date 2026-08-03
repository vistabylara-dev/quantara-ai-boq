---
name: quantara-ai-image-generation
description: Guide adding AI-generated image capability (e.g. catalogue product placeholder images, proposal/marketing visuals) to quantara-ai-boq. Use this skill whenever the user asks to add AI image generation, generate images, create placeholder photos, or generate visuals anywhere in this SaaS. This is greenfield — no image-generation code exists in the repo yet, and no clear product surface for it has been decided — so this skill's job is as much about scoping the feature honestly as implementing it, consistent with the rest of the codebase's no-fake-data discipline.
---

# Quantara AI BOQ — AI-generated images

## Start by naming the actual surface — don't build this generically
This app has no image-generation code today, and unlike most of the other Phase-tracked features,
there's no spec section for it yet. Before writing code, pin down exactly where a generated image
appears, because the right implementation differs a lot by surface:
- Catalogue product placeholder images (/catalogue — still a LocalStorage-backed module per
  the phase-migration skill) — an image attached to a rate-catalogue item when no real product photo
  exists yet.
- Client proposal / marketing visuals — an illustrative image inside a generated proposal
  document or the marketing/home demo pages.
- Something else — if it's neither of these, get one concrete sentence from the user about
  where in the product a person would actually see the generated image before implementing anything.
Building a generic "image generation service" with no consumer wastes exactly the kind of effort
this whole set of project skills exists to prevent — implement the one real surface, not a
speculative platform for hypothetical future surfaces.

## This is different from the rest of the app's "no fake AI" rule, and that distinction matters
Elsewhere in this codebase (drawing inspection, document classification, verification) the rule is:
never fabricate a result and present it as if it were real extracted/detected data. AI image
generation is the opposite kind of feature — the user is explicitly asking for synthetic content, so
generating it isn't dishonest. The discipline that does carry over: an AI-generated image must
never be visually or contextually confusable with real data the app also handles — a real uploaded
inspection photo (InspectionPhoto, planned but not yet built) or a real product photo. Concretely:
- Store AI-generated images in their own clearly separated storage namespace (e.g.
  ai-generated/..., alongside but distinct from the existing companies/[companyId]/projects/
  [projectId]/{originals,previews,...} convention used for uploaded files) — never write a
  generated image into the same key space as an uploaded original.
- Persist a flag/metadata on whatever record references the image (e.g. imageSource: "AI_GENERATED"
  | "UPLOADED") so the UI and any export/document generator can label it, and so a future audit or
  a client-facing document never presents a synthetic image as a real photograph of the actual site
  or product without a visible indicator.
- If the image ends up in a client-facing document (a proposal, a catalogue sheet), consider whether
  it needs a subtle "illustrative image" label — check with the user for this specific case, since it
  has real credibility implications for their clients if a synthetic image looks like a real product
  photo in a commercial document.

## This costs real money per call — gate it like every other paid feature
Route it through the quantara-entitlements pattern rather than leaving it ungated: define a limit
(e.g. maxAiImagesPerMonth or similar, mirroring maxFinalExports) in entitlement-service.ts,
enforce it server-side before calling the image-generation provider, and never let the client decide
whether the company is within budget — the same reasoning as the entitlements skill's warning about
client-side-only gates being bypassable.

## Provider integration conventions to follow
- Call the image-generation API server-side only (a Next.js API route or server action), never
  expose the provider API key to the client.
- Store the resulting image via the existing DocumentStorageAdapter interface
  (src/lib/storage/document-storage-adapter.ts) rather than building a new storage mechanism — the
  same adapter already used for generated documents and project files.
- Apply the same RBAC pattern as the rest of the app (requireCapability/getCurrentActor() +
  setActorContext(actor) inside the route handler body) and the same apiSuccess/handleApiError
  response shape.
- Log generation events to the audit log (createAuditLog) the same way file uploads and
  classifications are logged — an AI-image-generation call is a billable, auditable action, not a
  free client-side effect.

## Before calling this done
Confirm with the user which surface (catalogue, proposal, marketing, or other) this was actually
built for if it wasn't already explicit, verify the entitlement gate actually denies a company over
its limit, and confirm the image is stored and labeled distinctly from real uploaded photos before
running the standard quality gate (lint, build, test).