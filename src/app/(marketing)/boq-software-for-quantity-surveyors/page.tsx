import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Quantity Surveyors and Commercial Review",
  description: "Support quantity-surveying workflows with structured BOQs, document extraction, revisions, project records, templates and professionally reviewed outputs.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-quantity-surveyors",
  },
  openGraph: {
    title: "BOQ Software for Quantity Surveyors and Commercial Review | Quantara",
    description: "Support quantity-surveying workflows with structured BOQs, document extraction, revisions, project records, templates and professionally reviewed outputs.",
    url: "https://quantara.vistabylara.com/boq-software-for-quantity-surveyors",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software for Quantity Surveyors and Commercial Review | Quantara",
    description: "Support quantity-surveying workflows with structured BOQs, document extraction, revisions, project records, templates and professionally reviewed outputs.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Quantity Surveyors",
    title: "BOQ Software for Quantity Surveyors Managing Structured Project Records",
    audienceDescription: "Built for professional quantity surveyors and commercial managers looking for reliable BOQ review, revision control, and document management.",
    directAnswer: "Quantara provides quantity surveyors with a structured platform to organize BOQ preparation, manage tender documentation, and maintain rigorous revision control.",
    challenges: [
  {
    "title": "Version Control Chaos",
    "description": "Tracking changes across multiple tender addenda and consultant revisions often leads to pricing outdated scope."
  },
  {
    "title": "Document Extraction Burden",
    "description": "Manually verifying and extracting item descriptions and quantities from unstructured client PDFs is highly prone to transcription errors."
  }
],
    workflowDescription: "Quantara assists quantity surveyors by structuring project records. It provides tools to manage BOQ preparation, review quantities, track item descriptions, and explicitly record assumptions and exclusions. This ensures a clear audit trail for commercial review and professional responsibility.",
    workflowExample: "A quantity surveyor receives a revised consultant BOQ in PDF format. Before issuing it for tender, they use Quantara to extract the document, structure the items, and formally lock it as Revision 2, ensuring a clean, verifiable record for all bidders.",
    typicalCategories: [
  "Substructure",
  "Superstructure",
  "Internal Finishes",
  "External Works",
  "Provisional Sums",
  "Prime Cost Sums",
  "Preliminaries"
],
    supportedInputs: [
  "Text-based PDF",
  "Scanned PDF",
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
  "Quantara does not replace measurement judgment or regulated QS practice.",
  "Quantara does not perform automated drawing measurement.",
  "Professional review of all extracted outputs is strictly required."
],
    faqs: [
  {
    "question": "Does Quantara replace a quantity surveyor?",
    "answer": "Absolutely not. Quantara is an assistive workflow tool. Professional judgment and regulated QS practice remain entirely the responsibility of the user."
  },
  {
    "question": "How does it help with commercial review?",
    "answer": "By structuring the BOQ data and maintaining revision histories, quantity surveyors can more easily audit changes, spot anomalies, and review exclusions."
  },
  {
    "question": "Can I track BOQ assumptions?",
    "answer": "Yes, assumptions and exclusions can be documented and linked to specific BOQ revisions to provide a clear commercial record."
  },
  {
    "question": "Are standard measurement rules (e.g., NRM) built-in?",
    "answer": "No, Quantara provides the structural framework, but the quantity surveyor applies the relevant measurement rules and descriptions."
  },
  {
    "question": "How are tender documents managed?",
    "answer": "Documents can be extracted and organized into distinct project records, ensuring the BOQ matches the specific tender issue."
  },
  {
    "question": "Does it support scanned consultant PDFs?",
    "answer": "Yes, OCR is available for scanned PDFs, but rigorous human review of the extracted quantities and units is mandatory."
  },
  {
    "question": "Can consultants manage multiple project revisions?",
    "answer": "Yes, the platform includes revision control to manage multiple versions of a BOQ as a project evolves."
  },
  {
    "question": "Can I export the data for other QS software?",
    "answer": "Yes, structured data can be exported to Excel (XLSX) or CSV for use in dedicated measurement or cost-planning software."
  }
],
    relatedPages: [
  {
    "href": "/quantity-surveying-software",
    "label": "Quantity Surveying Software"
  },
  {
    "href": "/boq-management",
    "label": "BOQ Management"
  },
  {
    "href": "/boq-revision-control",
    "label": "BOQ Revision Control"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "How to Review an AI-Extracted BOQ"
  },
  {
    "href": "/about",
    "label": "About Quantara"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": "https://quantara.vistabylara.com/boq-software-for-quantity-surveyors",
          "url": "https://quantara.vistabylara.com/boq-software-for-quantity-surveyors",
          "name": "BOQ Software for Quantity Surveyors and Commercial Review | Quantara",
          "description": "Support quantity-surveying workflows with structured BOQs, document extraction, revisions, project records, templates and professionally reviewed outputs."
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
              "name": "BOQ Software for Quantity Surveyors",
              "item": "https://quantara.vistabylara.com/boq-software-for-quantity-surveyors"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Does Quantara replace a quantity surveyor?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Absolutely not. Quantara is an assistive workflow tool. Professional judgment and regulated QS practice remain entirely the responsibility of the user."
    }
  },
  {
    "@type": "Question",
    "name": "How does it help with commercial review?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "By structuring the BOQ data and maintaining revision histories, quantity surveyors can more easily audit changes, spot anomalies, and review exclusions."
    }
  },
  {
    "@type": "Question",
    "name": "Can I track BOQ assumptions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, assumptions and exclusions can be documented and linked to specific BOQ revisions to provide a clear commercial record."
    }
  },
  {
    "@type": "Question",
    "name": "Are standard measurement rules (e.g., NRM) built-in?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara provides the structural framework, but the quantity surveyor applies the relevant measurement rules and descriptions."
    }
  },
  {
    "@type": "Question",
    "name": "How are tender documents managed?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Documents can be extracted and organized into distinct project records, ensuring the BOQ matches the specific tender issue."
    }
  },
  {
    "@type": "Question",
    "name": "Does it support scanned consultant PDFs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, OCR is available for scanned PDFs, but rigorous human review of the extracted quantities and units is mandatory."
    }
  },
  {
    "@type": "Question",
    "name": "Can consultants manage multiple project revisions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, the platform includes revision control to manage multiple versions of a BOQ as a project evolves."
    }
  },
  {
    "@type": "Question",
    "name": "Can I export the data for other QS software?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, structured data can be exported to Excel (XLSX) or CSV for use in dedicated measurement or cost-planning software."
    }
  }
]
        }
      ]
    }
  };

  return <IndustryLandingPage content={content} />;
}
