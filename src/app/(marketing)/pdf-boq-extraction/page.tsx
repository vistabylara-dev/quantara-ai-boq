import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "PDF BOQ Extraction for Construction Documents",
  description: "Extract and organize supported BOQ information from text-based PDF documents using Quantara’s AI-assisted, professionally reviewed workflow.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/pdf-boq-extraction",
  },
  openGraph: {
    title: "PDF BOQ Extraction for Construction Documents | Quantara",
    description: "Extract and organize supported BOQ information from text-based PDF documents using Quantara’s AI-assisted, professionally reviewed workflow.",
    url: "https://quantara.vistabylara.com/pdf-boq-extraction",
    siteName: "Quantara",
  },
  twitter: {
    title: "PDF BOQ Extraction for Construction Documents | Quantara",
    description: "Extract and organize supported BOQ information from text-based PDF documents using Quantara’s AI-assisted, professionally reviewed workflow.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "PDF BOQ Extraction",
  h1: "AI-Assisted PDF BOQ Extraction with Structured Human Review",
  directDefinition: "PDF BOQ extraction is the process of reliably parsing tabular data, item descriptions, and quantities from text-based PDF documents and converting them into a structured database for commercial use.",
  audience: {
    heading: "Who Benefits from PDF Extraction?",
    content: "This workflow is essential for professionals dealing with consultant-issued tender packages in PDF format.",
    items: ["Estimators receiving uneditable tender documents","Contractors standardizing incoming BOQs","Quantity Surveyors preparing measurement files","Subcontractors isolating their specific trade scope"]
  },
  workflowProblem: {
    heading: "The Problem with PDF Tables",
    paragraphs: ["Consultants often issue final Bills of Quantities as PDF documents to prevent tampering. While secure, this makes the contractor's job exceptionally difficult. Standard copy-pasting from a PDF table into Excel often destroys the formatting, merges rows, and misaligns quantities with their descriptions.","Complex tables with multi-line item descriptions, merged headers, and implicit hierarchy (where sub-items belong to a parent item) are notoriously difficult for standard OCR or extraction tools to parse correctly."]
  },
  quantaraSupport: {
    heading: "Intelligent Table Parsing",
    paragraphs: ["Quantara is specifically designed to handle the complex structure of construction BOQs. It identifies table boundaries, respects multi-line descriptions that span across page breaks, and maintains the alignment between an item, its unit of measure, and its quantity.","Because no extraction is perfect, Quantara pairs its AI extraction with a side-by-side review interface, forcing the human estimator to verify the extracted data against the original PDF before it enters the structured database."]
  },
  relevantFeatures: [{"name":"Table Boundary Detection","status":"Live","description":"Automatically identify tabular data within text-based PDFs."},{"name":"Multi-page Processing","status":"Live","description":"Handle long tables that break across multiple PDF pages."},{"name":"Side-by-Side Review","status":"Preview UI","description":"Compare the original PDF alongside the extracted data."}],
  workflowExample: {
    heading: "Extracting a 100-Page Tender",
    introduction: "How an estimator processes a massive tender document:",
    steps: [{"title":"Upload Files and/or Connect Applications","description":"The 100-page text-based PDF is uploaded to the Quantara workspace."},{"title":"AI Parsing","description":"The system identifies all tables and extracts the raw text and quantities."},{"title":"Error Flagging","description":"Quantara highlights merged cells or unusual formatting for manual review."},{"title":"Human Validation","description":"The estimator manually corrects any misaligned items."},{"title":"Database Commit","description":"The validated data is committed to the structured project BOQ."}]
  },
  supportedInputs: [{"name":"Text-based PDF","status":"Live","description":"Digital PDFs exported directly from Word or Excel."},{"name":"Scanned/Image-Only PDF — Detection","status":"Live","description":"Identifies image-based PDFs and flags them as requiring OCR; no text is extracted from them yet."},{"name":"Scanned/Image-Only PDF — OCR","status":"Planned","description":"Automated text recognition for image-based PDFs is not yet implemented.","limitation":"Scanned PDFs currently require manual transcription."}],
  supportedOutputs: [{"name":"Structured Database","status":"Live","description":"Centralized project storage."},{"name":"XLSX Export","status":"Live","description":"Exporting clean, tabular data to Excel."}],
  limitations: ["Quantara cannot magically fix a PDF that is fundamentally illegible or corrupted.","Extraction accuracy is highly dependent on the layout complexity of the source document.","It does not measure quantities from construction drawings."],
  faqs: [{"question":"Can Quantara extract BOQ tables from PDF?","answer":"Yes, Quantara is specifically designed to extract tabular data, descriptions, and quantities from construction PDFs."},{"question":"What is a text-based PDF?","answer":"A text-based PDF is a document created digitally (e.g., exported from Word or Excel) where the text can be highlighted and selected with a cursor, unlike a scanned image."},{"question":"Can complex tables be extracted?","answer":"Yes, Quantara handles complex tables, though highly irregular formatting may require manual correction during the review phase."},{"question":"What happens with merged cells?","answer":"Merged cells are flagged during extraction for the human reviewer to manually separate or confirm the intended structure."},{"question":"Can quantities be misread?","answer":"Yes. While highly accurate for text-based PDFs, formatting anomalies can cause errors. This is why strict professional review is mandatory."},{"question":"Does PDF extraction include drawings?","answer":"No. Quantara extracts text and tables from BOQ and specification documents, not geometry or measurements from technical drawings."},{"question":"Can extracted data be exported?","answer":"Yes, once reviewed, the structured data can be exported to standard XLSX format."},{"question":"What should users review after extraction?","answer":"Users must review all item descriptions, units, and quantities against the source document to ensure 100% accuracy before commercial use."}],
  relatedPages: [{"href":"/scanned-pdf-boq","label":"Scanned PDF Extraction","description":"Handling non-selectable image PDFs."},{"href":"/ai-boq-software","label":"AI BOQ Software","description":"The technology powering the extraction."},{"href":"/boq-management","label":"BOQ Management","description":"What happens to data after extraction."},{"href":"/features","label":"Product Features","description":"View all Quantara features."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/pdf-boq-extraction" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/pdf-boq-extraction#webpage",
                "url": "https://quantara.vistabylara.com/pdf-boq-extraction",
                "name": "PDF BOQ Extraction for Construction Documents | Quantara",
                "description": "Extract and organize supported BOQ information from text-based PDF documents using Quantara’s AI-assisted, professionally reviewed workflow.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/pdf-boq-extraction#breadcrumb",
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
                    "name": "PDF BOQ Extraction"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/pdf-boq-extraction#faq",
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
