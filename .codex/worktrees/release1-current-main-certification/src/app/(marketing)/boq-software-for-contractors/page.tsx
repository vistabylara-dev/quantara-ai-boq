import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Contractors and Construction Teams",
  description: "Organize project documents, BOQ sections, quantities, revisions, templates and professional outputs with Quantara’s contractor-focused BOQ workflow platform.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-contractors",
  },
  openGraph: {
    title: "BOQ Software for Contractors and Construction Teams | Quantara",
    description: "Organize project documents, BOQ sections, quantities, revisions, templates and professional outputs with Quantara’s contractor-focused BOQ workflow platform.",
    url: "https://quantara.vistabylara.com/boq-software-for-contractors",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software for Contractors and Construction Teams | Quantara",
    description: "Organize project documents, BOQ sections, quantities, revisions, templates and professional outputs with Quantara’s contractor-focused BOQ workflow platform.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Contractors",
    title: "BOQ Software for Contractors Managing Complex Project Information",
    audienceDescription: "Designed for general contractors and subcontractors looking for structured BOQ and estimating workflows to manage project documentation effectively.",
    directAnswer: "Quantara provides contractors with a structured BOQ workflow platform to organize tender documents, subcontractor packages, and project revisions in one place.",
    challenges: [
  {
    "title": "Fragmented Tender Documents",
    "description": "Contractors often receive unstructured PDFs, Excel files, and printed schedules that must be manually consolidated before any pricing can begin."
  },
  {
    "title": "Scope Coordination",
    "description": "Managing multiple subcontractor packages and ensuring no scope overlaps or omissions occur is difficult without a centralized, version-controlled BOQ."
  }
],
    workflowDescription: "Quantara allows contractors to import tender documents and organize them into structured BOQ records. From handling item descriptions and units to tracking assumptions and exclusions, contractors can build a reliable foundation for internal review, proposal generation, and tender preparation.",
    workflowExample: "A general contractor receives a mixed PDF and Excel tender package for a commercial build. Instead of manually retyping the data into a master pricing spreadsheet, they use Quantara to extract the PDF items, merge them with the Excel data, and organize the BOQ into distinct trade packages for their subcontractors.",
    typicalCategories: [
  "Preliminaries",
  "Civil Works",
  "Architectural Works",
  "MEP Packages",
  "Finishes",
  "Provisional Items",
  "Exclusions",
  "Alternates"
],
    supportedInputs: [
  "Text-based PDF",
  "Scanned PDF (detection only — OCR planned)",
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
  "Quantara does not currently perform automated visual quantity takeoff or drawing measurement.",
  "BIM and CAD integrations remain in the Planned phase.",
  "Quantara does not provide pre-built cost databases or universal category structures."
],
    faqs: [
  {
    "question": "Can contractors organize subcontractor scope with Quantara?",
    "answer": "Yes, contractors can structure their BOQ into distinct packages, making it easier to manage subcontractor scopes and pricing."
  },
  {
    "question": "Does Quantara measure quantities from drawings?",
    "answer": "No, automated drawing measurement and visual quantity takeoff are currently Planned features and not active."
  },
  {
    "question": "How are assumptions and exclusions handled?",
    "answer": "Contractors can document assumptions and exclusions directly alongside the relevant BOQ sections to ensure clarity during internal review."
  },
  {
    "question": "Can I export a priced proposal for a client?",
    "answer": "Yes, Quantara supports generating professional PDF proposals and structured Excel files from your managed BOQ data."
  },
  {
    "question": "Does it support scanned tender documents?",
    "answer": "Scanned tender documents can be uploaded and are automatically detected and flagged as requiring OCR. Automated OCR text extraction is planned and not yet available, so scanned content currently requires manual transcription and professional review."
  },
  {
    "question": "Is there a pre-built category structure?",
    "answer": "No, categories are user-defined. Quantara provides the structure, but you define the specific trades and packages."
  },
  {
    "question": "How are BOQ revisions tracked?",
    "answer": "Quantara maintains a revision history, allowing contractors to track changes to quantities and scope as new tender addenda are issued."
  },
  {
    "question": "Does Quantara replace our estimating software?",
    "answer": "Quantara focuses on the BOQ structuring and document workflow. It is designed to complement your existing pricing and estimating tools."
  }
],
    relatedPages: [
  {
    "href": "/boq-software",
    "label": "BOQ Software"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/how-to-prepare-a-boq",
    "label": "How to Prepare a BOQ"
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
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": "https://quantara.vistabylara.com/boq-software-for-contractors",
          "url": "https://quantara.vistabylara.com/boq-software-for-contractors",
          "name": "BOQ Software for Contractors and Construction Teams | Quantara",
          "description": "Organize project documents, BOQ sections, quantities, revisions, templates and professional outputs with Quantara’s contractor-focused BOQ workflow platform."
        },
        {
          "@type": "BreadcrumbList",
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
              "name": "Industries",
              "item": "https://quantara.vistabylara.com/industries"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": "BOQ Software for Contractors",
              "item": "https://quantara.vistabylara.com/boq-software-for-contractors"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Can contractors organize subcontractor scope with Quantara?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, contractors can structure their BOQ into distinct packages, making it easier to manage subcontractor scopes and pricing."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara measure quantities from drawings?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, automated drawing measurement and visual quantity takeoff are currently Planned features and not active."
    }
  },
  {
    "@type": "Question",
    "name": "How are assumptions and exclusions handled?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Contractors can document assumptions and exclusions directly alongside the relevant BOQ sections to ensure clarity during internal review."
    }
  },
  {
    "@type": "Question",
    "name": "Can I export a priced proposal for a client?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara supports generating professional PDF proposals and structured Excel files from your managed BOQ data."
    }
  },
  {
    "@type": "Question",
    "name": "Does it support scanned tender documents?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Scanned tender documents can be uploaded and are automatically detected and flagged as requiring OCR. Automated OCR text extraction is planned and not yet available, so scanned content currently requires manual transcription and professional review."
    }
  },
  {
    "@type": "Question",
    "name": "Is there a pre-built category structure?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, categories are user-defined. Quantara provides the structure, but you define the specific trades and packages."
    }
  },
  {
    "@type": "Question",
    "name": "How are BOQ revisions tracked?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara maintains a revision history, allowing contractors to track changes to quantities and scope as new tender addenda are issued."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara replace our estimating software?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara focuses on the BOQ structuring and document workflow. It is designed to complement your existing pricing and estimating tools."
    }
  }
]
        }
      ]
    }
  };

  return <IndustryLandingPage content={content} />;
}
