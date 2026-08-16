import type { Metadata, MetadataRoute } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const PUBLIC_SITE_ORIGIN = "https://quantara.vistabylara.com";
export const PUBLIC_CONTENT_REVIEW_DATE = "2026-08-16";

export type PublicTopicCluster =
  | "core"
  | "pdf-extraction"
  | "measurement"
  | "audience"
  | "regional"
  | "education"
  | "comparison"
  | "company"
  | "legal";

export type PublicSearchPage = {
  path: `/${string}` | "/";
  title: string;
  description: string;
  cluster: PublicTopicCluster;
  intent: "commercial" | "informational" | "navigational";
  indexable?: boolean;
  priority?: number;
  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];
};

function page(entry: PublicSearchPage): PublicSearchPage {
  return entry;
}

const metadataCopy = getDictionary("en").publicContent.metadata;

export const PUBLIC_SEARCH_PAGES = [
  page({ path: "/", title: "BOQ Measurement & Quantity Software UAE | Quantara", description: "Guided BOQ measurement for reviewed sources, deterministic quantity calculations, visible formulas, voice-assisted input and professional confirmation.", cluster: "core", intent: "commercial", priority: 1, changeFrequency: "weekly" }),
  page({ path: "/features", title: "Quantara BOQ Features for Construction Teams", description: "Explore Quantara project sources, AI Draft BOQ, guided measurement, calculations, TAYQAN, integrations, revisions and professional outputs.", cluster: "core", intent: "commercial", priority: 0.95, changeFrequency: "weekly" }),
  page({ path: "/products", title: "Quantara Products & Digital Construction Tools", description: "Explore published Quantara products, subscriptions, digital construction tools and professional offers.", cluster: "core", intent: "commercial", priority: 0.9, changeFrequency: "weekly" }),
  page({ path: "/about", title: "About Quantara BOQ Workflow Software", description: "Learn what Quantara is, who it supports and how Vista By Lara is developing an AI-assisted BOQ workflow for construction professionals.", cluster: "company", intent: "navigational" }),
  page({ path: "/security", title: metadataCopy.securityTitle, description: metadataCopy.securityDescription, cluster: "company", intent: "informational" }),
  page({ path: "/terms", title: metadataCopy.termsTitle, description: metadataCopy.termsDescription, cluster: "legal", intent: "navigational", priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/privacy", title: metadataCopy.privacyTitle, description: metadataCopy.privacyDescription, cluster: "legal", intent: "navigational", priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/data-processing", title: metadataCopy.dataProcessingTitle, description: metadataCopy.dataProcessingDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/cookie-policy", title: metadataCopy.cookiePolicyTitle, description: metadataCopy.cookiePolicyDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/acceptable-use", title: metadataCopy.acceptableUseTitle, description: metadataCopy.acceptableUseDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/subprocessors", title: metadataCopy.subprocessorsTitle, description: metadataCopy.subprocessorsDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/contact-sales", title: metadataCopy.contactSalesTitle, description: metadataCopy.contactSalesDescription, cluster: "company", intent: "commercial" }),
  page({ path: "/ai-boq-software", title: "AI BOQ Measurement & Quantity Software | Quantara", description: "Use guided measurement, deterministic quantity calculations, voice-assisted BOQ input and supported Autodesk DWG analysis in a review-led workflow.", cluster: "core", intent: "commercial" }),
  page({ path: "/boq-software", title: "BOQ Software for Construction Teams | Quantara", description: "Explore structured BOQ software for project sources, reviewed information, dimensions, calculations, revisions, validation and outputs.", cluster: "core", intent: "commercial" }),
  page({ path: "/construction-estimating-software", title: "Construction Estimating and BOQ Software | Quantara", description: "Understand how Quantara supports BOQ organization and reviewed estimating inputs while leaving rates, risk and professional decisions to the team.", cluster: "core", intent: "commercial" }),
  page({ path: "/boq-management", title: "BOQ Management Software for Projects | Quantara", description: "Organize BOQ sections, items, quantities, revisions and supported outputs inside controlled project workflows with professional review.", cluster: "core", intent: "commercial" }),
  page({ path: "/pdf-boq-extraction", title: "PDF BOQ Extraction for Text-Based Files | Quantara", description: "See how Quantara captures supported information from text-based PDF BOQs for review, plus the limits for complex and scanned files.", cluster: "pdf-extraction", intent: "commercial" }),
  page({ path: "/scanned-pdf-boq", title: "Scanned PDF BOQ Detection and OCR Status | Quantara", description: "Quantara detects image-only PDF pages but does not currently perform OCR text extraction. Learn the manual review path and limitations.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/quantity-surveying-software", title: "Quantity Surveying BOQ Workflow Software | Quantara", description: "Support reviewed BOQ records, dimensions, visible calculations, revisions and outputs without replacing a quantity surveyor's judgement.", cluster: "audience", intent: "commercial" }),
  page({ path: "/tayqan-ai-quantity-surveyor", title: "TAYQAN AI Quantity Surveyor for BOQ Work | Quantara", description: "Hire TAYQAN, Quantara's governed Digital QS, for source review, quantity preparation, BOQ assembly and QA with final human acceptance.", cluster: "audience", intent: "commercial", priority: 0.95, changeFrequency: "weekly" }),
  page({ path: "/boq-integrations", title: "BOQ Integrations for Construction Software | Quantara", description: "Explore Quantara integration pages for BIM, CAD, CDE, cloud storage, estimating, structural engineering and construction management tools.", cluster: "core", intent: "commercial", priority: 0.9, changeFrequency: "weekly" }),
  page({ path: "/boq-document-generation", title: "BOQ Document Generation from Reviewed Data | Quantara", description: "Generate supported BOQ documents and project outputs from reviewed records while keeping professional approval outside the software.", cluster: "core", intent: "commercial" }),
  page({ path: "/resources", title: "BOQ Resources and Construction Workflow Guides", description: "Explore practical BOQ definitions, document-extraction guidance, review checklists, measurement formulas and workflow comparisons.", cluster: "education", intent: "informational" }),
  page({ path: "/what-is-a-boq", title: "What Is a BOQ? Bill of Quantities Explained", description: "Learn what a Bill of Quantities contains, who prepares and reviews it, and how it supports tendering, pricing and project control.", cluster: "education", intent: "informational" }),
  page({ path: "/boq-vs-construction-estimate", title: "BOQ vs Construction Estimate: Key Differences", description: "Compare a Bill of Quantities with a construction estimate across scope, quantities, rates, assumptions and project use.", cluster: "education", intent: "informational" }),
  page({ path: "/boq-vs-bill-of-materials", title: "BOQ vs Bill of Materials: Key Differences", description: "Compare a Bill of Quantities with a Bill of Materials across purpose, structure, quantities, labour and construction use.", cluster: "education", intent: "informational" }),
  page({ path: "/how-to-prepare-a-boq", title: "How to Prepare a BOQ: Professional Workflow Guide", description: "Follow a practical BOQ preparation workflow covering source review, scope, item structure, measurement, rates, checking and issue control.", cluster: "education", intent: "informational" }),
  page({ path: "/boq-review-checklist", title: "BOQ Review Checklist for Construction Teams", description: "Use a practical checklist to review BOQ scope, descriptions, quantities, units, rates, assumptions, exclusions and revisions.", cluster: "education", intent: "informational" }),
  page({ path: "/common-boq-errors", title: "Common BOQ Errors and Professional Review Steps", description: "Learn how to identify common BOQ omissions, duplicates, unit errors, quantity issues, weak descriptions and revision conflicts.", cluster: "education", intent: "informational" }),
  page({ path: "/boq-revision-control", title: "BOQ Revision Control and Version Management", description: "Learn how clear BOQ versions, change records, review decisions and issue status support controlled construction workflows.", cluster: "education", intent: "informational" }),
  page({ path: "/how-to-convert-pdf-boq-to-excel", title: "How to Convert a PDF BOQ to Excel Safely", description: "Review a practical PDF-to-Excel BOQ workflow covering selectable text, scanned pages, tables, merged cells, quantities and verification.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/text-pdf-vs-scanned-pdf", title: "Text PDF vs Scanned PDF for BOQ Extraction", description: "Understand how selectable-text and image-only PDFs affect BOQ extraction, OCR requirements, error risk and professional review.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/ocr-for-boq-documents", title: "OCR for BOQ Documents: Uses and Limitations", description: "Learn what OCR does for scanned BOQ files, where recognition errors occur and why Quantara's current workflow does not include OCR extraction.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/how-to-review-ai-extracted-boq", title: "How to Review AI-Extracted BOQ Information", description: "Follow a structured review of AI-assisted BOQ extraction covering sources, descriptions, units, quantities, exceptions and approval boundaries.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/quantity-takeoff-vs-boq-management", title: "Quantity Takeoff vs BOQ Management", description: "Compare drawing measurement and quantity takeoff with BOQ organization, revision control, validation and document workflows.", cluster: "measurement", intent: "informational" }),
  page({ path: "/industries", title: "BOQ Workflow Software by Construction Industry", description: "Explore truthful BOQ workflow use cases and limitations for contractors, quantity surveyors, MEP, HVAC, fit-out, FM and consultants.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-contractors", title: "BOQ Software for Contractors | Quantara", description: "Support contractor BOQ sources, reviewed extraction, item organization, revisions, validation and professional project outputs.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-quantity-surveyors", title: "BOQ Software for Quantity Surveyors | Quantara", description: "Review sources, dimensions, visible calculations, BOQ records and revisions while retaining full professional judgement and responsibility.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-mep-contractors", title: "BOQ Software for MEP Contractors | Quantara", description: "Organize supported MEP schedules, BOQ items, quantities and revisions without claiming automatic drawing measurement or design validation.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-hvac-contractors", title: "HVAC BOQ Software for Reviewed Workflows | Quantara", description: "Organize supported HVAC schedules, equipment and BOQ revisions while keeping duct and pipe measurement with the responsible professional.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-fit-out-companies", title: "Fit-Out BOQ Software for Project Teams | Quantara", description: "Manage supported fit-out sources, finishes, BOQ items, client revisions and outputs without claiming automatic room or drawing measurement.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-fire-fighting-contractors", title: "Fire-Fighting BOQ Workflow Software | Quantara", description: "Organize supported fire-protection schedules and BOQ records while leaving engineering compliance and approval to qualified professionals.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-facilities-management", title: "Facilities Management BOQ Software | Quantara", description: "Structure supported maintenance and refurbishment BOQs, revisions and outputs without presenting Quantara as a CMMS or design validator.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-engineering-consultants", title: "BOQ Software for Engineering Consultants | Quantara", description: "Organize supported consultant schedules, BOQ records and revisions while preserving independent design and professional review.", cluster: "audience", intent: "commercial" }),
  page({ path: "/gcc-boq-software", title: "BOQ Workflow Software for GCC Project Teams | Quantara", description: "Explore a review-led BOQ workflow for GCC construction teams without claims of local authority approval, local rates or regulatory compliance.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-uae", title: "BOQ Software UAE for Construction Teams | Quantara", description: "Support UAE project sources, reviewed BOQ information, visible calculations, revisions and outputs without replacing professional judgement.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-dubai", title: "BOQ Software Dubai for Construction Teams | Quantara", description: "Organize supported Dubai project information and BOQ revisions without claims of local approval, UAE market rates or automatic takeoff.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-abu-dhabi", title: "BOQ Software Abu Dhabi for Project Teams | Quantara", description: "Support reviewed BOQ workflows for Abu Dhabi projects without claims of authority approval, local cost data or automated drawing measurement.", cluster: "regional", intent: "commercial" }),
  page({ path: "/construction-estimating-software-uae", title: "Construction Estimating Software UAE | Quantara", description: "Organize reviewed estimating inputs and BOQ records for UAE projects while keeping pricing, risk and commercial decisions with professionals.", cluster: "regional", intent: "commercial" }),
  page({ path: "/mep-estimating-software-uae", title: "MEP Estimating and BOQ Software UAE | Quantara", description: "Organize supported UAE MEP schedules, BOQ items and revisions without claiming automatic drawing takeoff, rates or design compliance.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-saudi-arabia", title: "BOQ Software for Saudi Arabia Projects | Quantara", description: "Support review-led BOQ organization for Saudi projects without claims of local regulatory approval, market rates or automatic measurement.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-qatar", title: "BOQ Software for Qatar Project Workflows | Quantara", description: "Organize supported Qatar BOQ records and revisions without claims of local authority approval, pricing data or automated takeoff.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-oman", title: "BOQ Software for Oman Project Workflows | Quantara", description: "Support structured BOQ exchange and review for Oman projects without claims of local approval, market rates or automatic measurement.", cluster: "regional", intent: "commercial" }),
  page({ path: "/comparisons", title: "BOQ Software and Workflow Comparisons", description: "Compare BOQ software with spreadsheets, manual preparation, OCR, quantity takeoff and document management using clear capability boundaries.", cluster: "comparison", intent: "informational" }),
  page({ path: "/quantara-vs-excel-for-boq", title: "Quantara vs Excel for BOQ Workflows", description: "Compare Quantara and Excel across project sources, BOQ structure, visible calculations, revisions, validation and professional control.", cluster: "comparison", intent: "commercial" }),
  page({ path: "/boq-software-vs-spreadsheets", title: "BOQ Software vs Spreadsheets: Workflow Comparison", description: "Compare structured BOQ software and spreadsheets across records, formulas, revisions, collaboration, review and output control.", cluster: "comparison", intent: "informational" }),
  page({ path: "/ai-boq-vs-manual-boq-preparation", title: "AI-Assisted vs Manual BOQ Preparation", description: "Compare AI-assisted and manual BOQ preparation across source handling, review, correction and professional responsibility without invented savings.", cluster: "comparison", intent: "informational" }),
  page({ path: "/ocr-vs-structured-boq-extraction", title: "OCR vs Structured BOQ Extraction", description: "Compare text recognition with structured BOQ extraction, field review and project organization, including Quantara's current no-OCR limitation.", cluster: "comparison", intent: "informational" }),
  page({ path: "/quantity-takeoff-vs-boq-software", title: "Quantity Takeoff vs BOQ Software", description: "Compare drawing-based measurement tools with BOQ workflow software for source review, calculations, revisions, validation and outputs.", cluster: "comparison", intent: "informational" }),
  page({ path: "/boq-software-vs-document-management", title: "BOQ Software vs Document Management", description: "Compare BOQ item and revision workflows with document storage systems across structured records, review, validation and outputs.", cluster: "comparison", intent: "informational" }),
  page({ path: "/construction-estimating-software-vs-excel", title: "Construction Estimating Software vs Excel", description: "Compare construction estimating software and Excel across BOQs, rates, assumptions, formulas, revisions and professional review.", cluster: "comparison", intent: "informational" }),
  page({ path: "/when-to-use-boq-software", title: "When to Use BOQ Software: Decision Guide", description: "Assess when BOQ software may help with source volume, item structure, calculation review, revisions, validation and team coordination.", cluster: "comparison", intent: "informational" }),
  page({ path: "/site-map", title: "Quantara Public Website Sitemap", description: "Browse Quantara's public product, audience, regional, comparison, educational, company and legal pages from one directory.", cluster: "company", intent: "navigational", priority: 0.4 }),
  page({ path: "/boq-calculation-formulas", title: "BOQ Calculation Formulas and Quantity Guide", description: "Review common length, area, volume, weight and cost formulas with professional-input requirements and project-specific limitations.", cluster: "measurement", intent: "informational" }),
  page({ path: "/pricing", title: metadataCopy.pricingTitle, description: metadataCopy.pricingDescription, cluster: "company", intent: "commercial" }),
] as const satisfies readonly PublicSearchPage[];

export type PublicSearchPath = (typeof PUBLIC_SEARCH_PAGES)[number]["path"];

export function getPublicSearchPage(path: PublicSearchPath): PublicSearchPage {
  const entry = PUBLIC_SEARCH_PAGES.find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`Unknown public search path: ${path}`);
  return entry;
}

export function createPublicPageMetadata(path: PublicSearchPath): Metadata {
  const entry = getPublicSearchPage(path);
  const canonicalUrl = `${PUBLIC_SITE_ORIGIN}${path === "/" ? "" : path}`;

  return {
    title: { absolute: entry.title },
    description: entry.description,
    alternates: {
      canonical: canonicalUrl,
      languages: { "en-AE": canonicalUrl },
    },
    robots: {
      index: entry.indexable !== false,
      follow: entry.indexable !== false,
      googleBot: {
        index: entry.indexable !== false,
        follow: entry.indexable !== false,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: entry.title,
      description: entry.description,
      url: canonicalUrl,
      siteName: "Quantara",
      locale: "en_AE",
      type: "website",
      images: [{
        url: `${PUBLIC_SITE_ORIGIN}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Quantara AI-assisted BOQ workflow software",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: entry.title,
      description: entry.description,
      images: [`${PUBLIC_SITE_ORIGIN}/twitter-image`],
    },
  };
}

export function createPublicUtilityMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const canonicalUrl = `${PUBLIC_SITE_ORIGIN}${path === "/" ? "" : path}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: { "en-AE": canonicalUrl },
    },
    robots: { index: false, follow: false, noarchive: true },
  };
}

export function createPrivateUtilityMetadata(
  title: string,
  description: string,
): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: null },
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
  };
}
