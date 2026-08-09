import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-for-fit-out-companies");



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Fit-Out",
    title: "BOQ Software for Fit-Out Companies Managing Detailed Interior Scope",
    audienceDescription: "For interior fit-out and renovation companies evaluating structured BOQ, finishes and revision-record workflows.",
    directAnswer: "Quantara helps fit-out companies organize supported interior project sources, reviewed BOQ items and distinct revision records.",
    challenges: [
  {
    "title": "High Volume of Revisions",
    "description": "Interior fit-out projects can involve frequent client design changes and multiple document revisions that teams must reconcile."
  },
  {
    "title": "Detailed Finishes Schedules",
    "description": "Managing complex schedules for joinery, flooring, and bespoke fixtures often leads to missed items during the estimating phase."
  }
],
    workflowDescription: "Fit-out teams can organize supported finishes, partitions, ceilings, flooring, joinery, doors and fixture items in BOQ sections. Teams must reconcile MEP coordination, variations, omissions and revision differences themselves.",
    workflowExample: "A fit-out company receives a text-based PDF scope and an Excel BOQ for a commercial office. Supported information is captured for review, reconciled by the estimator and organized into BOQ sections before the output is checked. Scanned finishes schedules are detected and require manual transcription because OCR text extraction is not currently available.",
    typicalCategories: [
  "Demolition",
  "Partitions and Drylining",
  "Ceilings",
  "Flooring and Finishes",
  "Bespoke Joinery",
  "Doors and Hardware",
  "FF&E (Fixtures, Furniture & Equipment)"
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
  "Quantara does not claim automatic drawing measurement or room detection.",
  "Quantara does not provide pre-built cost or material libraries for finishes.",
  "All BOQ outputs require professional review before use in a contract."
],
    faqs: [
  {
    "question": "How should fit-out revisions be controlled?",
    "answer": "Keep distinct revision identifiers and issue notes, then compare each BOQ record with the relevant client instruction. Quantara does not automatically interpret every added or removed finish."
  },
  {
    "question": "Does it automatically detect rooms from floor plans?",
    "answer": "No, automated room detection and drawing measurement are not currently available."
  },
  {
    "question": "Can I manage bespoke joinery items?",
    "answer": "Yes, bespoke items can be entered with detailed descriptions and specific units of measurement."
  },
  {
    "question": "Does it handle MEP coordination for fit-outs?",
    "answer": "You can create specific sections for MEP builders-work or coordination items within your master fit-out BOQ."
  },
  {
    "question": "Can I generate professional client proposals?",
    "answer": "Quantara can generate a reviewable PDF output from reviewed BOQ data and an available template. A professional must check it before client issue."
  },
  {
    "question": "How do I handle FF&E schedules?",
    "answer": "Supported structured Excel schedules can be imported. For a text-based PDF, only supported detected table rows become review candidates; a professional must verify them and organize accepted FF&E items into a BOQ section. Scanned schedules require manual transcription because OCR text extraction is not currently available."
  },
  {
    "question": "Can I use templates for common fit-out types?",
    "answer": "Available company templates can be applied where configured. Each template and generated result must be reviewed for the specific project."
  },
  {
    "question": "Does Quantara price the materials?",
    "answer": "No, Quantara structures the BOQ. The user must provide their own rates and pricing information."
  }
],
    relatedPages: [
  {
    "href": "/boq-software",
    "label": "BOQ Software"
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
    "href": "/boq-document-generation",
    "label": "BOQ Document Generation"
  },
  {
    "href": "/features",
    "label": "Features"
  }
],
    path: "/boq-software-for-fit-out-companies"
  };

  return <IndustryLandingPage content={content} />;
}
