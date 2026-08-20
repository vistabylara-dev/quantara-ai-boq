import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  MapPin,
  Scale,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getPublicCapability } from "@/lib/public-site/product-truth";

export const metadata = createPublicPageMetadata("/boq-software-comparison-uae");

const REVIEW_DATE = "20 August 2026";

const vendors = [
  {
    name: "Quantara",
    category: "Review-led BOQ workflow",
    bestFor:
      "UAE and GCC teams that need reviewed source capture, visible calculations, structured BOQ records, reusable internal rate data, client review and professional outputs.",
    inputs: "Text-based PDF table rows, XLSX and CSV; Google Drive is controlled access.",
    boqWorkflow:
      "Reviewed extraction and spreadsheet import, visible calculations, BOQ organization, revisions, validation, client proposal review and document outputs.",
    takeoff: "Automatic drawing takeoff, BIM/IFC import and scanned-PDF OCR are not available.",
    controls:
      "Explicit professional confirmation, distinct BOQ records, private review links and limited source attribution.",
    outputs: "Supported CSV, XLSX, PDF, DOCX and HTML flows vary by workflow.",
    pricing:
      "Published Starter, Professional and Business subscriptions cost AED 149, AED 399 and AED 899 monthly, or AED 1,490, AED 3,990 and AED 8,990 annually. Plan selection continues through account creation to eligible authenticated checkout when the selected price is approved and active and its provider mapping is active and synchronized.",
    uaeNote:
      "English and Arabic interfaces with RTL are available; Arabic OCR, automatic translation and Arabic source parsing are not included. Checkout requires an authenticated eligible account, an approved active price and an active synchronized provider mapping.",
    sourceUrl: "/features",
    sourceLabel: "Quantara capability register",
  },
  {
    name: "RIB CostX",
    category: "QS, BIM takeoff and cost planning",
    bestFor:
      "Quantity surveyors, cost consultants and BIM-led estimating teams that need live links between drawings, quantities, rates and reports.",
    inputs: "Scans, PDF, CAD and supported BIM formats.",
    boqWorkflow: "Fully costed BOQs and estimating workbooks live-linked to drawings and cost data.",
    takeoff: "Officially documents 2D and 3D/BIM takeoff plus auto-revisioning.",
    controls: "Collaborative project work, design-change history and estimate audit trail.",
    outputs: "Standard and custom reports, viewer packages and integration options.",
    pricing: "Quote/contact required through RIB's published pricing enquiry.",
    uaeNote: "RIB publishes a Dubai office; confirm edition, support scope, currency and hosting terms.",
    sourceUrl: "https://www.rib-software.com/en/rib-costx",
    sourceLabel: "Official RIB CostX product page",
  },
  {
    name: "RIB Candy",
    category: "Contractor estimating and project control",
    bestFor:
      "Contractors that want BOQ, first-principles estimating, programme, forecasting and post-tender control in a connected workflow.",
    inputs: "2D drawing takeoff and BOQ/estimate data within Candy workflows.",
    boqWorkflow: "Links BOQ, estimate and programme through tender and project-control stages.",
    takeoff: "Officially documents on-screen quantity takeoff from 2D drawings.",
    controls: "Calculation provenance and project-control reporting are documented.",
    outputs: "Standard and custom reports; confirm required spreadsheet interchange in the selected edition.",
    pricing: "Quote/contact required for single-user, multi-user or Candy Cloud options.",
    uaeNote: "RIB publishes a Dubai office; confirm local implementation and commercial terms.",
    sourceUrl: "https://www.rib-software.com/en/rib-candy",
    sourceLabel: "Official RIB Candy product page",
  },
  {
    name: "Procore Estimating",
    category: "Enterprise preconstruction platform",
    bestFor:
      "Main contractors and larger teams that want takeoff, estimates, proposals and handoff into a wider construction platform.",
    inputs: "2D plans and supported 3D model workflows.",
    boqWorkflow: "Takeoff data flows into estimates, proposals, budgets, contracts and project financial workflows.",
    takeoff: "Official help documents auto-count, automated area takeoff and 3D model takeoff.",
    controls: "Role-based permissions, layer locking and broad project collaboration.",
    outputs: "Excel, Budget Template and PDF estimate exports are documented.",
    pricing: "Quote/contact required. Procore documents an upfront annual fee by product based on Annual Turnover.",
    uaeNote: "Procore publishes UAE product, pricing and contact pages; confirm the selected products and implementation scope.",
    sourceUrl: "https://www.procore.com/en-ae/preconstruction",
    sourceLabel: "Official Procore UAE preconstruction page",
  },
  {
    name: "Autodesk Forma Takeoff",
    category: "Cloud 2D and 3D quantification",
    bestFor:
      "BIM-centric teams that need combined sheet- and model-based takeoff with cloud document management.",
    inputs: "2D sheets and supported 3D models within Autodesk Forma workflows.",
    boqWorkflow: "Quantity inventory and conceptual cost support; deeper estimating may require another Forma product or bundle.",
    takeoff: "Officially documents 2D/3D takeoff and symbol detection; symbol detection does not detect text.",
    controls: "Cloud roles, document versions, package workflows and takeoff snapshots.",
    outputs: "XLSX inventory exports and XLSX/PDF takeoff reports.",
    pricing: "Public numeric pricing is not relied on here; per-user and unlimited-user options are documented. Confirm the UAE quote.",
    uaeNote: "Metric workflows are documented; confirm UAE contracting, AED, Arabic and data-region requirements.",
    sourceUrl: "https://construction.autodesk.com/tools/construction-takeoff-software/",
    sourceLabel: "Official Autodesk Forma Takeoff page",
  },
  {
    name: "STACK",
    category: "Cloud takeoff and estimating",
    bestFor:
      "General and specialty contractors that want cloud plan management, takeoff, estimates, proposals and item assemblies.",
    inputs: "Digital plans, specifications and project documents supported by STACK workflows.",
    boqWorkflow: "Integrated takeoff, estimate, proposal, items, assemblies and bill-of-materials workflow.",
    takeoff: "Officially documents OCR plan search and trade-specific AI-assisted takeoff features.",
    controls: "Roles and a takeoff audit trail; the documented in-product audit history is limited to 30 days.",
    outputs: "PDF and spreadsheet reporting plus CSV audit-trail export, subject to permissions.",
    pricing: "Public numeric pricing is published in USD. Confirm current per-user annual-billing terms, onboarding and AI add-ons.",
    uaeNote: "Confirm metric, regional cost data, local support, tax, currency and hosting requirements directly.",
    sourceUrl: "https://www.stackct.com/takeoff-and-estimating/",
    sourceLabel: "Official STACK product page",
  },
  {
    name: "PlanSwift",
    category: "Desktop takeoff and estimating",
    bestFor:
      "Individual and trade estimators that prefer a desktop plan takeoff workflow with assemblies and spreadsheet export.",
    inputs: "Construction plan sets handled inside the PlanSwift desktop workflow.",
    boqWorkflow: "Takeoff, estimating, material and labour assemblies, cost calculations and printable estimates.",
    takeoff: "Takeoff Boost documents Auto Takeoff, Auto Count, Auto Scale and Auto Bookmark tools.",
    controls: "Current official pages emphasize estimator review; verify team audit and collaboration requirements before purchase.",
    outputs: "Excel export, print and estimate output are documented.",
    pricing: "Public numeric pricing is published. Confirm the current annual amount and renewal terms at checkout.",
    uaeNote: "No UAE-specific positioning is relied on here; confirm metric, AED, Arabic, support and tax handling.",
    sourceUrl: "https://www.planswift.com/",
    sourceLabel: "Official PlanSwift product page",
  },
] as const;

const eligibilityCriteria = [
  {
    title: "Workflow overlap",
    description: "The product must directly support BOQ, takeoff or construction estimating work.",
    icon: Scale,
  },
  {
    title: "Official evidence",
    description: "Every factual capability statement needs an official source; buyer-fit and UAE notes are identified editorial assessments.",
    icon: SearchCheck,
  },
  {
    title: "Edition clarity",
    description: "Add-ons, bundles, beta tools and edition limits stay visible instead of being counted as standard.",
    icon: ShieldCheck,
  },
  {
    title: "UAE verification",
    description: "Metric units, AED, Arabic, VAT, support and data location are checked separately.",
    icon: MapPin,
  },
] as const;

const decisionPaths = [
  {
    need: "Reviewed BOQ workflow from eligible text PDFs or spreadsheets",
    direction: "Assess Quantara, confirm the supported source formats, then compare the published Starter, Professional and Business plans.",
  },
  {
    need: "2D, 3D or BIM quantity takeoff from drawings and models",
    direction: "Assess CostX, Procore Estimating or Autodesk Forma Takeoff by model format and estimate depth.",
  },
  {
    need: "Contractor BOQ, estimate, programme and project control continuity",
    direction: "Assess RIB Candy and confirm the modules required for tender and post-tender control.",
  },
  {
    need: "Cloud takeoff, estimates and proposals for trade teams",
    direction: "Assess STACK or Procore by collaboration, audit history, integrations and commercial model.",
  },
  {
    need: "Desktop AI-assisted plan takeoff",
    direction: "Assess PlanSwift and verify operating system, team sharing, audit and regional requirements.",
  },
  {
    need: "Arabic, AED, UAE VAT or regional data residency",
    direction: "Treat each item as a contractual verification question; no general UAE-ready badge is sufficient.",
  },
] as const;

const quantaraEligibility = [
  {
    requirement: "Reviewed CSV/XLSX intake",
    status: "Suitable",
    capability: getPublicCapability("spreadsheet-import"),
  },
  {
    requirement: "Internal supplier and rate catalogue",
    status: "Suitable with conditions",
    capability: getPublicCapability("internal-supplier-rate-catalogue"),
  },
  {
    requirement: "Reusable company BOQ items",
    status: "Suitable with conditions",
    capability: getPublicCapability("company-library"),
  },
  {
    requirement: "Private client proposal review",
    status: "Suitable with conditions",
    capability: getPublicCapability("client-proposals"),
  },
  {
    requirement: "Arabic and RTL authenticated workflow",
    status: "Suitable with conditions",
    capability: getPublicCapability("bilingual-rtl-interface"),
  },
  {
    requirement: "Published SaaS plans and authenticated checkout",
    status: "Suitable with conditions",
    capability: getPublicCapability("commercial-access"),
  },
  {
    requirement: "Automatic drawing takeoff",
    status: "Not suitable today",
    capability: getPublicCapability("automatic-drawing-takeoff"),
  },
  {
    requirement: "Scanned-PDF OCR",
    status: "Not suitable today",
    capability: getPublicCapability("scanned-pdf-ocr"),
  },
  {
    requirement: "CAD, BIM or IFC quantity extraction",
    status: "Not suitable today",
    capability: getPublicCapability("model-file-import"),
  },
] as const;

const eligibilityStatusStyle = {
  Suitable: "border-emerald-700/70 bg-emerald-950/40 text-emerald-200",
  "Suitable with conditions": "border-amber-700/70 bg-amber-950/30 text-amber-100",
  "Not suitable today": "border-rose-800/70 bg-rose-950/30 text-rose-100",
} as const;

const supportingSources = [
  {
    label: "RIB global offices and Dubai contact",
    url: "https://www.rib-software.com/en/contact-us",
  },
  {
    label: "Procore UAE pricing method",
    url: "https://www.procore.com/en-ae/pricing",
  },
  {
    label: "Procore estimate export options",
    url: "https://support.procore.com/products/online/user-guide/project-level/estimating/tutorials/export-an-estimate",
  },
  {
    label: "Procore estimating and automated takeoff features",
    url: "https://support.procore.com/products/online/user-guide/project-level/estimating",
  },
  {
    label: "Procore estimating permissions and layer locking",
    url: "https://support.procore.com/products/online/user-guide/project-level/estimating/permissions",
  },
  {
    label: "Autodesk symbol detection boundary",
    url: "https://help.autodesk.com/cloudhelp/ENU/Takeoff-Takeoff/files/Symbol_Detect.html",
  },
  {
    label: "Autodesk takeoff inventory exports",
    url: "https://help.autodesk.com/cloudhelp/ENU/Takeoff-Takeoff/files/Inventory.html",
  },
  {
    label: "Autodesk Takeoff member roles",
    url: "https://help.autodesk.com/view/TAKEOFF/ENU/?guid=Manage_Project_Members&p=DOCS",
  },
  {
    label: "Autodesk sheet and model versioning",
    url: "https://help.autodesk.com/cloudhelp/ENU/Takeoff-Files/files/Version_in_Sheets_Models.html",
  },
  {
    label: "Autodesk Takeoff pricing options",
    url: "https://construction.autodesk.com/pricing/autodesk-takeoff/",
  },
  {
    label: "STACK takeoff audit-trail retention",
    url: "https://support.stackct.com/hc/en-us/articles/50321698961427-Audit-Trail-for-Takeoff",
  },
  {
    label: "STACK report and export permissions",
    url: "https://support.stackct.com/hc/en-us/articles/50108996313491-Takeoff-Estimate-Reports-Permissions",
  },
  {
    label: "RIB Candy reporting brochure",
    url: "https://www.rib-software.com/pdf/en/rib-candy-brochure.pdf",
  },
  {
    label: "RIB Candy pricing options",
    url: "https://www.rib-software.com/en/rib-candy/pricing",
  },
  {
    label: "STACK current pricing",
    url: "https://www.stackct.com/takeoff-and-estimate-pricing/",
  },
  {
    label: "PlanSwift current checkout",
    url: "https://www.planswift.com/checkout/",
  },
] as const;

const faqs = [
  {
    question: "What is the best BOQ software for UAE construction teams?",
    answer:
      "There is no universal best BOQ platform. The right choice depends on source formats, takeoff needs, BOQ depth, review controls, outputs, integrations and verified UAE commercial requirements.",
  },
  {
    question: "Is Quantara an alternative to CostX or Autodesk Forma Takeoff?",
    answer:
      "Quantara overlaps with reviewed BOQ organization and output workflows, but it is not a replacement for automatic drawing, 3D or BIM takeoff. Teams that need geometry-based measurement should assess a documented takeoff platform.",
  },
  {
    question: "Does Quantara automatically measure drawings or perform OCR?",
    answer:
      "No. Quantara does not currently claim automatic drawing measurement, BIM/IFC quantity extraction or OCR text extraction from scanned PDFs.",
  },
  {
    question: "Which compared products document 3D or BIM takeoff?",
    answer:
      "RIB CostX, Procore Estimating and Autodesk Forma Takeoff document 3D or BIM/model takeoff workflows. Buyers should confirm supported file formats, editions and regional availability with each vendor.",
  },
  {
    question: "Can public pricing alone decide software eligibility?",
    answer:
      "No. Seat model, turnover-based pricing, add-ons, implementation, support, storage and regional tax terms can materially change the total commercial fit.",
  },
  {
    question: "What does ‘not publicly documented’ mean in this comparison?",
    answer:
      "It means the reviewed official sources did not confirm the capability. It does not mean the vendor cannot provide it through another edition, contract or newer release.",
  },
  {
    question: "How current is this BOQ software comparison?",
    answer:
      `The evidence was reviewed on ${REVIEW_DATE}. Product features and commercial terms change, so buyers should recheck the linked official sources before procurement.`,
  },
] as const;

const searchEntry = getPublicSearchPage("/boq-software-comparison-uae");
const baseSchema = buildPublicPageGraph({
  path: "/boq-software-comparison-uae",
  title: searchEntry.title,
  description: searchEntry.description,
  breadcrumbs: [
    { name: "Home", path: "/" },
    { name: "Comparisons", path: "/comparisons" },
    { name: "BOQ Software Comparison UAE", path: "/boq-software-comparison-uae" },
  ],
  faqs,
  kind: "tech-article",
  dateModified: "2026-08-20",
});

const pageSchema = {
  ...baseSchema,
  "@graph": [
    ...((baseSchema["@graph"] as readonly Record<string, unknown>[]) ?? []),
    {
      "@type": "ItemList",
      "@id": "https://quantara.vistabylara.com/boq-software-comparison-uae#software-list",
      name: "BOQ and construction estimating software reviewed for UAE teams",
      numberOfItems: vendors.length,
      itemListElement: vendors.map((vendor, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "SoftwareApplication",
          name: vendor.name,
          applicationCategory: "BusinessApplication",
          url: vendor.sourceUrl.startsWith("/")
            ? `https://quantara.vistabylara.com${vendor.sourceUrl}`
            : vendor.sourceUrl,
        },
      })),
    },
  ],
};

export default function BoqSoftwareComparisonUaePage() {
  return (
    <div className="min-h-screen bg-[#030508] text-slate-100">
      <PublicJsonLd data={pageSchema} />

      <section className="border-b border-slate-800/80 bg-[radial-gradient(circle_at_top,#0d2450_0%,#030508_62%)] px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <PublicBreadcrumb
            tone="dark"
            items={[
              { name: "Home", item: "/" },
              { name: "Comparisons", item: "/comparisons" },
              { name: "BOQ Software Comparison UAE" },
            ]}
          />
          <div className="mt-10 max-w-4xl">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
              Evidence-led buyer guide · Reviewed {REVIEW_DATE}
            </p>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Construction Estimating &amp; BOQ Software Comparison for UAE Teams
            </h1>
            <p className="max-w-3xl text-xl leading-relaxed text-slate-300">
              Construction estimating platforms solve different parts of the workflow. This guide compares officially documented capabilities across inputs, BOQ preparation, takeoff automation, review controls, exports and UAE applicability. It does not declare one universal winner.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#comparison-matrix"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-6 font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Compare the software <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                href="/features"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/70 px-6 font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                Verify Quantara features
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <section aria-labelledby="eligibility-method-heading" className="mb-20">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-300">Eligibility method</p>
            <h2 id="eligibility-method-heading" className="mb-4 text-3xl font-bold text-white">
              How Software Qualifies for This Comparison
            </h2>
            <p className="leading-relaxed text-slate-400">
              A product is included only when its current official documentation supports a direct BOQ, takeoff or construction-estimating use case. Features are not inferred from branding, search snippets, roadmaps or third-party review sites.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {eligibilityCriteria.map((criterion) => {
              const Icon = criterion.icon;
              return (
                <article key={criterion.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <Icon className="mb-5 h-6 w-6 text-cyan-300" aria-hidden="true" />
                  <h3 className="mb-2 font-bold text-white">{criterion.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{criterion.description}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-6 rounded-xl border border-blue-800/60 bg-blue-950/30 p-5 text-sm leading-relaxed text-blue-100">
            <strong>Interpretation method:</strong> Restrictions, bundles and add-ons stay in the relevant row instead of being converted into a winner score. “Not publicly documented” means no conclusion is made from the reviewed official sources.
          </div>
        </section>

        <section aria-labelledby="decision-guide-heading" className="mb-20">
          <div className="mb-8 max-w-3xl">
            <h2 id="decision-guide-heading" className="mb-4 text-3xl font-bold text-white">Fast Eligibility Guide</h2>
            <p className="leading-relaxed text-slate-400">
              Start with the work that must be completed, then validate formats, controls, outputs and regional contract terms.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <div className="hidden grid-cols-[0.9fr_1.4fr] bg-slate-900 px-6 py-4 text-sm font-bold text-slate-200 md:grid">
              <div>Required outcome</div>
              <div>Evidence-led direction</div>
            </div>
            <div className="divide-y divide-slate-800">
              {decisionPaths.map((path) => (
                <div key={path.need} className="grid gap-3 bg-slate-950/60 p-6 md:grid-cols-[0.9fr_1.4fr]">
                  <h3 className="font-semibold text-white">{path.need}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{path.direction}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="comparison-matrix" aria-labelledby="comparison-heading" className="scroll-mt-24 mb-20">
          <div className="mb-10 max-w-4xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-300">Seven-product evidence matrix</p>
            <h2 id="comparison-heading" className="mb-4 text-3xl font-bold text-white">
              BOQ and Construction Estimating Software Compared
            </h2>
            <p className="leading-relaxed text-slate-400">
              Each row summarizes the workflow documented by the vendor. It does not imply feature parity, certification, procurement approval or affiliation with Quantara.
            </p>
          </div>

          <div className="space-y-6 lg:hidden">
            {vendors.map((vendor) => (
              <article key={vendor.name} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <div className="mb-5 flex flex-col gap-2">
                  <h3 className="text-xl font-bold text-white">{vendor.name}</h3>
                  <p className="text-sm font-semibold text-cyan-300">{vendor.category}</p>
                </div>
                <dl className="space-y-4 text-sm">
                  {[
                    ["Best fit", vendor.bestFor],
                    ["Inputs", vendor.inputs],
                    ["BOQ / estimate workflow", vendor.boqWorkflow],
                    ["Takeoff", vendor.takeoff],
                    ["Controls", vendor.controls],
                    ["Outputs", vendor.outputs],
                    ["Pricing transparency", vendor.pricing],
                    ["UAE check", vendor.uaeNote],
                  ].map(([term, detail]) => (
                    <div key={term}>
                      <dt className="mb-1 font-bold text-slate-200">{term}</dt>
                      <dd className="leading-relaxed text-slate-400">{detail}</dd>
                    </div>
                  ))}
                </dl>
                {vendor.sourceUrl.startsWith("/") ? (
                  <Link href={vendor.sourceUrl} className="mt-6 inline-flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200">
                    {vendor.sourceLabel} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <a href={vendor.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200">
                    {vendor.sourceLabel}<span className="sr-only"> (opens in a new tab)</span> <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </article>
            ))}
          </div>

          <div
            role="region"
            aria-label="Scrollable product comparison table"
            tabIndex={0}
            className="hidden overflow-x-auto rounded-2xl border border-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:block"
          >
            <table className="min-w-[1500px] border-collapse text-left text-sm">
              <caption className="sr-only">Comparison of Quantara, RIB CostX, RIB Candy, Procore Estimating, Autodesk Forma Takeoff, STACK and PlanSwift</caption>
              <thead className="bg-slate-900 text-slate-200">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-44 border-r border-slate-800 bg-slate-900 px-5 py-4">Product</th>
                  <th scope="col" className="w-56 px-5 py-4">Best fit</th>
                  <th scope="col" className="w-48 px-5 py-4">Inputs</th>
                  <th scope="col" className="w-60 px-5 py-4">BOQ / estimate workflow</th>
                  <th scope="col" className="w-56 px-5 py-4">Takeoff</th>
                  <th scope="col" className="w-52 px-5 py-4">Controls</th>
                  <th scope="col" className="w-48 px-5 py-4">Outputs</th>
                  <th scope="col" className="w-56 px-5 py-4">Pricing transparency</th>
                  <th scope="col" className="w-56 px-5 py-4">UAE check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/70">
                {vendors.map((vendor) => (
                  <tr key={vendor.name} className="align-top hover:bg-slate-900/60">
                    <th scope="row" className="sticky left-0 z-10 border-r border-slate-800 bg-slate-950 px-5 py-5">
                      <span className="block font-bold text-white">{vendor.name}</span>
                      <span className="mt-2 block text-xs font-medium text-cyan-300">{vendor.category}</span>
                      {vendor.sourceUrl.startsWith("/") ? (
                        <Link href={vendor.sourceUrl} className="mt-3 inline-flex items-center text-xs font-semibold text-blue-300 hover:text-blue-200">
                          Quantara capability register <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : (
                        <a href={vendor.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center text-xs font-semibold text-blue-300 hover:text-blue-200">
                          Official source<span className="sr-only"> for {vendor.name} (opens in a new tab)</span> <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
                        </a>
                      )}
                    </th>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.bestFor}</td>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.inputs}</td>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.boqWorkflow}</td>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.takeoff}</td>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.controls}</td>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.outputs}</td>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.pricing}</td>
                    <td className="px-5 py-5 leading-relaxed text-slate-400">{vendor.uaeNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="quantara-boundary-heading" className="mb-20 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
            <h2 id="quantara-boundary-heading" className="mb-5 text-3xl font-bold text-white">Quantara Eligibility Boundary</h2>
            <p className="mb-6 leading-relaxed text-slate-400">
              Quantara is eligible when the required outcome is a governed, review-led BOQ workflow. It is not eligible when automatic drawing takeoff, BIM/IFC quantity extraction or scanned-PDF OCR is mandatory.
            </p>
            <ul className="space-y-4">
              {[
                "Use supported text-based PDF tables, XLSX or CSV as review inputs.",
                "Keep calculation inputs and proposed results visible before confirmation.",
                "Organize BOQ sections, items, quantities, units, revisions and supported outputs.",
                "Retain a responsible construction professional for review and approval.",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-amber-800/70 bg-amber-950/20 p-8">
            <AlertTriangle className="mb-5 h-7 w-7 text-amber-300" aria-hidden="true" />
            <h2 className="mb-5 text-2xl font-bold text-amber-100">Do not shortlist Quantara for</h2>
            <ul className="space-y-4 text-sm leading-relaxed text-amber-100/80">
              <li>Automatic 2D drawing measurement or quantity takeoff.</li>
              <li>3D, CAD, BIM or IFC model-based quantity extraction.</li>
              <li>OCR extraction from scanned or image-only PDF pages.</li>
              <li>A guaranteed local cost database, authority approval or professional certification.</li>
              <li>Anonymous or unauthenticated checkout without account verification.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="quantara-eligibility-heading" className="mb-20">
          <div className="mb-8 max-w-4xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-blue-300">Source-and-test-reviewed capability map</p>
            <h2 id="quantara-eligibility-heading" className="mb-4 text-3xl font-bold text-white">
              Is Quantara Eligible for Your Required Workflow?
            </h2>
            <p className="leading-relaxed text-slate-400">
              These statuses describe fit against a requirement, not production deployment. Provider configuration, entitlements and data still require confirmation. Published plan checkout requires an authenticated eligible account, an approved active price and an active synchronized provider mapping; anonymous or unauthenticated checkout is not offered.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <div className="hidden grid-cols-[0.75fr_0.42fr_1.3fr] bg-slate-900 px-6 py-4 text-sm font-bold text-slate-200 md:grid">
              <div>Requirement</div>
              <div>Eligibility</div>
              <div>Evidence and boundary</div>
            </div>
            <div className="divide-y divide-slate-800">
              {quantaraEligibility.map((item) => (
                <article key={item.requirement} className="grid gap-4 bg-slate-950/70 p-6 md:grid-cols-[0.75fr_0.42fr_1.3fr] md:items-start">
                  <h3 className="font-bold text-white">{item.requirement}</h3>
                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${eligibilityStatusStyle[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed text-slate-400">
                    <p>{item.capability.summary}</p>
                    {item.capability.limitation ? (
                      <p className="mt-2"><strong className="text-slate-300">Boundary:</strong> {item.capability.limitation}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <Link href="/features" className="mt-6 inline-flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200">
            Read every Quantara capability status and dependency <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="uae-checklist-heading" className="mb-20">
          <div className="mb-8 max-w-3xl">
            <h2 id="uae-checklist-heading" className="mb-4 text-3xl font-bold text-white">UAE Procurement Questions to Verify</h2>
            <p className="leading-relaxed text-slate-400">
              “Available in the UAE” is not one capability. Record each answer in the commercial proposal and implementation scope.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Measurement", "Are metric units and company-specific rounding rules supported?"],
              ["Currency and tax", "Can estimates and documents handle AED and the required UAE VAT workflow?"],
              ["Language", "Are Arabic content, RTL interfaces and bilingual outputs required and contractually supported?"],
              ["Data", "Where are files, backups, logs and subprocessors located?"],
              ["Support", "Is implementation and support available in UAE business hours?"],
              ["Commercial control", "Which edition, add-ons, seats, turnover limits and renewal terms are included?"],
            ].map(([title, description]) => (
              <article key={title} className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
                <h3 className="mb-2 font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{description}</p>
              </article>
            ))}
          </div>
          <aside className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm leading-relaxed text-slate-400">
            <h3 className="mb-2 font-bold text-white">Arabic terminology note</h3>
            <p>
              UAE buyers may search for <span lang="ar" dir="rtl" className="font-semibold text-slate-200">برنامج جداول الكميات</span> or <span lang="ar" dir="rtl" className="font-semibold text-slate-200">برنامج حصر الكميات</span>. These terms do not by themselves confirm Arabic interfaces, RTL outputs, Arabic OCR or source-language parsing; verify each requirement separately.
            </p>
          </aside>
        </section>

        <section aria-labelledby="faq-heading" className="mb-20">
          <div className="mb-8 max-w-3xl">
            <h2 id="faq-heading" className="mb-4 text-3xl font-bold text-white">BOQ Software Comparison FAQs</h2>
            <p className="leading-relaxed text-slate-400">Direct answers for UAE estimators, quantity surveyors, consultants and contractors.</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-xl border border-slate-800 bg-slate-950/70 p-5 open:border-blue-800">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-white marker:hidden">
                  {faq.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-4 max-w-4xl leading-relaxed text-slate-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="sources-heading" className="mb-20 rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
          <h2 id="sources-heading" className="mb-4 text-2xl font-bold text-white">Sources, Review Date and Trademark Notice</h2>
          <p className="mb-6 max-w-4xl text-sm leading-relaxed text-slate-400">
            Reviewed {REVIEW_DATE}. This comparison uses public vendor documentation and the Quantara capability register. Features, editions, add-ons, regional availability and prices may change. “Not publicly documented” does not mean unavailable. Product names and trademarks belong to their owners. Quantara is not affiliated with the listed vendors unless expressly stated.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((vendor) => (
              <li key={vendor.name}>
                {vendor.sourceUrl.startsWith("/") ? (
                  <Link href={vendor.sourceUrl} className="inline-flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200">
                    {vendor.sourceLabel} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <a href={vendor.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200">
                    {vendor.sourceLabel}<span className="sr-only"> (opens in a new tab)</span> <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <h3 className="mb-4 mt-8 text-lg font-bold text-white">Supporting official documentation</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {supportingSources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200">
                  {source.label}<span className="sr-only"> (opens in a new tab)</span> <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-blue-700/60 bg-gradient-to-br from-blue-700 to-blue-900 px-6 py-12 text-center text-white md:px-12">
          <h2 className="mb-4 text-3xl font-bold">Check Quantara Against Your UAE BOQ Requirements</h2>
          <p className="mx-auto mb-8 max-w-3xl leading-relaxed text-blue-100">
            Compare your source formats, takeoff expectations, review controls, output needs and language requirements. Then choose a published plan, create an account and continue to eligible authenticated checkout when its approved price is active and synchronized.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-6 font-semibold text-blue-800 hover:bg-blue-50">
              View published pricing <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="https://wa.me/971507994292" className="inline-flex h-12 items-center justify-center rounded-lg border border-blue-300 px-6 font-semibold text-white hover:bg-blue-800">
              Discuss on WhatsApp
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
