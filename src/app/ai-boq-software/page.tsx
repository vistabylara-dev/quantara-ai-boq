import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "AI BOQ Software for Structured Construction Workflows | Quantara",
  description: "Explore how Quantara uses AI-assisted document extraction and structured workflows to help construction teams organize, review and generate professional BOQ records.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/ai-boq-software",
  },
  openGraph: {
    title: "AI BOQ Software for Structured Construction Workflows | Quantara",
    description: "Explore how Quantara uses AI-assisted document extraction and structured workflows to help construction teams organize, review and generate professional BOQ records.",
    url: "https://quantara.vistabylara.com/ai-boq-software",
    siteName: "Quantara",
  },
  twitter: {
    title: "AI BOQ Software for Structured Construction Workflows | Quantara",
    description: "Explore how Quantara uses AI-assisted document extraction and structured workflows to help construction teams organize, review and generate professional BOQ records.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "AI BOQ Software",
  h1: "AI BOQ Software for Structured, Human-Reviewed Project Workflows",
  directDefinition: "AI BOQ software integrates artificial intelligence to assist construction professionals in extracting, structuring, and organizing project records from source documents, significantly reducing manual data entry while maintaining strict requirements for human review.",
  audience: {
    heading: "Who Uses AI BOQ Software?",
    content: "Quantara is built for professionals who require structured project records and controlled documentation.",
    items: ["Contractors managing multiple tender submissions","Estimators structuring complex project scope","Quantity surveyors reviewing extracted quantities","MEP teams organizing specialized disciplines"]
  },
  workflowProblem: {
    heading: "The Challenge of Manual BOQ Workflows",
    paragraphs: ["Construction projects begin with complex, unstructured documents. Traditionally, estimating teams spend countless hours manually copying data from text-based PDFs or scanned files into spreadsheets. This process is not only tedious but prone to data entry errors that can cascade into significant commercial risks.","Furthermore, simple OCR tools often fail to understand the complex hierarchy and nested structure of a true Bill of Quantities, leaving teams with disjointed data that still requires massive manual reformatting."]
  },
  quantaraSupport: {
    heading: "How Quantara Transforms the Workflow",
    paragraphs: ["Quantara acts as an AI-assisted workflow bridge. It extracts tabular data and item descriptions from supported formats and helps organize them into a structured BOQ database.","Instead of replacing the professional estimator, Quantara removes the manual data entry phase, allowing the human expert to focus immediately on commercial review, rate application, and project strategy."]
  },
  relevantFeatures: [{"name":"Document Extraction","status":"Live","description":"Extract tables and items from text-based PDFs and spreadsheets."},{"name":"Scanned OCR Extraction","status":"Live","description":"Process image-based PDFs with OCR assistance."},{"name":"Structured Workspaces","status":"Live","description":"Organize items into hierarchical sections and trades."}],
  workflowExample: {
    heading: "Practical AI Extraction Workflow",
    introduction: "A typical workflow for processing a consultant’s tender package:",
    steps: [{"title":"Upload Source","description":"The estimator uploads a 50-page text-based PDF containing the structural BOQ."},{"title":"AI Extraction","description":"Quantara identifies tables, item descriptions, quantities, and units."},{"title":"Human Review","description":"The estimator reviews the extracted data line-by-line for accuracy."},{"title":"Structuring","description":"Items are organized into the company's standard template."},{"title":"Output Generation","description":"A structured XLSX file is exported for final pricing."}]
  },
  supportedInputs: [{"name":"Text-based PDF","status":"Live","description":"Standard PDFs with selectable text and defined tables."},{"name":"Scanned PDF","status":"Live","description":"Image-based documents processed via OCR."},{"name":"XLSX / CSV","status":"Live","description":"Standard spreadsheet formats."},{"name":"CAD / BIM / IFC","status":"Planned","description":"Model-based extraction.","limitation":"Capability and processing method to be confirmed after technical validation."}],
  supportedOutputs: [{"name":"XLSX Export","status":"Live","description":"Structured spreadsheet output."},{"name":"PDF Generation","status":"Live","description":"Professional document generation."},{"name":"Technical Reports","status":"Live","description":"Formatted project summaries."}],
  limitations: ["Quantara does not automatically calculate final project costs.","It does not perform visual drawing measurement or automatic takeoff from floor plans.","AI extraction requires clear, legible source documents for optimal results."],
  faqs: [{"question":"What is AI BOQ software?","answer":"AI BOQ software uses artificial intelligence to help extract and organize construction data from unstructured documents like PDFs into a structured database format."},{"question":"Can AI create a BOQ?","answer":"AI can assist in extracting and structuring information from source documents, but a qualified professional must always review, refine, and approve the final BOQ."},{"question":"Can AI read scanned BOQ files?","answer":"Yes, Quantara includes OCR capabilities to process scanned or image-based PDFs, though extraction quality depends heavily on the scan resolution."},{"question":"Is AI BOQ software the same as quantity takeoff software?","answer":"No. Quantity takeoff software typically focuses on measuring dimensions from drawings. Quantara focuses on extracting and managing structured data and text from specification and BOQ documents."},{"question":"Can AI replace a quantity surveyor?","answer":"No. Quantara is designed to support quantity surveyors by reducing manual data entry, not to replace their professional judgment, commercial context, or strategic decision-making."},{"question":"How should AI-extracted quantities be reviewed?","answer":"All extracted quantities, units, and descriptions must be manually verified against the original source documents by a qualified professional."},{"question":"Does Quantara measure drawings automatically?","answer":"No, Quantara does not currently support automatic drawing measurement or object counting."},{"question":"Which files can Quantara currently process?","answer":"Quantara currently processes text-based PDFs, scanned PDFs, XLSX, and CSV files."}],
  relatedPages: [{"href":"/boq-software","label":"BOQ Software","description":"Learn about structured BOQ management and revisions."},{"href":"/pdf-boq-extraction","label":"PDF BOQ Extraction","description":"Deep dive into processing text-based PDF documents."},{"href":"/scanned-pdf-boq","label":"Scanned PDF Processing","description":"How OCR assists with image-based document extraction."},{"href":"/boq-management","label":"BOQ Management","description":"Controlling project records and templates."},{"href":"/features","label":"Product Features","description":"View the complete list of live and planned features."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/ai-boq-software" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/ai-boq-software#webpage",
                "url": "https://quantara.vistabylara.com/ai-boq-software",
                "name": "AI BOQ Software for Structured Construction Workflows | Quantara",
                "description": "Explore how Quantara uses AI-assisted document extraction and structured workflows to help construction teams organize, review and generate professional BOQ records.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/ai-boq-software#breadcrumb",
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
                    "name": "AI BOQ Software"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/ai-boq-software#faq",
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
