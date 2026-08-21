import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/scanned-pdf-boq");



const content: SeoLandingPageContent = {
  breadcrumbLabel: "Scanned PDF Processing",
  h1: "Scanned & Image-Only PDF BOQ Handling",
  directDefinition: "A scanned or image-only PDF contains page images rather than selectable digital text. Quantara detects these pages, but it does not currently extract their text with Optical Character Recognition (OCR).",
  audience: {
    heading: "Who Encounters Scanned BOQs?",
    content: "Teams working with legacy documents or physical tender packages regularly receive scanned or image-only PDFs.",
    items: ["Estimators receiving physical printouts","Contractors archiving legacy project data","Consultants processing third-party hardcopies","Subcontractors dealing with faxed or low-quality scans"]
  },
  workflowProblem: {
    heading: "The Challenge of Image-Based Documents",
    paragraphs: ["Unlike text-based PDFs where digital characters are stored in the file, a scanned PDF contains page images rather than selectable text.","Scanned BOQs can contain skewed or blurred pages and handwritten annotations. Quantara detects image-only pages but does not currently extract their text with OCR, so the team must use a manual transcription and review path."]
  },
  quantaraSupport: {
    heading: "What Quantara Does With Scanned PDFs Today",
    paragraphs: ["Quantara rasterizes PDF pages and classifies them as text-based, scanned/image-only or mixed. Scanned and image-only pages are flagged as requiring OCR; no text is invented or guessed for them.","OCR text recognition is not currently available in Quantara. Scanned BOQ content must be transcribed manually and checked against the rendered source page."]
  },
  relevantFeatures: [{"name":"Scanned/Image-Only Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only pages and reports that text extraction is unavailable."},{"name":"OCR Text Recognition","capabilityId":"scanned-pdf-ocr","description":"Automated conversion of image-based text into selectable digital data is not currently available."},{"name":"Manual Review Requirement","capabilityId":"reviewed-extraction","description":"All manually entered data requires professional review before commercial use."}],
  workflowExample: {
    heading: "Handling a Legacy Scanned BOQ Today",
    introduction: "How a team currently handles a physical tender package without OCR text extraction:",
    steps: [{"title":"Scan & Upload","description":"The physical document is scanned to PDF and uploaded."},{"title":"Automatic Detection","description":"Quantara rasterizes the pages and flags them as scanned/image-only, requiring OCR."},{"title":"Manual Transcription","description":"Since automated OCR is not yet available, the team manually transcribes quantities and descriptions from the page images."},{"title":"Data Structuring","description":"The transcribed data is organized into the digital BOQ hierarchy."},{"title":"Professional Review","description":"A qualified professional verifies every transcribed item before commercial use."}]
  },
  supportedInputs: [{"name":"Scanned/Image-Only PDF — Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only pages and reports that text extraction is unavailable.","limitation":"Quantara does not provide OCR; manual transcription is required."},{"name":"Scanned/Image-Only PDF — OCR","capabilityId":"scanned-pdf-ocr","description":"Automated text recognition for scanned pages is not currently implemented.","limitation":"Scanned content requires manual transcription."},{"name":"Text-based PDF","capabilityId":"text-pdf-extraction","description":"Supported digital PDFs with an existing text layer."}],
  supportedOutputs: [{"name":"Structured Database","capabilityId":"project-workspaces","description":"Authorized project storage for reviewed records."},{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Export reviewed tabular data to XLSX."}],
  limitations: ["Automated OCR for scanned/image-only PDFs is not currently implemented, so affected content must be transcribed manually.","Scanned/image-only detection does not attempt to guess or reconstruct text; it reports that OCR is required.","Every manually transcribed item, unit and quantity requires professional review against the source image."],
  faqs: [{"question":"What is a scanned PDF?","answer":"A scanned PDF is an image-based file whose text cannot be selected as a normal digital text layer."},{"question":"Does Quantara currently OCR scanned BOQ documents?","answer":"No. Quantara detects and flags scanned or image-only pages, but OCR text extraction is not currently available, so the content requires manual transcription."},{"question":"What happens after Quantara detects a scanned page?","answer":"The page is identified as image-only and kept available for review. The project team must use a manual transcription path and compare entered information with the source image."},{"question":"How is manually transcribed scanned data checked?","answer":"Every item, unit and quantity entered from a scanned document should be cross-checked against the original rendered page by the responsible professional."},{"question":"Can manually transcribed scanned information be exported?","answer":"After the information has been entered, reviewed and structured in a supported workflow, it can be included in supported outputs such as XLSX."},{"question":"Does Quantara perform drawing takeoff?","answer":"No. Quantara does not perform automatic measurement or quantity takeoff from scanned drawings."}],
  relatedPages: [{"href":"/pdf-boq-extraction","label":"Text-Based Extraction","description":"Processing high-quality digital PDFs."},{"href":"/ai-boq-software","label":"AI BOQ Software","description":"The technology powering the extraction."},{"href":"/boq-management","label":"BOQ Management","description":"Structuring the extracted data."},{"href":"/features","label":"Product Features","description":"View all Quantara features."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/scanned-pdf-boq" />;
}
