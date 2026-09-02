import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-for-mep-contractors", locale);
}



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for MEP Contractors",
    title: "BOQ Software for MEP Contractors Managing Multi-Discipline Scope",
    audienceDescription: "For mechanical, electrical and plumbing contractors evaluating structured, multi-discipline BOQ and source-review workflows.",
    directAnswer: "Quantara helps MEP contractors capture supported information for review and organize confirmed mechanical, electrical and plumbing items in BOQ sections.",
    challenges: [
  {
    "title": "Multi-Discipline Complexity",
    "description": "MEP packages can contain many specialized items across mechanical, electrical and plumbing trades, so scope boundaries require careful review."
  },
  {
    "title": "Technical Document Coordination",
    "description": "Managing the relationship between the BOQ descriptions, equipment schedules, and supplier references often leads to misaligned pricing."
  }
],
    workflowDescription: "Quantara provides structured sections for supported mechanical, electrical and plumbing items, quantities, units and reference notes. Contractors must verify technical specifications, compare distinct revisions and check every output.",
    workflowExample: "An MEP estimator is working on a high-rise residential project. They use Quantara to separate the electrical lighting schedules from the mechanical HVAC scope, organizing each discipline into its own structured BOQ section for distinct subcontractor pricing.",
    typicalCategories: [
  "HVAC",
  "Electrical",
  "Plumbing",
  "Drainage",
  "Fire Fighting",
  "Controls",
  "Testing and Commissioning",
  "Preliminaries"
],
    supportedInputs: [
  "Text-based PDF",
  "Scanned PDF (detection only — OCR not currently available)",
  "XLSX",
  "CSV"
],
    plannedInputs: [
  "CAD",
  "BIM",
  "IFC"
],
    supportedOutputs: [
  "Structured Excel (XLSX)",
  "Reviewable PDF Outputs",
  "CSV Exports"
],
    limitations: [
  "Quantara does not provide verified discipline libraries or pre-built MEP item databases.",
  "Quantara does not provide engineering approval or code compliance certification.",
  "Automatic takeoff from MEP drawings is not currently available."
],
    faqs: [
  {
    "question": "Which BOQ sections are common in MEP projects?",
    "answer": "Typical sections include HVAC, Electrical, Plumbing, Drainage, Fire Fighting, Controls, and Testing & Commissioning."
  },
  {
    "question": "Does Quantara have pre-built MEP libraries?",
    "answer": "No, Quantara does not currently offer verified pre-built discipline libraries. Users must define their own categories and items."
  },
  {
    "question": "Can I manage equipment schedules?",
    "answer": "Supported structured Excel schedules can be imported. For a text-based PDF, only supported detected table rows become review candidates, which a professional must verify and organize as BOQ items. Scanned schedules require manual transcription because OCR text extraction is not currently available."
  },
  {
    "question": "Does it validate MEP engineering compliance?",
    "answer": "No. Quantara is a document and workflow platform. It does not provide engineering approval or design validation."
  },
  {
    "question": "How do you handle supplier references?",
    "answer": "Supplier references and technical specifications can be added as notes or descriptions to specific BOQ items."
  },
  {
    "question": "Can I separate mechanical and electrical scope?",
    "answer": "Yes, the platform allows you to create distinct sections and packages to cleanly separate multi-discipline scope."
  },
  {
    "question": "Does it measure pipe lengths automatically?",
    "answer": "No, automatic drawing measurement, including pipe or cable runs, is not currently available."
  },
  {
    "question": "How are MEP revisions handled?",
    "answer": "Distinct BOQ revisions retain identifiable project states. Users must compare the records and verify that updates were applied to the intended discipline sections."
  }
],
    relatedPages: [
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/boq-software",
    "label": "BOQ Software"
  },
  {
    "href": "/pdf-boq-extraction",
    "label": "PDF BOQ Extraction"
  },
  {
    "href": "/boq-review-checklist",
    "label": "BOQ Review Checklist"
  },
  {
    "href": "/features",
    "label": "Features"
  }
],
    showBuyerJourney: true,
    path: "/boq-software-for-mep-contractors"
  };

  return <IndustryLandingPage content={content} />;
}
