import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-for-quantity-surveyors");



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Quantity Surveyors",
    title: "BOQ Software for Quantity Surveyors Managing Structured Project Records",
    audienceDescription: "For professional quantity surveyors and commercial managers evaluating structured BOQ review, revision records and supported outputs.",
    directAnswer: "Quantara helps quantity surveyors organize supported project sources, reviewed BOQ records and distinct revisions while professional judgement remains with the QS.",
    challenges: [
  {
    "title": "Version Control Chaos",
    "description": "Tracking changes across multiple tender addenda and consultant revisions often leads to pricing outdated scope."
  },
  {
    "title": "Document Extraction Burden",
    "description": "Verifying and transcribing item descriptions and quantities from client documents requires careful source review."
  }
],
    workflowDescription: "Quantara captures supported information for review and organizes confirmed BOQ sections, quantities, descriptions and revision records. The QS must document assumptions, exclusions and commercial decisions through the applicable professional process.",
    workflowExample: "A quantity surveyor receives a revised consultant BOQ as a text-based PDF. Supported information is captured for review, confirmed items are organized in Revision 2 and the resulting output is checked before tender issue. A scanned version is detected and flagged for manual transcription because OCR text extraction is not currently available.",
    typicalCategories: [
  "Substructure",
  "Superstructure",
  "Internal Finishes",
  "External Works",
  "Provisional Sums",
  "Prime Cost Sums",
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
  "Quantara does not replace measurement judgment or regulated QS practice.",
  "Quantara does not perform automated drawing measurement.",
  "Professional review of all captured information and outputs is required."
],
    faqs: [
  {
    "question": "Does Quantara replace a quantity surveyor?",
    "answer": "No. Quantara is an assistive workflow tool. Professional judgement and regulated QS practice remain the responsibility of the user."
  },
  {
    "question": "How does it help with commercial review?",
    "answer": "Structured sections and distinct revision records give the quantity surveyor defined records to compare. Quantara does not claim automated change interpretation."
  },
  {
    "question": "Can I track BOQ assumptions?",
    "answer": "Relevant assumptions and exclusions can be documented in supported project records and reports. The QS must maintain the required commercial record."
  },
  {
    "question": "Are standard measurement rules (e.g., NRM) built-in?",
    "answer": "No, Quantara provides the structural framework, but the quantity surveyor applies the relevant measurement rules and descriptions."
  },
  {
    "question": "How are tender documents managed?",
    "answer": "Supported information can be captured and organized into distinct project records. The QS must verify that the BOQ matches the intended tender issue."
  },
  {
    "question": "Does it support scanned consultant PDFs?",
    "answer": "Scanned consultant PDFs can be uploaded and are automatically detected and flagged as requiring OCR. Automated OCR text extraction is not currently available, so scanned content currently requires manual transcription with rigorous human review of every quantity and unit."
  },
  {
    "question": "Can consultants manage multiple project revisions?",
    "answer": "The platform retains multiple BOQ revisions as distinct records. Professionals must compare them and determine which version applies."
  },
  {
    "question": "Can I export the data for other QS software?",
    "answer": "Structured data can be exported as XLSX or CSV for further professional processing. Compatibility with another product depends on its import requirements."
  }
],
    relatedPages: [
  {
    "href": "/quantity-surveying-software",
    "label": "Quantity Surveying Software"
  },
  {
    "href": "/boq-management",
    "label": "BOQ Management"
  },
  {
    "href": "/boq-revision-control",
    "label": "BOQ Revision Control"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "How to Review an AI-Extracted BOQ"
  },
  {
    "href": "/about",
    "label": "About Quantara"
  }
],
    showBuyerJourney: true,
    path: "/boq-software-for-quantity-surveyors"
  };

  return <IndustryLandingPage content={content} />;
}
