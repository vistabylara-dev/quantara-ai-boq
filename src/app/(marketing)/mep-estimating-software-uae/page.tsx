import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata = createPublicPageMetadata("/mep-estimating-software-uae");



export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "UAE MEP Estimating Software",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "MEP Estimating Software for UAE Contractors and Project Teams",
    audienceDescription: "For UAE MEP contractors and estimators managing complex technical schedules and multi-discipline BOQs.",
    directAnswer: "Quantara helps UAE MEP contractors structure mechanical, electrical, and plumbing BOQs, track technical schedules, and manage project revisions.",
    challenges: [
  {
    "title": "Multi-Discipline Complexity",
    "description": "Separating HVAC, plumbing, drainage and electrical scope from a multidisciplinary consultant BOQ requires careful review."
  },
  {
    "title": "Technical Schedule Extraction",
    "description": "Extracting data accurately from detailed equipment schedules in PDF format is a major bottleneck for MEP estimators."
  }
],
    workflowDescription: "Quantara provides the structure to manage distinct MEP scopes, including HVAC, fire fighting, controls, and testing & commissioning. Users can organize revisions and technical schedules into a unified BOQ, preparing the data for professional review.",
    workflowExample: "An MEP estimator in the UAE uses Quantara to extract equipment schedules from a consultant's text-based PDF, organizing the AHUs and FCUs into a structured HVAC section while keeping the lighting fixtures in a separate Electrical section. A scanned version of the same schedule would be detected and flagged for manual transcription, since OCR text extraction is not currently available.",
    typicalCategories: [
  "HVAC",
  "Plumbing and Drainage",
  "Electrical Services",
  "Fire Fighting",
  "Testing and Commissioning"
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
  "Formatted PDF Proposals",
  "CSV Exports"
],
    limitations: [
  "Quantara does not claim automatic MEP measurement from drawings.",
  "Quantara does not validate engineering code compliance.",
  "Quantara does not provide pre-built MEP pricing libraries."
],
    faqs: [
  {
    "question": "Can I manage electrical and mechanical scope separately?",
    "answer": "Yes, you can create distinct sections within Quantara to cleanly separate different MEP disciplines."
  },
  {
    "question": "Does Quantara measure pipe or cable lengths automatically?",
    "answer": "No, automatic drawing measurement is not currently available."
  },
  {
    "question": "Can I extract HVAC equipment schedules?",
    "answer": "Yes, you can extract technical schedules from text-based PDFs and structure them today, though manual verification is required. Scanned schedules are detected and flagged for manual transcription; OCR text extraction is not currently available."
  },
  {
    "question": "Does it validate MEP engineering compliance?",
    "answer": "No, Quantara is a workflow tool and provides no engineering approval or compliance validation."
  },
  {
    "question": "Can I track testing and commissioning items?",
    "answer": "Yes, testing, balancing, and commissioning can be organized as structured items in your BOQ."
  },
  {
    "question": "How are MEP revisions handled?",
    "answer": "You can use revision control to track updates to specific MEP sections as consultant addenda are issued."
  },
  {
    "question": "Does it include UAE MEP rates?",
    "answer": "No, Quantara does not include pricing databases or local rates."
  },
  {
    "question": "What formats can I export to?",
    "answer": "You can export your structured MEP BOQ to XLSX, CSV, or formatted PDF proposals."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-for-mep-contractors",
    "label": "MEP BOQ Software"
  },
  {
    "href": "/boq-software-for-hvac-contractors",
    "label": "HVAC BOQ Software"
  },
  {
    "href": "/boq-software-for-fire-fighting-contractors",
    "label": "Fire Fighting BOQ Software"
  },
  {
    "href": "/pdf-boq-extraction",
    "label": "PDF BOQ Extraction"
  },
  {
    "href": "/features",
    "label": "Features"
  }
],
    path: "/mep-estimating-software-uae"
  };

  return <RegionalLandingPage content={content} />;
}
