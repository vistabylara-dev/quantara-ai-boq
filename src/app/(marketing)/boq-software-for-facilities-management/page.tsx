import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Facilities Management and Service Projects | Quantara",
  description: "Organize maintenance, repair, refurbishment and service BOQ workflows, revisions, templates and project records using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-facilities-management",
  },
  openGraph: {
    title: "BOQ Software for Facilities Management and Service Projects | Quantara",
    description: "Organize maintenance, repair, refurbishment and service BOQ workflows, revisions, templates and project records using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-for-facilities-management",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software for Facilities Management and Service Projects | Quantara",
    description: "Organize maintenance, repair, refurbishment and service BOQ workflows, revisions, templates and project records using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Facilities Management",
    title: "BOQ Software for Facilities Management Projects and Service Scope",
    audienceDescription: "Built for facilities-management (FM) companies handling project-based maintenance, repair, and refurbishment BOQs.",
    directAnswer: "Quantara enables facilities-management companies to structure BOQs for refurbishment projects, maintenance works, and complex service packages.",
    challenges: [
  {
    "title": "Ad-Hoc Project Scopes",
    "description": "FM teams often deal with poorly structured, ad-hoc scopes of work for repairs that are difficult to standardize into professional BOQs."
  },
  {
    "title": "Recurring Service Packages",
    "description": "Recreating BOQs from scratch for similar reactive and planned maintenance tasks wastes significant administrative time."
  }
],
    workflowDescription: "Quantara supports FM workflows by organizing maintenance works, repairs, refurbishment, and both reactive and planned work. Teams can leverage recurring templates for service packages, structure asset-related scope, manage contractor comparisons, and maintain robust project records and revisions.",
    workflowExample: "A facilities-management team is preparing a refurbishment BOQ based on raw site inspection notes and supplier pricing files. They use Quantara's templates to quickly structure a standard refurbishment BOQ, inputting the specific site quantities to generate a formal document for contractor bidding.",
    typicalCategories: [
  "Planned Preventative Maintenance (PPM)",
  "Reactive Repairs",
  "Refurbishment Works",
  "Asset Replacement",
  "Cleaning and Soft Services",
  "MEP Servicing",
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
  "Quantara is not an asset-management system or a CMMS (Computerized Maintenance Management System).",
  "Quantara does not provide live work-order tracking or ticketing.",
  "Quantara focuses strictly on the BOQ and estimating document workflow."
],
    faqs: [
  {
    "question": "Can facilities-management teams reuse BOQ templates?",
    "answer": "Yes, Quantara allows FM teams to save standard BOQ structures as templates, which is ideal for recurring service or refurbishment packages."
  },
  {
    "question": "Is Quantara a CMMS?",
    "answer": "No. Quantara is a BOQ and document workflow platform. It is not a Computerized Maintenance Management System for live ticketing."
  },
  {
    "question": "Can I manage reactive repair BOQs?",
    "answer": "Yes, you can rapidly structure ad-hoc scopes of work into professional BOQs for reactive repairs."
  },
  {
    "question": "How does it help with contractor comparisons?",
    "answer": "By structuring a standardized BOQ, you can issue the same document to multiple contractors, ensuring an \"apples to apples\" comparison."
  },
  {
    "question": "Does it track physical assets?",
    "answer": "No, Quantara manages the documents and BOQ items related to the assets, but it does not track live asset health or inventory."
  },
  {
    "question": "Can I structure PPM schedules?",
    "answer": "You can structure the commercial and pricing elements of a PPM schedule as a BOQ, but it does not execute the actual maintenance scheduling."
  },
  {
    "question": "How are refurbishment projects handled?",
    "answer": "Refurbishments are treated as standard construction BOQs, allowing you to organize demolition, finishes, and MEP works logically."
  },
  {
    "question": "Can I export the data to Excel?",
    "answer": "Yes, structured data can be exported to Excel for integration with other FM or financial systems."
  }
],
    relatedPages: [
  {
    "href": "/boq-management",
    "label": "BOQ Management"
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
    "href": "/about",
    "label": "About Quantara"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": "https://quantara.vistabylara.com/boq-software-for-facilities-management",
          "url": "https://quantara.vistabylara.com/boq-software-for-facilities-management",
          "name": "BOQ Software for Facilities Management and Service Projects | Quantara",
          "description": "Organize maintenance, repair, refurbishment and service BOQ workflows, revisions, templates and project records using Quantara."
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
              "name": "BOQ Software for Facilities Management",
              "item": "https://quantara.vistabylara.com/boq-software-for-facilities-management"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Can facilities-management teams reuse BOQ templates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara allows FM teams to save standard BOQ structures as templates, which is ideal for recurring service or refurbishment packages."
    }
  },
  {
    "@type": "Question",
    "name": "Is Quantara a CMMS?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No. Quantara is a BOQ and document workflow platform. It is not a Computerized Maintenance Management System for live ticketing."
    }
  },
  {
    "@type": "Question",
    "name": "Can I manage reactive repair BOQs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can rapidly structure ad-hoc scopes of work into professional BOQs for reactive repairs."
    }
  },
  {
    "@type": "Question",
    "name": "How does it help with contractor comparisons?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "By structuring a standardized BOQ, you can issue the same document to multiple contractors, ensuring an \"apples to apples\" comparison."
    }
  },
  {
    "@type": "Question",
    "name": "Does it track physical assets?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara manages the documents and BOQ items related to the assets, but it does not track live asset health or inventory."
    }
  },
  {
    "@type": "Question",
    "name": "Can I structure PPM schedules?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can structure the commercial and pricing elements of a PPM schedule as a BOQ, but it does not execute the actual maintenance scheduling."
    }
  },
  {
    "@type": "Question",
    "name": "How are refurbishment projects handled?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Refurbishments are treated as standard construction BOQs, allowing you to organize demolition, finishes, and MEP works logically."
    }
  },
  {
    "@type": "Question",
    "name": "Can I export the data to Excel?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, structured data can be exported to Excel for integration with other FM or financial systems."
    }
  }
]
        }
      ]
    }
  };

  return <IndustryLandingPage content={content} />;
}
