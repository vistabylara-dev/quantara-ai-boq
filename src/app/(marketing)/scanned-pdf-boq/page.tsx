import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "Scanned PDF BOQ Extraction and OCR Review",
  description: "Process supported scanned BOQ PDFs using OCR-assisted extraction, structured review and professional validation with Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/scanned-pdf-boq",
  },
  openGraph: {
    title: "Scanned PDF BOQ Extraction and OCR Review | Quantara",
    description: "Process supported scanned BOQ PDFs using OCR-assisted extraction, structured review and professional validation with Quantara.",
    url: "https://quantara.vistabylara.com/scanned-pdf-boq",
    siteName: "Quantara",
  },
  twitter: {
    title: "Scanned PDF BOQ Extraction and OCR Review | Quantara",
    description: "Process supported scanned BOQ PDFs using OCR-assisted extraction, structured review and professional validation with Quantara.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "Scanned PDF Processing",
  h1: "Scanned PDF BOQ Processing with OCR-Assisted Review",
  directDefinition: "Scanned PDF processing utilizes Optical Character Recognition (OCR) to identify and extract text and tabular data from image-based documents, converting physical or flattened records into workable digital data.",
  audience: {
    heading: "Who Uses OCR Processing?",
    content: "OCR is vital for teams dealing with legacy documents or physical tender packages.",
    items: ["Estimators receiving physical printouts","Contractors archiving legacy project data","Consultants processing third-party hardcopies","Subcontractors dealing with faxed or low-quality scans"]
  },
  workflowProblem: {
    heading: "The Challenge of Image-Based Documents",
    paragraphs: ["Unlike text-based PDFs where the digital characters are stored in the file, a scanned PDF is essentially just a photograph of a document. Computers cannot natively \"read\" photographs, making standard copy-pasting impossible.","When dealing with scanned BOQs, teams face issues like page skew (crooked scanning), blurred text, coffee stains, and handwritten annotations. Converting this back into a structured spreadsheet manually can take weeks for a large project."]
  },
  quantaraSupport: {
    heading: "OCR-Assisted Data Recovery",
    paragraphs: ["Quantara applies advanced OCR technology specifically tuned for tabular data. It attempts to reconstruct the grid of the BOQ, identifying columns and rows even when the scan is slightly skewed.","Because OCR is inherently less accurate than text-based extraction—especially with numbers (e.g., misreading a \"0\" as an \"O\", or a \"5\" as an \"S\")—Quantara enforces a strict, item-by-item human review workflow."]
  },
  relevantFeatures: [{"name":"OCR Processing","status":"Live","description":"Convert image-based text into selectable digital data."},{"name":"Skew Correction","status":"Live","description":"Automatically adjust slightly crooked scans."},{"name":"Validation Workflow","status":"Preview UI","description":"Mandatory human review step for OCR results."}],
  workflowExample: {
    heading: "Recovering a Legacy BOQ",
    introduction: "How a team digitizes a physical tender package:",
    steps: [{"title":"Scan & Upload","description":"The physical 50-page document is scanned to PDF and uploaded."},{"title":"OCR Processing","description":"Quantara runs OCR to identify text and table structures."},{"title":"Intensive Review","description":"The estimator carefully checks every quantity, knowing OCR is prone to number confusion."},{"title":"Correction","description":"Misread characters (e.g., 'O' instead of '0') are manually corrected."},{"title":"Data Structuring","description":"The clean data is organized into the digital BOQ hierarchy."}]
  },
  supportedInputs: [{"name":"Scanned PDF","status":"Live","description":"Image-based documents processed via OCR."},{"name":"Text-based PDF","status":"Live","description":"Digital PDFs (processed without OCR for higher accuracy)."}],
  supportedOutputs: [{"name":"Structured Database","status":"Live","description":"Centralized project storage."},{"name":"XLSX Export","status":"Live","description":"Exporting clean, tabular data to Excel."}],
  limitations: ["OCR accuracy drops significantly with low-resolution scans (under 300 DPI).","Heavily skewed, blurred, or crumpled documents may fail extraction entirely.","Handwritten annotations are generally not supported and will require manual entry."],
  faqs: [{"question":"What is a scanned PDF?","answer":"A scanned PDF is an image-based file (like a photograph) where the text cannot be highlighted or selected by a computer natively."},{"question":"How does OCR read BOQ documents?","answer":"OCR (Optical Character Recognition) analyzes the shapes of the ink or pixels in the image and attempts to translate them into digital characters and tables."},{"question":"Can OCR misread quantities?","answer":"Yes. OCR frequently confuses visually similar characters, such as 1 and l, or 0 and O. Strict manual review is absolutely critical."},{"question":"Does image resolution matter?","answer":"Immensely. Scans should ideally be 300 DPI or higher. Low-quality or compressed scans will result in poor extraction."},{"question":"Can handwritten BOQs be processed?","answer":"Standard OCR struggles heavily with handwriting. While it may capture some clear block letters, handwritten BOQs generally require manual data entry."},{"question":"How should scanned results be checked?","answer":"Every single item, unit, and especially quantity must be manually cross-referenced against the original scanned image."},{"question":"Can scanned documents be exported?","answer":"Once the data is extracted, reviewed, and structured, it can be exported to standard formats like XLSX."},{"question":"Does Quantara perform drawing takeoff?","answer":"No, Quantara processes text and tables from scanned documents, not measurements from scanned drawings."}],
  relatedPages: [{"href":"/pdf-boq-extraction","label":"Text-Based Extraction","description":"Processing high-quality digital PDFs."},{"href":"/ai-boq-software","label":"AI BOQ Software","description":"The technology powering the extraction."},{"href":"/boq-management","label":"BOQ Management","description":"Structuring the extracted data."},{"href":"/features","label":"Product Features","description":"View all Quantara features."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/scanned-pdf-boq" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/scanned-pdf-boq#webpage",
                "url": "https://quantara.vistabylara.com/scanned-pdf-boq",
                "name": "Scanned PDF BOQ Extraction and OCR Review | Quantara",
                "description": "Process supported scanned BOQ PDFs using OCR-assisted extraction, structured review and professional validation with Quantara.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/scanned-pdf-boq#breadcrumb",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://quantara.vistabylara.com/"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Scanned PDF Processing"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/scanned-pdf-boq#faq",
                "mainEntity": content.faqs.map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                  }
                }))
              }
            ]
          })
        }}
      />
    </>
  );
}
