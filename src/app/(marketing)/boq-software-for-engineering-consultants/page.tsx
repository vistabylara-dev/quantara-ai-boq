import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-for-engineering-consultants", locale);
}



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Consultants",
    title: "BOQ Software for Engineering Consultants Managing Controlled Project Information",
    audienceDescription: "For engineering consultants and client-side project teams managing BOQ preparation, multidisciplinary coordination, and tender issue workflows.",
    directAnswer: "Quantara helps engineering consultants organize supported project sources, BOQ sections, available templates and distinct revision records for professional review.",
    challenges: [
  {
    "title": "Multidisciplinary Coordination",
    "description": "Consolidating BOQ sections from civil, structural, architectural, and MEP engineering disciplines into one cohesive tender document is error-prone."
  },
  {
    "title": "Tender Issue Control",
    "description": "Issuing the correct, verified revision of a BOQ to clients and contractors requires rigorous document control and tracking."
  }
],
    workflowDescription: "Quantara stores extractable PDF text and creates review candidates only from supported detected table rows, then organizes professionally reviewed BOQ sections, distinct revisions and available templates. Consultants remain responsible for multidisciplinary coordination, issue records and professional approval.",
    workflowExample: "A consultant team reviews revised BOQ sections from structural and MEP departments before tender release. Supported table-row candidates are checked against their source, confirmed items are organized in a distinct revision record and a reviewable PDF is generated for checking.",
    typicalCategories: [
  "General Preliminaries",
  "Substructure",
  "Superstructure",
  "Architectural Finishes",
  "Mechanical Services",
  "Electrical Services",
  "External Works"
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
  "Quantara does not claim formal design validation, compliance approval, or certification.",
  "Quantara does not automate the professional judgment required to prepare a BOQ.",
  "Automatic quantity extraction from engineering models is not currently available."
],
    faqs: [
  {
    "question": "Can consultants manage multiple project revisions?",
    "answer": "Quantara retains multiple BOQ revisions as distinct project records. Consultants must identify the current issue and compare the records before tender release."
  },
  {
    "question": "Does Quantara perform design validation?",
    "answer": "No, Quantara does not provide formal design validation, code compliance, or engineering certification."
  },
  {
    "question": "How is multidisciplinary coordination handled?",
    "answer": "Consultants can create distinct sections for supported disciplines within a project BOQ. They must still check scope boundaries, overlaps and omissions."
  },
  {
    "question": "Can I use controlled templates?",
    "answer": "Available company templates can support consistent BOQ layouts. Each template and generated result still requires configuration and review."
  },
  {
    "question": "Does it replace traditional measurement software?",
    "answer": "Quantara focuses on document structure, extraction, and revision control. It does not currently replace dedicated visual measurement tools."
  },
  {
    "question": "How are issue records maintained?",
    "answer": "Distinct revision records preserve identifiable BOQ states. Users must maintain issue notes and interpret what changed between them."
  },
  {
    "question": "Can I export documents for client review?",
    "answer": "Supported BOQ data can be exported as reviewable PDF or XLSX files. A professional must check the file before client presentation or issue."
  },
  {
    "question": "Is it suitable for client-side project teams?",
    "answer": "Yes, client representatives can use the platform to structure their requirements and review consultant-issued documents."
  }
],
    relatedPages: [
  {
    "href": "/quantity-surveying-software",
    "label": "Quantity Surveying Software"
  },
  {
    "href": "/boq-revision-control",
    "label": "BOQ Revision Control"
  },
  {
    "href": "/how-to-prepare-a-boq",
    "label": "How to Prepare a BOQ"
  },
  {
    "href": "/boq-document-generation",
    "label": "BOQ Document Generation"
  },
  {
    "href": "/about",
    "label": "About Quantara"
  }
],
    path: "/boq-software-for-engineering-consultants"
  };

  return <IndustryLandingPage content={content} />;
}
