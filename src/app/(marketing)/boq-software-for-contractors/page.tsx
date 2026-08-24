import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-for-contractors");



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Contractors",
    title: "BOQ Software for Contractors Managing Complex Project Information",
    audienceDescription: "For general contractors and subcontractors evaluating structured BOQ and project-source workflows.",
    directAnswer: "Quantara gives contractors a complete BOQ workspace: use AI-assisted preparation for supported files, create or finish every item with direct engineer control, manage quantities and rates, track revisions and deliver reviewed outputs.",
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
    workflowDescription: "Quantara captures supported information from text-based tender PDFs and spreadsheets for review. Contractors can then directly add or correct descriptions, measurements, quantities and rates, complete every BOQ section, reconcile scope and generate reviewed outputs.",
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
  "Automated visual quantity takeoff is not universal; engineers retain direct control to enter and calculate measurements in the BOQ workflow.",
  "CAD and BIM files can remain source evidence while supported integration workflows depend on file type and configuration.",
  "Teams control their own categories, rates, assumptions and final professional approval."
],
    faqs: [
  {
    "question": "Can contractors organize subcontractor scope with Quantara?",
    "answer": "Yes, contractors can structure their BOQ into distinct packages, making it easier to manage subcontractor scopes and pricing."
  },
  {
    "question": "Does Quantara measure quantities from drawings?",
    "answer": "Quantara supports guided measurement workflows with visible formulas and direct engineer control. The responsible professional verifies and completes quantities before issue."
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
    "answer": "Scanned tender documents can be uploaded and are automatically detected and flagged as requiring OCR. OCR text extraction is not currently available, so scanned content requires professional transcription and review."
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
