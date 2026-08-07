import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Fit-Out Companies and Interior Contractors",
  description: "Manage fit-out BOQs, finishes, joinery, partitions, ceilings, revisions, templates and professional proposals with Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-fit-out-companies",
  },
  openGraph: {
    title: "BOQ Software for Fit-Out Companies and Interior Contractors | Quantara",
    description: "Manage fit-out BOQs, finishes, joinery, partitions, ceilings, revisions, templates and professional proposals with Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-for-fit-out-companies",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software for Fit-Out Companies and Interior Contractors | Quantara",
    description: "Manage fit-out BOQs, finishes, joinery, partitions, ceilings, revisions, templates and professional proposals with Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Fit-Out",
    title: "BOQ Software for Fit-Out Companies Managing Detailed Interior Scope",
    audienceDescription: "Tailored for interior fit-out and renovation companies managing highly detailed project BOQs, finishes, and client variations.",
    directAnswer: "Quantara gives fit-out companies a structured way to manage detailed interior BOQs, handle frequent client variations, and generate professional proposals.",
    challenges: [
  {
    "title": "High Volume of Revisions",
    "description": "Interior fit-out projects are notorious for constant client design changes, resulting in heavy, difficult-to-track revision documentation."
  },
  {
    "title": "Detailed Finishes Schedules",
    "description": "Managing complex schedules for joinery, flooring, and bespoke fixtures often leads to missed items during the estimating phase."
  }
],
    workflowDescription: "Quantara allows fit-out teams to organize finishes, partitions, ceilings, flooring, joinery, doors, and fixtures. It simplifies MEP coordination, helps track variations, and streamlines the creation of client proposals by keeping all revision-heavy documentation in a controlled environment.",
    workflowExample: "A fit-out company receives a tender for a commercial office. The package includes a PDF scope of works, scanned finishes schedules, and an Excel BOQ. They use Quantara to consolidate these inputs into a single structured BOQ, ensuring no joinery items are missed before submitting their proposal.",
    typicalCategories: [
  "Demolition",
  "Partitions and Drylining",
  "Ceilings",
  "Flooring and Finishes",
  "Bespoke Joinery",
  "Doors and Hardware",
  "FF&E (Fixtures, Furniture & Equipment)"
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
  "Quantara does not claim automatic drawing measurement or room detection.",
  "Quantara does not provide pre-built cost or material libraries for finishes.",
  "All BOQ outputs require professional review before use in a contract."
],
    faqs: [
  {
    "question": "How should fit-out revisions be controlled?",
    "answer": "Revisions should be tracked sequentially within Quantara, ensuring that added or removed finishes are documented against the specific client variation."
  },
  {
    "question": "Does it automatically detect rooms from floor plans?",
    "answer": "No, automated room detection and drawing measurement are not currently available."
  },
  {
    "question": "Can I manage bespoke joinery items?",
    "answer": "Yes, bespoke items can be entered with detailed descriptions and specific units of measurement."
  },
  {
    "question": "Does it handle MEP coordination for fit-outs?",
    "answer": "You can create specific sections for MEP builders-work or coordination items within your master fit-out BOQ."
  },
  {
    "question": "Can I generate professional client proposals?",
    "answer": "Yes, Quantara can output formatted PDF proposals based on your structured and priced BOQ data."
  },
  {
    "question": "How do I handle FF&E schedules?",
    "answer": "FF&E schedules can be extracted from PDFs or Excel and structured as a distinct section within the BOQ."
  },
  {
    "question": "Can I use templates for common fit-out types?",
    "answer": "Yes, you can create and save reusable templates for common project types, like standard office or retail fit-outs."
  },
  {
    "question": "Does Quantara price the materials?",
    "answer": "No, Quantara structures the BOQ. The user must provide their own rates and pricing information."
  }
],
    relatedPages: [
  {
    "href": "/boq-software",
    "label": "BOQ Software"
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
          "@id": "https://quantara.vistabylara.com/boq-software-for-fit-out-companies",
          "url": "https://quantara.vistabylara.com/boq-software-for-fit-out-companies",
          "name": "BOQ Software for Fit-Out Companies and Interior Contractors | Quantara",
          "description": "Manage fit-out BOQs, finishes, joinery, partitions, ceilings, revisions, templates and professional proposals with Quantara."
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
              "name": "BOQ Software for Fit-Out",
              "item": "https://quantara.vistabylara.com/boq-software-for-fit-out-companies"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "How should fit-out revisions be controlled?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Revisions should be tracked sequentially within Quantara, ensuring that added or removed finishes are documented against the specific client variation."
    }
  },
  {
    "@type": "Question",
    "name": "Does it automatically detect rooms from floor plans?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, automated room detection and drawing measurement are not currently available."
    }
  },
  {
    "@type": "Question",
    "name": "Can I manage bespoke joinery items?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, bespoke items can be entered with detailed descriptions and specific units of measurement."
    }
  },
  {
    "@type": "Question",
    "name": "Does it handle MEP coordination for fit-outs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can create specific sections for MEP builders-work or coordination items within your master fit-out BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "Can I generate professional client proposals?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara can output formatted PDF proposals based on your structured and priced BOQ data."
    }
  },
  {
    "@type": "Question",
    "name": "How do I handle FF&E schedules?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "FF&E schedules can be extracted from PDFs or Excel and structured as a distinct section within the BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "Can I use templates for common fit-out types?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can create and save reusable templates for common project types, like standard office or retail fit-outs."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara price the materials?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara structures the BOQ. The user must provide their own rates and pricing information."
    }
  }
]
        }
      ]
    }
  };

  return <IndustryLandingPage content={content} />;
}
