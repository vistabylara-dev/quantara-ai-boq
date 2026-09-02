import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-uae", locale);
}



export default async function Page() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));

  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "BOQ Software UAE",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "BOQ Software for UAE Construction and Estimating Teams",
    audienceDescription: "For UAE contractors, estimators and quantity surveyors requiring structured BOQ and project document workflows.",
    directAnswer: "Quantara is AI-assisted BOQ workflow software that helps UAE construction teams organize supported project sources, reviewed information and distinct BOQ revision records.",
    challenges: [
  {
    "title": "Mixed Tender Formats",
    "description": "UAE construction and tender workflows vary by project, often involving a mix of scanned PDFs, consultant Excel files, and unstructured project narratives."
  },
  {
    "title": "High Revision Volume",
    "description": "Managing frequent consultant, contractor, and subcontractor revisions during the tender phase requires strict document control."
  }
],
    workflowDescription: "Quantara captures supported information from text-based PDFs and spreadsheets for review, organizes confirmed BOQ records and retains distinct revisions. Available templates can support reviewed outputs. Users remain responsible for multilingual descriptions, commercial data and final issue decisions.",
    workflowExample: "A UAE main contractor receives a text-based PDF BOQ from a consultant. Supported information is captured for review, confirmed items are organized in a BOQ record and an available company template is applied to a reviewable output. A scanned version is detected and flagged for manual transcription because OCR text extraction is not currently available.",
    typicalCategories: [
  "Preliminaries",
  "Civil and Structural",
  "Architectural Finishes",
  "MEP Works",
  "Provisional Sums"
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
  "Quantara does not claim UAE compliance or specific regulatory approval.",
  "Quantara does not provide UAE-specific market rates or calculate UAE VAT.",
  "Quantara does not support automated Arabic language translation or native parsing unless explicitly verified in the future."
],
    faqs: [
  {
    "question": t("publicContent.regional.uaeAvailabilityQuestion"),
    "answer": t("publicContent.regional.uaeAvailabilityAnswer")
  },
  {
    "question": "Does Quantara include UAE construction rates?",
    "answer": "No, Quantara does not provide pre-built UAE market rates or pricing databases. Users must apply their own rates to the structured BOQ."
  },
  {
    "question": "Does Quantara support UAE VAT calculations?",
    "answer": "No, Quantara does not calculate VAT or other local taxes. It focuses purely on structuring the BOQ items and quantities."
  },
  {
    "question": "Can Quantara process Arabic BOQ documents?",
    "answer": "Current public capability information does not verify Arabic OCR or translation. Language support should be confirmed for the source and workflow before use."
  },
  {
    "question": "Is Quantara hosted in the UAE?",
    "answer": t("publicContent.regional.residencyAnswer")
  },
  {
    "question": "Does it comply with Dubai Municipality regulations?",
    "answer": "Quantara is a document workflow tool and does not provide engineering approval or regulatory compliance validation."
  },
  {
    "question": "Can I manage consultant revisions?",
    "answer": "Quantara retains distinct BOQ revision records. Users must compare them and interpret updates from consultants or clients."
  },
  {
    "question": t("publicContent.regional.accessQuestion"),
    "answer": t("publicContent.regional.accessAnswer")
  },
  {
    "question": "Which file formats are currently supported?",
    "answer": "Quantara imports supported structured XLSX and CSV data. For text-based PDFs, it stores extractable text and creates review candidates only from supported detected table rows. Scanned/image-only PDFs are detected and flagged for manual transcription; OCR text extraction is not currently available."
  },
  {
    "question": "Does Quantara replace a local quantity surveyor?",
    "answer": "No, professional review by a qualified QS or estimator is always required."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-dubai",
    "label": "BOQ Software Dubai"
  },
  {
    "href": "/boq-software-abu-dhabi",
    "label": "BOQ Software Abu Dhabi"
  },
  {
    "href": "/construction-estimating-software-uae",
    "label": "UAE Estimating Software"
  },
  {
    "href": "/mep-estimating-software-uae",
    "label": "UAE MEP Estimating"
  },
  {
    "href": "/boq-software",
    "label": "BOQ Software"
  }
],
    showBuyerJourney: true,
    path: "/boq-software-uae"
  };

  return <RegionalLandingPage content={content} />;
}
