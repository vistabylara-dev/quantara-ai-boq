import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software UAE for Contractors and Quantity Surveyors",
  description: "Organize UAE construction BOQ workflows, supported project documents, revisions, templates and professional outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-uae",
  },
  openGraph: {
    title: "BOQ Software UAE for Contractors and Quantity Surveyors | Quantara",
    description: "Organize UAE construction BOQ workflows, supported project documents, revisions, templates and professional outputs using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-uae",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software UAE for Contractors and Quantity Surveyors | Quantara",
    description: "Organize UAE construction BOQ workflows, supported project documents, revisions, templates and professional outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "BOQ Software UAE",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "BOQ Software for UAE Construction and Estimating Teams",
    audienceDescription: "For UAE contractors, estimators and quantity surveyors requiring structured BOQ and project document workflows.",
    directAnswer: "Quantara provides UAE construction teams with a structured platform to organize tender documents, manage consultant revisions, and build project BOQ records.",
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
    workflowDescription: "Quantara supports teams in structuring BOQs from supported documents. It provides version control for revisions, centralizes project templates, and generates professional outputs. While multilingual documents may occur on UAE projects, users manage their own descriptions and records.",
    workflowExample: "A UAE main contractor receives a complex PDF BOQ from a project consultant. They use Quantara to extract the document, structure the items, and apply their company’s controlled template before issuing distinct packages to local subcontractors for pricing.",
    typicalCategories: [
  "Preliminaries",
  "Civil and Structural",
  "Architectural Finishes",
  "MEP Works",
  "Provisional Sums"
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
  "Quantara does not claim UAE compliance or specific regulatory approval.",
  "Quantara does not provide UAE-specific market rates or calculate UAE VAT.",
  "Quantara does not support automated Arabic language translation or native parsing unless explicitly verified in the future."
],
    faqs: [
  {
    "question": "Is Quantara available to UAE construction companies?",
    "answer": "Yes, Quantara is available for UAE-based contractors, estimators, and quantity surveyors to manage their BOQ workflows."
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
    "answer": "Currently, Quantara is optimized for English documents. It does not claim native Arabic OCR or translation support unless explicitly verified."
  },
  {
    "question": "Is Quantara hosted in the UAE?",
    "answer": "Quantara utilizes global cloud infrastructure and does not guarantee specific local data residency in the UAE at this time."
  },
  {
    "question": "Does it comply with Dubai Municipality regulations?",
    "answer": "Quantara is a document workflow tool and does not provide engineering approval or regulatory compliance validation."
  },
  {
    "question": "Can I manage consultant revisions?",
    "answer": "Yes, Quantara includes revision tracking to manage updates from consultants or clients during the tender phase."
  },
  {
    "question": "What does Controlled Early Access mean for regional users?",
    "answer": "It means the platform is active but access is managed to ensure high performance and dedicated support for early adopters."
  },
  {
    "question": "Which file formats are currently supported?",
    "answer": "Quantara supports Text-based PDF, Scanned PDF, XLSX, and CSV imports."
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
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": "https://quantara.vistabylara.com/boq-software-uae",
          "url": "https://quantara.vistabylara.com/boq-software-uae",
          "name": "BOQ Software UAE for Contractors and Quantity Surveyors | Quantara",
          "description": "Organize UAE construction BOQ workflows, supported project documents, revisions, templates and professional outputs using Quantara."
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
              "name": "GCC BOQ Software",
              "item": "https://quantara.vistabylara.com/gcc-boq-software"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": "BOQ Software UAE",
              "item": "https://quantara.vistabylara.com/boq-software-uae"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Is Quantara available to UAE construction companies?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara is available for UAE-based contractors, estimators, and quantity surveyors to manage their BOQ workflows."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara include UAE construction rates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not provide pre-built UAE market rates or pricing databases. Users must apply their own rates to the structured BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara support UAE VAT calculations?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not calculate VAT or other local taxes. It focuses purely on structuring the BOQ items and quantities."
    }
  },
  {
    "@type": "Question",
    "name": "Can Quantara process Arabic BOQ documents?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Currently, Quantara is optimized for English documents. It does not claim native Arabic OCR or translation support unless explicitly verified."
    }
  },
  {
    "@type": "Question",
    "name": "Is Quantara hosted in the UAE?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara utilizes global cloud infrastructure and does not guarantee specific local data residency in the UAE at this time."
    }
  },
  {
    "@type": "Question",
    "name": "Does it comply with Dubai Municipality regulations?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara is a document workflow tool and does not provide engineering approval or regulatory compliance validation."
    }
  },
  {
    "@type": "Question",
    "name": "Can I manage consultant revisions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara includes revision tracking to manage updates from consultants or clients during the tender phase."
    }
  },
  {
    "@type": "Question",
    "name": "What does Controlled Early Access mean for regional users?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "It means the platform is active but access is managed to ensure high performance and dedicated support for early adopters."
    }
  },
  {
    "@type": "Question",
    "name": "Which file formats are currently supported?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara supports Text-based PDF, Scanned PDF, XLSX, and CSV imports."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara replace a local quantity surveyor?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, professional review by a qualified QS or estimator is always required."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
