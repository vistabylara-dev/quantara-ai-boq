import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/ai-boq-software");



const content: SeoLandingPageContent = {
  breadcrumbLabel: "AI BOQ Software",
  h1: "AI BOQ Software for Structured, Human-Reviewed Project Workflows",
  directDefinition: "AI BOQ software can assist construction professionals with supported capture, structuring and organization of project records. It may reduce repeated transcription, but corrections, additions and strict human review remain part of the workflow.",
  audience: {
    heading: "Who Uses AI BOQ Software?",
    content: "Quantara is built for professionals who require structured project records and controlled documentation.",
    items: ["Contractors managing multiple tender submissions","Estimators structuring complex project scope","Quantity surveyors reviewing extracted quantities","MEP teams organizing specialized disciplines"]
  },
  workflowProblem: {
    heading: "The Challenge of Manual BOQ Workflows",
    paragraphs: [
      <>Construction projects often begin with complex documents. Estimating teams may manually copy data from text-based PDFs or scanned files into spreadsheets, creating repeated work and opportunities for entry errors. Teams can compare <Link href="/ai-boq-vs-manual-boq-preparation" className="text-blue-600 hover:underline font-medium">AI-assisted and manual BOQ preparation</Link> before choosing a workflow.</>,
      <>Furthermore, <Link href="/ocr-vs-structured-boq-extraction" className="text-blue-600 hover:underline font-medium">basic OCR tools</Link> recognize image text but do not by themselves establish the intended BOQ hierarchy. Captured content still requires structuring and professional review.</>
    ]
  },
  quantaraSupport: {
    heading: "How Quantara Supports the Workflow",
    paragraphs: ["Quantara stores the extractable text layer from supported PDFs and creates review candidates from supported detected table rows. Plain paragraph text is not automatically converted into BOQ candidates.","Quantara does not replace the professional estimator or eliminate manual entry. It can reduce repeated transcription for supported tabular content while the user handles corrections, additions, rate application and commercial review."]
  },
  relevantFeatures: [{"name":"Document Extraction","capabilityId":"text-pdf-extraction","description":"Store extractable PDF text and create review candidates from supported detected table rows."},{"name":"Scanned/Image-Only PDF Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only pages and reports that text extraction is unavailable; manual transcription is required."},{"name":"Scanned PDF OCR","capabilityId":"scanned-pdf-ocr","description":"Automated text recognition for image-based PDFs is not currently implemented."},{"name":"Structured Workspaces","capabilityId":"boq-management","description":"Organize confirmed items into hierarchical sections and trades."}],
  workflowExample: {
    heading: "Practical AI Extraction Workflow",
    introduction: "A typical workflow for processing a consultant’s tender package:",
    steps: [{"title":"Upload Source","description":"The estimator uploads a supported text-based PDF containing BOQ information."},{"title":"Supported Capture","description":"Quantara stores the extractable text layer and presents supported detected table rows as review candidates."},{"title":"Human Review","description":"The estimator verifies, corrects or rejects each relevant field against the source."},{"title":"Structuring","description":"Confirmed items are organized into supported BOQ sections."},{"title":"Output Generation","description":"A structured XLSX file is exported for further professional processing."}]
  },
  supportedInputs: [{"name":"Text-based PDF","capabilityId":"text-pdf-extraction","description":"Supported PDFs with selectable text and reviewable table content."},{"name":"Scanned/Image-Only PDF — Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only pages and reports that text extraction is unavailable.","limitation":"Quantara does not provide OCR; manual transcription is required."},{"name":"Scanned/Image-Only PDF — OCR","capabilityId":"scanned-pdf-ocr","description":"Automated text recognition for image-based documents is not currently implemented.","limitation":"Scanned documents require manual transcription."},{"name":"XLSX / CSV","capabilityId":"spreadsheet-import","description":"Supported structured spreadsheet formats, subject to mapping and review."},{"name":"CAD / BIM / IFC","capabilityId":"model-file-import","description":"Model-based extraction is not currently available."}],
  supportedOutputs: [{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Structured spreadsheet output for further professional use."},{"name":"PDF Generation","capabilityId":"professional-outputs","description":"Reviewable documents generated from stored data and available templates."},{"name":"Technical Reports","capabilityId":"technical-report-generation","description":"DOCX technical reports generated from stored project records and templates in supported configured environments.","limitation":"Reports can contain unreviewed records and require professional checking; durable production storage must be confirmed during Controlled Early Access."}],
  limitations: ["Quantara does not automatically determine final project costs.","It does not perform visual drawing measurement or automatic takeoff from floor plans.","Results vary with the clarity and structure of supported source documents."],
  faqs: [{"question":"What is AI BOQ software?","answer":"AI BOQ software uses artificial intelligence to help capture and organize supported construction data from sources such as text-based PDFs into a structured format."},{"question":"Can AI create a BOQ?","answer":"AI can assist with supported capture and structuring, but a qualified professional must review, refine and approve the final BOQ."},{"question":"Can AI read scanned BOQ files?","answer":"Not yet. Quantara detects scanned or image-based PDFs and flags them as requiring OCR, but OCR text recognition is not currently available. Scanned content currently requires manual transcription."},{"question":"Is AI BOQ software the same as quantity takeoff software?","answer":"No. Quantity takeoff software typically focuses on measuring dimensions from drawings. Quantara focuses on supported capture and management of structured text and BOQ data."},{"question":"Can AI replace a quantity surveyor?","answer":"No. Quantara supports quantity surveyors with structured workflows; it does not replace professional judgment, commercial context or strategic decision-making."},{"question":"How should AI-extracted quantities be reviewed?","answer":"All captured quantities, units and descriptions must be manually verified against the original source documents by a qualified professional."},{"question":"Does Quantara measure drawings automatically?","answer":"No. Quantara does not currently support automatic drawing measurement or object counting."},{"question":"Which files can Quantara currently process?","answer":"Quantara currently captures supported data from text-based PDFs, XLSX and CSV files. Scanned or image-only PDFs are detected and flagged as requiring OCR, but OCR text extraction is not currently available."}],
  relatedPages: [{"href":"/boq-software","label":"BOQ Software","description":"Learn about structured BOQ management and revisions."},{"href":"/pdf-boq-extraction","label":"PDF BOQ Extraction","description":"Deep dive into processing text-based PDF documents."},{"href":"/scanned-pdf-boq","label":"Scanned PDF Processing","description":"How Quantara detects image-based documents today and the current OCR limitation."},{"href":"/boq-management","label":"BOQ Management","description":"Controlling project records and templates."},{"href":"/features","label":"Product Features","description":"View the complete list of available and unavailable capabilities."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/ai-boq-software" />;
}
