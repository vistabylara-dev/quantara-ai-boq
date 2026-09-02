import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/construction-estimating-software-uae", locale);
}



export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "UAE Estimating Software",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "Construction Estimating Software for UAE BOQ and Project Workflows",
    audienceDescription: "For UAE teams linking BOQ preparation to their core construction-estimating processes.",
    directAnswer: "Quantara provides a structured foundation for UAE estimating teams, organizing BOQ items, quantities, and assumptions before professional pricing review.",
    challenges: [
  {
    "title": "Unstructured Estimating Data",
    "description": "Repeated transcription from PDFs into pricing spreadsheets can consume estimator time and introduce omission risk."
  },
  {
    "title": "Tracking Assumptions",
    "description": "Failing to clearly link commercial assumptions and exclusions to specific BOQ items often leads to disputes post-award."
  }
],
    workflowDescription: "Quantara organizes reviewed quantities, units, rates and assumptions in BOQ records. Available company templates can support a reviewable baseline for professional pricing work.",
    workflowExample: "A UAE estimator captures supported information from a text-based PDF BOQ, verifies the items, documents relevant exclusions and exports the reviewed list to XLSX for further rate application. A scanned version is detected and requires manual transcription because OCR text extraction is not currently available.",
    typicalCategories: [
  "Site Preparation",
  "Concrete Works",
  "Masonry",
  "Metals",
  "Finishes"
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
  "Quantara does not provide an automatic final-cost guarantee.",
  "Quantara does not claim to include UAE rate libraries or databases.",
  "Quantara does not calculate VAT or other statutory deductions."
],
    faqs: [
  {
    "question": "How does Quantara assist UAE estimators?",
    "answer": "It captures supported information for review and organizes confirmed BOQ records before pricing. No fixed time saving is promised, and estimators still provide rates and commercial judgement."
  },
  {
    "question": "Does it include a UAE pricing database?",
    "answer": "No, Quantara does not provide pre-built rate libraries. Estimators must use their own commercial rates."
  },
  {
    "question": "Can I track estimating assumptions?",
    "answer": "Yes, assumptions and exclusions can be documented directly against specific BOQ sections or items."
  },
  {
    "question": "Does Quantara guarantee final project costs?",
    "answer": "No, Quantara is a workflow tool. Final cost guarantees are entirely the responsibility of the estimating professional."
  },
  {
    "question": "Does it support VAT calculation?",
    "answer": "No, Quantara does not handle tax calculations like VAT."
  },
  {
    "question": "Can I export the structured BOQ to my estimating software?",
    "answer": "Yes, you can export the data to CSV or XLSX for import into your primary financial or estimating system."
  },
  {
    "question": "Are standard company templates supported?",
    "answer": "Yes, you can save your preferred BOQ structure as a template for future use."
  },
  {
    "question": "Does Quantara perform visual quantity takeoff?",
    "answer": "No, automatic drawing measurement and visual takeoff are not currently available."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-uae",
    "label": "BOQ Software UAE"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/boq-vs-construction-estimate",
    "label": "BOQ vs Construction Estimate"
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
    path: "/construction-estimating-software-uae"
  };

  return <RegionalLandingPage content={content} />;
}
