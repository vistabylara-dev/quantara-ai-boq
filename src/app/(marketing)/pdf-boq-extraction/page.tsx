import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/pdf-boq-extraction");



const content: SeoLandingPageContent = {
  breadcrumbLabel: "PDF BOQ Extraction",
  h1: "AI-Assisted PDF BOQ Extraction with Structured Human Review",
  directDefinition: "PDF BOQ extraction stores available text from supported text-based PDFs and creates review candidates only from supported detected table rows. Plain paragraphs do not become BOQ candidates, and every result requires professional review.",
  audience: {
    heading: "Who Benefits from PDF Extraction?",
    content: "This workflow can assist professionals dealing with consultant-issued tender packages in text-based PDF format.",
    items: ["Estimators receiving uneditable tender documents","Contractors standardizing incoming BOQs","Quantity Surveyors preparing measurement files","Subcontractors isolating their specific trade scope"]
  },
  workflowProblem: {
    heading: "The Problem with PDF Tables",
    paragraphs: ["Consultants often issue Bills of Quantities as PDF documents to discourage casual editing, but the format alone does not guarantee integrity or prevent tampering. Copying a PDF table into a spreadsheet can also change row, column or description relationships.","Complex tables with multi-line item descriptions, merged headers and implicit hierarchy can require manual reconstruction and professional review after text capture."]
  },
  quantaraSupport: {
    heading: "Intelligent Table Parsing",
    paragraphs: ["Quantara stores the available text layer and applies supported table parsing. Complex layouts, merged cells, implicit hierarchy and tables that continue across pages may require correction.","Only supported detected table rows become review candidates; plain paragraph text remains stored source content. The estimator must compare every candidate with the original PDF before approving structured BOQ data."]
  },
  relevantFeatures: [{"name":"Supported Table Capture","capabilityId":"text-pdf-extraction","description":"Store available text and capture supported detected table structures from text-based PDFs."},{"name":"Page-by-Page PDF Processing","capabilityId":"text-pdf-extraction","description":"Process supported content across PDF pages; table continuity and hierarchy still require review."},{"name":"Source Review","capabilityId":"reviewed-extraction","description":"Open source records and captured results for professional comparison and correction."}],
  workflowExample: {
    heading: "Reviewing a Longer Tender Document",
    introduction: "How an estimator handles a supported text-based tender document:",
    steps: [{"title":"Upload a Supported File","description":"The text-based PDF is added to the authorized Quantara project workspace."},{"title":"Supported Capture","description":"The system stores available text and creates candidates from supported detected table rows."},{"title":"Review Preparation","description":"Table-row candidates are presented for review; plain paragraphs and complex structures may need manual entry or reconstruction."},{"title":"Human Validation","description":"The estimator compares the result with the source and corrects misaligned items."},{"title":"BOQ Confirmation","description":"Reviewed information can then be confirmed into the structured project BOQ."}]
  },
  supportedInputs: [{"name":"Text-based PDF","capabilityId":"text-pdf-extraction","description":"Supported digital PDFs with an existing text layer."},{"name":"Scanned/Image-Only PDF — Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only pages and reports that text extraction is unavailable.","limitation":"Quantara does not provide OCR; manual transcription is required."},{"name":"Scanned/Image-Only PDF — OCR","capabilityId":"scanned-pdf-ocr","description":"Automated text recognition for image-based PDFs is not currently implemented.","limitation":"Scanned PDFs require manual transcription."}],
  supportedOutputs: [{"name":"Structured Database","capabilityId":"project-workspaces","description":"Authorized project and BOQ records."},{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Export reviewed structured data to XLSX."}],
  limitations: ["Illegible, corrupted, scanned or image-only PDFs do not provide extractable text to Quantara's current workflow.","Results depend on the source layout and require professional review and correction.","Quantara does not measure quantities from construction drawings."],
  faqs: [{"question":"Can Quantara extract BOQ tables from PDF?","answer":"Quantara stores available PDF text and creates review candidates from supported detected table rows. Plain paragraph text is not converted into BOQ candidates, and every table result requires review."},{"question":"What is a text-based PDF?","answer":"A text-based PDF is created digitally, for example by exporting from Word or Excel, so its text can usually be selected with a cursor."},{"question":"Can complex tables be extracted?","answer":"Some supported tables can be captured, but irregular formatting, implicit hierarchy and cross-page structures may require manual correction or reconstruction."},{"question":"What happens with merged cells?","answer":"Merged cells can produce ambiguous structure and may require manual separation or reconstruction. Users should not assume the original mapping is preserved."},{"question":"Can quantities be misread?","answer":"Yes. Layout and parsing anomalies can affect descriptions, units and quantities, so strict professional review is mandatory."},{"question":"Does PDF extraction include drawings?","answer":"No. Quantara stores extractable PDF text and creates candidates only from supported detected table rows, not geometry or measurements from technical drawings."},{"question":"Can extracted data be exported?","answer":"Yes, once reviewed, structured data can be exported to XLSX."},{"question":"What should users review after extraction?","answer":"Users must compare item descriptions, units, quantities, hierarchy and totals with the source document before commercial use."}],
  relatedPages: [{"href":"/scanned-pdf-boq","label":"Scanned PDF Handling","description":"How image-only PDFs are detected and flagged for OCR."},{"href":"/ai-boq-software","label":"AI BOQ Software","description":"Review supported AI-assisted capture workflows."},{"href":"/boq-management","label":"BOQ Management","description":"What happens to data after capture and review."},{"href":"/features","label":"Product Features","description":"View current capability statuses and limitations."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/pdf-boq-extraction" />;
}
