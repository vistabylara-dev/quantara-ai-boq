import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "Scanned PDF BOQ Detection | OCR Planned",
  description: "Quantara detects scanned and image-only PDF BOQs and flags them for review today. Automated OCR text extraction is planned and not yet available.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/scanned-pdf-boq",
  },
  openGraph: {
    title: "Scanned PDF BOQ Detection | OCR Planned | Quantara",
    description: "Quantara detects scanned and image-only PDF BOQs and flags them for review today. Automated OCR text extraction is planned and not yet available.",
    url: "https://quantara.vistabylara.com/scanned-pdf-boq",
    siteName: "Quantara",
  },
  twitter: {
    title: "Scanned PDF BOQ Detection | OCR Planned | Quantara",
    description: "Quantara detects scanned and image-only PDF BOQs and flags them for review today. Automated OCR text extraction is planned and not yet available.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "Scanned PDF Processing",
  h1: "Scanned & Image-Only PDF BOQ Handling",
  directDefinition: "A scanned or image-only PDF is a photograph of a document rather than digital text a computer can read directly. Quantara automatically detects these files and their page-level content type today. Automated Optical Character Recognition (OCR) to extract their text is planned and not yet implemented.",
  audience: {
    heading: "Who Encounters Scanned BOQs?",
    content: "Teams working with legacy documents or physical tender packages regularly receive scanned or image-only PDFs.",
    items: ["Estimators receiving physical printouts","Contractors archiving legacy project data","Consultants processing third-party hardcopies","Subcontractors dealing with faxed or low-quality scans"]
  },
  workflowProblem: {
    heading: "The Challenge of Image-Based Documents",
    paragraphs: ["Unlike text-based PDFs where the digital characters are stored in the file, a scanned PDF is essentially just a photograph of a document. Computers cannot natively \"read\" photographs, making standard copy-pasting impossible.","When dealing with scanned BOQs, teams face issues like page skew (crooked scanning), blurred text, coffee stains, and handwritten annotations. Converting this back into a structured spreadsheet manually can take weeks for a large project."]
  },
  quantaraSupport: {
    heading: "What Quantara Does With Scanned PDFs Today",
    paragraphs: ["Quantara rasterizes every PDF page and automatically classifies it as text-based, scanned/image-only, or mixed. Scanned and image-only pages are clearly flagged as requiring OCR — no text is invented or guessed for them.","Automated OCR text recognition is planned but not yet implemented. Until it ships, scanned BOQ content must be transcribed manually by your team; the original rendered page image remains available so nothing is lost or misrepresented."]
  },
  relevantFeatures: [{"name":"Scanned/Image-Only Detection","status":"Live","description":"Automatically identifies scanned and image-only PDF pages and flags them as requiring OCR."},{"name":"OCR Text Recognition","status":"Planned","description":"Automated conversion of image-based text into selectable digital data is not yet available."},{"name":"Manual Review Requirement","status":"Live","description":"All extracted and manually entered data requires professional human review before commercial use."}],
  workflowExample: {
    heading: "Handling a Legacy Scanned BOQ Today",
    introduction: "How a team currently works with a physical tender package before OCR ships:",
    steps: [{"title":"Scan & Upload","description":"The physical document is scanned to PDF and uploaded."},{"title":"Automatic Detection","description":"Quantara rasterizes the pages and flags them as scanned/image-only, requiring OCR."},{"title":"Manual Transcription","description":"Since automated OCR is not yet available, the team manually transcribes quantities and descriptions from the page images."},{"title":"Data Structuring","description":"The transcribed data is organized into the digital BOQ hierarchy."},{"title":"Professional Review","description":"A qualified professional verifies every transcribed item before commercial use."}]
  },
  supportedInputs: [{"name":"Scanned/Image-Only PDF — Detection","status":"Live","description":"Identifies scanned pages and flags them as requiring OCR; no text is extracted from them yet."},{"name":"Scanned/Image-Only PDF — OCR","status":"Planned","description":"Automated text recognition for scanned pages is not yet implemented.","limitation":"Scanned content currently requires manual transcription."},{"name":"Text-based PDF","status":"Live","description":"Digital PDFs with a real, extractable text layer."}],
  supportedOutputs: [{"name":"Structured Database","status":"Live","description":"Centralized project storage."},{"name":"XLSX Export","status":"Live","description":"Exporting clean, tabular data to Excel."}],
  limitations: ["Automated OCR for scanned/image-only PDFs is not yet implemented — affected content must currently be transcribed manually.","Scanned/image-only detection does not attempt to guess or reconstruct text — it honestly reports that OCR is required.","When OCR ships, accuracy is still expected to require professional review, especially for numeric quantities."],
  faqs: [{"question":"What is a scanned PDF?","answer":"A scanned PDF is an image-based file (like a photograph) where the text cannot be highlighted or selected by a computer natively."},{"question":"Does Quantara currently OCR scanned BOQ documents?","answer":"Not yet. Quantara detects and flags scanned/image-only pages today, but automated OCR text recognition is planned and not yet implemented. Scanned content currently requires manual transcription."},{"question":"Will OCR results need review once available?","answer":"Yes. Once implemented, OCR is expected to occasionally confuse visually similar characters, such as 1 and l, or 0 and O. Strict manual, item-by-item review will be required, exactly as it is for all data in Quantara today."},{"question":"Will image resolution matter for future OCR?","answer":"Yes — once OCR ships, higher-resolution scans (300 DPI or higher) are expected to produce meaningfully better results, consistent with how OCR technology generally performs."},{"question":"Will handwritten BOQs be supported?","answer":"Standard OCR technology, once implemented, is expected to struggle with handwriting. Handwritten BOQs will likely still require manual data entry."},{"question":"How is manually transcribed scanned data checked today?","answer":"Every item, unit, and quantity transcribed from a scanned document must be manually cross-referenced against the original page image, exactly like any other data entered into Quantara."},{"question":"Can scanned documents be exported?","answer":"Once the data is transcribed today (or extracted via OCR once available), reviewed, and structured, it can be exported to standard formats like XLSX."},{"question":"Does Quantara perform drawing takeoff?","answer":"No, Quantara does not perform automated measurement or takeoff from scanned drawings."}],
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
                "name": "Scanned PDF BOQ Detection | OCR Planned | Quantara",
                "description": "Quantara detects scanned and image-only PDF BOQs and flags them for review today. Automated OCR text extraction is planned and not yet available.",
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
