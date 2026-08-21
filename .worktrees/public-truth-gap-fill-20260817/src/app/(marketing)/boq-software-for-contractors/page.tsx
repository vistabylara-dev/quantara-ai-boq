import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-for-contractors");



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Contractors",
    title: "BOQ Software for Contractors Managing Complex Project Information",
    audienceDescription: "For general contractors and subcontractors evaluating structured BOQ and project-source workflows.",
    directAnswer: "Quantara helps contractors organize supported tender sources, reviewed BOQ records and distinct project revisions within an authorized workspace.",
    challenges: [
  {
    "title": "Fragmented Tender Documents",
    "description": "Contractors often receive unstructured PDFs, Excel files, and printed schedules that must be manually consolidated before any pricing can begin."
  },
  {
    "title": "Scope Coordination",
    "description": "Managing multiple subcontractor packages and checking for scope overlaps or omissions can become difficult across separate files."
  }
],
    workflowDescription: "Quantara captures supported information from text-based tender PDFs and spreadsheets for review, then organizes confirmed descriptions, units and quantities in BOQ sections. Contractors must still reconcile scope, assumptions, exclusions and pricing.",
    workflowExample: "A general contractor receives a text-based PDF and spreadsheet tender package. Supported information is captured for review, reconciled by the estimating team and organized into BOQ trade sections before subcontractor issue.",
    typicalCategories: [
  "Preliminaries",
  "Civil Works",
  "Architectural Works",
  "MEP Packages",
  "Finishes",
  "Provisional Items",
  "Exclusions",
  "Alternates"
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
  "Quantara does not currently perform automated visual quantity takeoff or drawing measurement.",
  "BIM and CAD integrations are not currently available.",
  "Quantara does not provide pre-built cost databases or universal category structures."
],
    faqs: [
  {
    "question": "Can contractors organize subcontractor scope with Quantara?",
    "answer": "Yes, contractors can structure their BOQ into distinct packages, making it easier to manage subcontractor scopes and pricing."
  },
  {
    "question": "Does Quantara measure quantities from drawings?",
    "answer": "No, automatic drawing measurement and visual quantity takeoff are not currently available."
  },
  {
    "question": "How are assumptions and exclusions handled?",
    "answer": "Contractors can document relevant assumptions and exclusions in supported project records and reports, then check them during internal review."
  },
  {
    "question": "Can I export a priced proposal for a client?",
    "answer": "Quantara supports reviewable PDF and structured XLSX outputs from reviewed BOQ data. A professional must check them before client issue."
  },
  {
    "question": "Does it support scanned tender documents?",
    "answer": "Scanned tender documents can be uploaded and are automatically detected and flagged as requiring OCR. OCR text extraction is not currently available, so scanned content currently requires manual transcription and professional review."
  },
  {
    "question": "Is there a pre-built category structure?",
    "answer": "No, categories are user-defined. Quantara provides the structure, but you define the specific trades and packages."
  },
  {
    "question": "How are BOQ revisions tracked?",
    "answer": "Quantara retains distinct BOQ revision records. Contractors must compare the records and interpret quantity or scope changes from tender addenda."
  },
  {
    "question": "Does Quantara replace our estimating software?",
    "answer": "Quantara focuses on the BOQ structuring and document workflow. It is designed to complement your existing pricing and estimating tools."
  }
],
    relatedPages: [
  {
    "href": "/boq-software",
    "label": "BOQ Software"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/how-to-prepare-a-boq",
    "label": "How to Prepare a BOQ"
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
    path: "/boq-software-for-contractors"
  };

  return <IndustryLandingPage content={content} />;
}
