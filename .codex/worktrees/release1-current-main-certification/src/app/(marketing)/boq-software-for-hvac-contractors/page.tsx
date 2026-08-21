import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata: Metadata = {
  title: "HVAC BOQ Software for Contractors and Estimators",
  description: "Structure HVAC BOQ items, equipment, ductwork, piping, insulation, controls and project revisions using Quantara’s document-focused workflow.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-hvac-contractors",
  },
  openGraph: {
    title: "HVAC BOQ Software for Contractors and Estimators | Quantara",
    description: "Structure HVAC BOQ items, equipment, ductwork, piping, insulation, controls and project revisions using Quantara’s document-focused workflow.",
    url: "https://quantara.vistabylara.com/boq-software-for-hvac-contractors",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC BOQ Software for Contractors and Estimators | Quantara",
    description: "Structure HVAC BOQ items, equipment, ductwork, piping, insulation, controls and project revisions using Quantara’s document-focused workflow.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "HVAC BOQ Software",
    title: "HVAC BOQ Software for Structured Estimating and Project Review",
    audienceDescription: "For HVAC contractors and estimators seeking structured workflows to manage ductwork, piping, and equipment BOQs.",
    directAnswer: "Quantara enables HVAC contractors to accurately extract and structure complex BOQs, organizing equipment, ductwork, and piping schedules efficiently.",
    challenges: [
  {
    "title": "Complex Equipment Schedules",
    "description": "HVAC BOQs often rely on extensive, highly technical equipment schedules that are difficult to extract accurately from consultant PDFs."
  },
  {
    "title": "Ductwork and Piping Variations",
    "description": "Managing the sheer volume of item descriptions for various duct sizes, piping materials, and insulation requirements is prone to data-entry errors."
  }
],
    workflowDescription: "With Quantara, HVAC teams can organize equipment schedules, ductwork, piping, insulation, controls, and accessories into a manageable format. The platform supports structured tracking of quantities, units, and testing requirements, ensuring that project revisions are cleanly version-controlled.",
    workflowExample: "An HVAC estimator is reviewing a text-based consultant BOQ alongside an Excel pricing sheet. They use Quantara to extract the ductwork items and structure them into a master BOQ, linking it directly to their internal pricing workflow. A scanned version of the same document would be detected and flagged as requiring OCR, which is planned but not yet available.",
    typicalCategories: [
  "Chillers and AHUs",
  "FCUs and Terminals",
  "Ductwork and Accessories",
  "Chilled Water Piping",
  "Insulation",
  "BMS and Controls",
  "Testing and Balancing"
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
  "Quantara does not provide engineering design validation or compliance approval.",
  "Quantara does not claim drawing-based duct or pipe measurement capabilities.",
  "Advanced supplier and pricing integration workflows are currently in development."
],
    faqs: [
  {
    "question": "Can HVAC BOQ software measure ductwork automatically?",
    "answer": "No, Quantara does not currently perform drawing-based duct or pipe measurement. Automated takeoff is Planned."
  },
  {
    "question": "Does it integrate with supplier pricing databases?",
    "answer": "Direct supplier and live pricing workflows are currently in development. Right now, it focuses on structuring the BOQ data."
  },
  {
    "question": "Can I manage BMS and controls items?",
    "answer": "Yes, BMS and controls can be structured as specific sections within your HVAC BOQ for clear pricing."
  },
  {
    "question": "How do you handle scanned equipment schedules?",
    "answer": "Scanned equipment schedules are detected and flagged as requiring OCR today; automated OCR text extraction is planned and not yet available, so scanned schedules currently require manual transcription and careful review by an HVAC professional."
  },
  {
    "question": "Does Quantara validate HVAC design?",
    "answer": "No, Quantara is a document organization tool and provides no engineering approval or design validation."
  },
  {
    "question": "Can I track testing and commissioning items?",
    "answer": "Yes, testing, balancing, and commissioning can be organized as distinct items or sections within the BOQ."
  },
  {
    "question": "How are ductwork variations handled?",
    "answer": "Different duct sizes and materials are managed as separate, structured items with their respective quantities and units."
  },
  {
    "question": "Is it suitable for both commercial and residential?",
    "answer": "Yes, the structural workflow applies to any HVAC project that requires BOQ management, regardless of size."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-for-mep-contractors",
    "label": "BOQ Software for MEP Contractors"
  },
  {
    "href": "/scanned-pdf-boq",
    "label": "Scanned PDF BOQ"
  },
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  },
  {
    "href": "/boq-document-generation",
    "label": "BOQ Document Generation"
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
          "@id": "https://quantara.vistabylara.com/boq-software-for-hvac-contractors",
          "url": "https://quantara.vistabylara.com/boq-software-for-hvac-contractors",
          "name": "HVAC BOQ Software for Contractors and Estimators | Quantara",
          "description": "Structure HVAC BOQ items, equipment, ductwork, piping, insulation, controls and project revisions using Quantara’s document-focused workflow."
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
              "name": "HVAC BOQ Software",
              "item": "https://quantara.vistabylara.com/boq-software-for-hvac-contractors"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Can HVAC BOQ software measure ductwork automatically?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not currently perform drawing-based duct or pipe measurement. Automated takeoff is Planned."
    }
  },
  {
    "@type": "Question",
    "name": "Does it integrate with supplier pricing databases?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Direct supplier and live pricing workflows are currently in development. Right now, it focuses on structuring the BOQ data."
    }
  },
  {
    "@type": "Question",
    "name": "Can I manage BMS and controls items?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, BMS and controls can be structured as specific sections within your HVAC BOQ for clear pricing."
    }
  },
  {
    "@type": "Question",
    "name": "How do you handle scanned equipment schedules?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Scanned equipment schedules are detected and flagged as requiring OCR today; automated OCR text extraction is planned and not yet available, so scanned schedules currently require manual transcription and careful review by an HVAC professional."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara validate HVAC design?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara is a document organization tool and provides no engineering approval or design validation."
    }
  },
  {
    "@type": "Question",
    "name": "Can I track testing and commissioning items?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, testing, balancing, and commissioning can be organized as distinct items or sections within the BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "How are ductwork variations handled?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Different duct sizes and materials are managed as separate, structured items with their respective quantities and units."
    }
  },
  {
    "@type": "Question",
    "name": "Is it suitable for both commercial and residential?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, the structural workflow applies to any HVAC project that requires BOQ management, regardless of size."
    }
  }
]
        }
      ]
    }
  };

  return <IndustryLandingPage content={content} />;
}
