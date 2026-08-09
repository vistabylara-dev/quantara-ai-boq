import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-for-hvac-contractors");



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "HVAC BOQ Software",
    title: "HVAC BOQ Software for Structured Estimating and Project Review",
    audienceDescription: "For HVAC contractors and estimators seeking structured workflows to manage ductwork, piping, and equipment BOQs.",
    directAnswer: "Quantara helps HVAC contractors capture supported information for review and organize equipment, ductwork and piping items in structured BOQ records.",
    challenges: [
  {
    "title": "Complex Equipment Schedules",
    "description": "HVAC BOQs can rely on detailed equipment schedules whose descriptions, capacities, units and quantities require careful source review."
  },
  {
    "title": "Ductwork and Piping Variations",
    "description": "Managing the sheer volume of item descriptions for various duct sizes, piping materials, and insulation requirements is prone to data-entry errors."
  }
],
    workflowDescription: "HVAC teams can organize supported equipment, ductwork, piping, insulation, controls and accessory items into BOQ sections. Quantities, units and testing requirements still require professional review, and distinct revisions must be compared by users.",
    workflowExample: "An HVAC estimator is reviewing a text-based consultant BOQ alongside an Excel pricing sheet. They use Quantara to capture supported ductwork information and structure it in a BOQ for review. A scanned version would be detected and flagged for manual transcription because OCR text extraction is not currently available.",
    typicalCategories: [
  "Chillers and AHUs",
  "FCUs and Terminals",
  "Ductwork and Accessories",
  "Chilled Water Piping",
  "Insulation",
  "BMS and Controls",
  "Testing and Balancing"
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
  "Quantara does not provide engineering design validation or compliance approval.",
  "Quantara does not claim drawing-based duct or pipe measurement capabilities.",
  "Advanced supplier and live-pricing integrations are not currently available."
],
    faqs: [
  {
    "question": "Can HVAC BOQ software measure ductwork automatically?",
    "answer": "No, Quantara does not currently perform drawing-based duct or pipe measurement. Automatic takeoff is not currently available."
  },
  {
    "question": "Does it integrate with supplier pricing databases?",
    "answer": "Direct supplier and live-pricing workflows are not currently available. Right now, it focuses on structuring the BOQ data."
  },
  {
    "question": "Can I manage BMS and controls items?",
    "answer": "Yes, BMS and controls can be structured as specific sections within your HVAC BOQ for clear pricing."
  },
  {
    "question": "How do you handle scanned equipment schedules?",
    "answer": "Scanned equipment schedules are detected and flagged as requiring OCR today; OCR text extraction is not currently available, so scanned schedules currently require manual transcription and careful review by an HVAC professional."
  },
  {
    "question": "Does Quantara validate HVAC design?",
    "answer": "No, Quantara is a document organization tool and provides no engineering approval or design validation."
  },
  {
    "question": "Can I track testing and commissioning items?",
    "answer": "Yes, testing, balancing, and commissioning can be organized as distinct items or sections within the BOQ."
  },
  {
    "question": "How are ductwork variations handled?",
    "answer": "Different duct sizes and materials are managed as separate, structured items with their respective quantities and units."
  },
  {
    "question": "Is it suitable for both commercial and residential?",
    "answer": "The structured workflow may support commercial or residential HVAC BOQs when the source type, project needs and current product limits are suitable."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-for-mep-contractors",
    "label": "BOQ Software for MEP Contractors"
  },
  {
    "href": "/scanned-pdf-boq",
    "label": "Scanned PDF BOQ"
  },
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  },
  {
    "href": "/boq-document-generation",
    "label": "BOQ Document Generation"
  },
  {
    "href": "/features",
    "label": "Features"
  }
],
    path: "/boq-software-for-hvac-contractors"
  };

  return <IndustryLandingPage content={content} />;
}
