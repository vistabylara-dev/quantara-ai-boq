import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Engineering Consultants and Project Teams",
  description: "Support consultant BOQ preparation, revisions, controlled templates, project records and professionally reviewed outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-engineering-consultants",
  },
  openGraph: {
    title: "BOQ Software for Engineering Consultants and Project Teams | Quantara",
    description: "Support consultant BOQ preparation, revisions, controlled templates, project records and professionally reviewed outputs using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-for-engineering-consultants",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software for Engineering Consultants and Project Teams | Quantara",
    description: "Support consultant BOQ preparation, revisions, controlled templates, project records and professionally reviewed outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Consultants",
    title: "BOQ Software for Engineering Consultants Managing Controlled Project Information",
    audienceDescription: "For engineering consultants and client-side project teams managing BOQ preparation, multidisciplinary coordination, and tender issue workflows.",
    directAnswer: "Quantara supports engineering consultants in structuring BOQ preparation, managing controlled templates, and maintaining a clear audit trail for tender documents.",
    challenges: [
  {
    "title": "Multidisciplinary Coordination",
    "description": "Consolidating BOQ sections from civil, structural, architectural, and MEP engineering disciplines into one cohesive tender document is error-prone."
  },
  {
    "title": "Tender Issue Control",
    "description": "Issuing the correct, verified revision of a BOQ to clients and contractors requires rigorous document control and tracking."
  }
],
    workflowDescription: "Quantara streamlines consultant BOQ preparation by managing technical schedules, document revisions, and controlled templates. It provides a robust framework for issue records, client review, tender documentation, and multidisciplinary coordination, culminating in professional approval workflows.",
    workflowExample: "A consultant team is consolidating revised BOQ sections from their structural and MEP departments before tender release. They use Quantara to merge the disciplines into a single controlled project record, update the revision number to Rev 3, and export a finalized PDF for client review.",
    typicalCategories: [
  "General Preliminaries",
  "Substructure",
  "Superstructure",
  "Architectural Finishes",
  "Mechanical Services",
  "Electrical Services",
  "External Works"
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
  "Quantara does not claim formal design validation, compliance approval, or certification.",
  "Quantara does not automate the professional judgment required to prepare a BOQ.",
  "Automated extraction of quantities directly from engineering models is Planned."
],
    faqs: [
  {
    "question": "Can consultants manage multiple project revisions?",
    "answer": "Yes, Quantara’s revision control ensures that multiple iterations of a BOQ are tracked and securely managed before tender issue."
  },
  {
    "question": "Does Quantara perform design validation?",
    "answer": "No, Quantara does not provide formal design validation, code compliance, or engineering certification."
  },
  {
    "question": "How is multidisciplinary coordination handled?",
    "answer": "Consultants can create distinct sections for each discipline within a master project BOQ, ensuring all scope is consolidated cleanly."
  },
  {
    "question": "Can I use controlled templates?",
    "answer": "Yes, consultancy firms can establish controlled BOQ templates to ensure consistency across different projects and offices."
  },
  {
    "question": "Does it replace traditional measurement software?",
    "answer": "Quantara focuses on document structure, extraction, and revision control. It does not currently replace dedicated visual measurement tools."
  },
  {
    "question": "How are issue records maintained?",
    "answer": "By locking revisions, the platform maintains a clear history of what was issued, when, and what changed."
  },
  {
    "question": "Can I export documents for client review?",
    "answer": "Yes, structured BOQs can be exported as professional PDFs or Excel files for formal client presentation and review."
  },
  {
    "question": "Is it suitable for client-side project teams?",
    "answer": "Yes, client representatives can use the platform to structure their requirements and review consultant-issued documents."
  }
],
    relatedPages: [
  {
    "href": "/quantity-surveying-software",
    "label": "Quantity Surveying Software"
  },
  {
    "href": "/boq-revision-control",
    "label": "BOQ Revision Control"
  },
  {
    "href": "/how-to-prepare-a-boq",
    "label": "How to Prepare a BOQ"
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
          "@id": "https://quantara.vistabylara.com/boq-software-for-engineering-consultants",
          "url": "https://quantara.vistabylara.com/boq-software-for-engineering-consultants",
          "name": "BOQ Software for Engineering Consultants and Project Teams | Quantara",
          "description": "Support consultant BOQ preparation, revisions, controlled templates, project records and professionally reviewed outputs using Quantara."
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
              "name": "BOQ Software for Consultants",
              "item": "https://quantara.vistabylara.com/boq-software-for-engineering-consultants"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Can consultants manage multiple project revisions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara’s revision control ensures that multiple iterations of a BOQ are tracked and securely managed before tender issue."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara perform design validation?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not provide formal design validation, code compliance, or engineering certification."
    }
  },
  {
    "@type": "Question",
    "name": "How is multidisciplinary coordination handled?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Consultants can create distinct sections for each discipline within a master project BOQ, ensuring all scope is consolidated cleanly."
    }
  },
  {
    "@type": "Question",
    "name": "Can I use controlled templates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, consultancy firms can establish controlled BOQ templates to ensure consistency across different projects and offices."
    }
  },
  {
    "@type": "Question",
    "name": "Does it replace traditional measurement software?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara focuses on document structure, extraction, and revision control. It does not currently replace dedicated visual measurement tools."
    }
  },
  {
    "@type": "Question",
    "name": "How are issue records maintained?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "By locking revisions, the platform maintains a clear history of what was issued, when, and what changed."
    }
  },
  {
    "@type": "Question",
    "name": "Can I export documents for client review?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, structured BOQs can be exported as professional PDFs or Excel files for formal client presentation and review."
    }
  },
  {
    "@type": "Question",
    "name": "Is it suitable for client-side project teams?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, client representatives can use the platform to structure their requirements and review consultant-issued documents."
    }
  }
]
        }
      ]
    }
  };

  return <IndustryLandingPage content={content} />;
}
