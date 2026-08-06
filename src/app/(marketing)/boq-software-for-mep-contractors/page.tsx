import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
export const metadata: Metadata = {
  title: "BOQ Software for MEP Contractors and Estimators",
  description: "Organize mechanical, electrical and plumbing BOQ workflows, project documents, revisions, templates and outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-mep-contractors",
  },
  openGraph: {
    title: "BOQ Software for MEP Contractors and Estimators | Quantara",
    description: "Organize mechanical, electrical and plumbing BOQ workflows, project documents, revisions, templates and outputs using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-for-mep-contractors",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software for MEP Contractors and Estimators | Quantara",
    description: "Organize mechanical, electrical and plumbing BOQ workflows, project documents, revisions, templates and outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for MEP Contractors",
    title: "BOQ Software for MEP Contractors Managing Multi-Discipline Scope",
    audienceDescription: "Designed for mechanical, electrical, and plumbing (MEP) contractors managing complex, multi-discipline BOQs and technical equipment schedules.",
    directAnswer: "Quantara helps MEP contractors structure multi-discipline BOQs, coordinate technical specifications, and manage equipment schedules in a unified workflow platform.",
    challenges: [
  {
    "title": "Multi-Discipline Complexity",
    "description": "MEP packages involve thousands of specialized items across mechanical, electrical, and plumbing trades, making scope separation extremely difficult."
  },
  {
    "title": "Technical Document Coordination",
    "description": "Managing the relationship between the BOQ descriptions, equipment schedules, and supplier references often leads to misaligned pricing."
  }
],
    workflowDescription: "Quantara provides a structured environment for MEP scope separation. Contractors can organize mechanical, electrical, and plumbing items, track technical specifications, manage quantities and units, and align supplier references across multiple project revisions to generate accurate proposal outputs.",
    workflowExample: "An MEP estimator is working on a high-rise residential project. They use Quantara to separate the electrical lighting schedules from the mechanical HVAC scope, organizing each discipline into its own structured BOQ section for distinct subcontractor pricing.",
    typicalCategories: [
  "HVAC",
  "Electrical",
  "Plumbing",
  "Drainage",
  "Fire Fighting",
  "Controls",
  "Testing and Commissioning",
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
  "Quantara does not provide verified discipline libraries or pre-built MEP item databases.",
  "Quantara does not provide engineering approval or code compliance certification.",
  "Automated takeoff from MEP drawings is currently Planned."
],
    faqs: [
  {
    "question": "Which BOQ sections are common in MEP projects?",
    "answer": "Typical sections include HVAC, Electrical, Plumbing, Drainage, Fire Fighting, Controls, and Testing & Commissioning."
  },
  {
    "question": "Does Quantara have pre-built MEP libraries?",
    "answer": "No, Quantara does not currently offer verified pre-built discipline libraries. Users must define their own categories and items."
  },
  {
    "question": "Can I manage equipment schedules?",
    "answer": "Yes, equipment schedules can be extracted from PDFs or Excel and structured as specific items within the BOQ."
  },
  {
    "question": "Does it validate MEP engineering compliance?",
    "answer": "No. Quantara is a document and workflow platform. It does not provide engineering approval or design validation."
  },
  {
    "question": "How do you handle supplier references?",
    "answer": "Supplier references and technical specifications can be added as notes or descriptions to specific BOQ items."
  },
  {
    "question": "Can I separate mechanical and electrical scope?",
    "answer": "Yes, the platform allows you to create distinct sections and packages to cleanly separate multi-discipline scope."
  },
  {
    "question": "Does it measure pipe lengths automatically?",
    "answer": "No, automated drawing measurement (including pipe or cable runs) is a Planned feature and not currently active."
  },
  {
    "question": "How are MEP revisions handled?",
    "answer": "You can track revisions to specific sections, ensuring updates to the electrical scope don't overwrite the mechanical scope."
  }
],
    relatedPages: [
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/boq-software",
    "label": "BOQ Software"
  },
  {
    "href": "/pdf-boq-extraction",
    "label": "PDF BOQ Extraction"
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
          "@id": "https://quantara.vistabylara.com/boq-software-for-mep-contractors",
          "url": "https://quantara.vistabylara.com/boq-software-for-mep-contractors",
          "name": "BOQ Software for MEP Contractors and Estimators | Quantara",
          "description": "Organize mechanical, electrical and plumbing BOQ workflows, project documents, revisions, templates and outputs using Quantara."
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
              "name": "BOQ Software for MEP Contractors",
              "item": "https://quantara.vistabylara.com/boq-software-for-mep-contractors"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Which BOQ sections are common in MEP projects?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Typical sections include HVAC, Electrical, Plumbing, Drainage, Fire Fighting, Controls, and Testing & Commissioning."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara have pre-built MEP libraries?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not currently offer verified pre-built discipline libraries. Users must define their own categories and items."
    }
  },
  {
    "@type": "Question",
    "name": "Can I manage equipment schedules?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, equipment schedules can be extracted from PDFs or Excel and structured as specific items within the BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "Does it validate MEP engineering compliance?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No. Quantara is a document and workflow platform. It does not provide engineering approval or design validation."
    }
  },
  {
    "@type": "Question",
    "name": "How do you handle supplier references?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Supplier references and technical specifications can be added as notes or descriptions to specific BOQ items."
    }
  },
  {
    "@type": "Question",
    "name": "Can I separate mechanical and electrical scope?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, the platform allows you to create distinct sections and packages to cleanly separate multi-discipline scope."
    }
  },
  {
    "@type": "Question",
    "name": "Does it measure pipe lengths automatically?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, automated drawing measurement (including pipe or cable runs) is a Planned feature and not currently active."
    }
  },
  {
    "@type": "Question",
    "name": "How are MEP revisions handled?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can track revisions to specific sections, ensuring updates to the electrical scope don't overwrite the mechanical scope."
    }
  }
]
        }
      ]
    }
  };

  return (
    <>
      <PublicBreadcrumb items={[{ name: "Home", item: "/" }, { name: "Industries", item: "/industries" }, { name: "BOQ Software for MEP Contractors", item: "/boq-software-for-mep-contractors" }]} />
      <IndustryLandingPage content={content} />
    </>
  );
}
