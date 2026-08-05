import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software Dubai for Contractors, MEP and Fit-Out Teams | Quantara",
  description: "Support Dubai BOQ and estimating workflows with structured documents, revisions, templates and professionally reviewed project outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-dubai",
  },
  openGraph: {
    title: "BOQ Software Dubai for Contractors, MEP and Fit-Out Teams | Quantara",
    description: "Support Dubai BOQ and estimating workflows with structured documents, revisions, templates and professionally reviewed project outputs using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-dubai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software Dubai for Contractors, MEP and Fit-Out Teams | Quantara",
    description: "Support Dubai BOQ and estimating workflows with structured documents, revisions, templates and professionally reviewed project outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "BOQ Software Dubai",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "BOQ Software for Dubai Contractors, MEP and Fit-Out Projects",
    audienceDescription: "For Dubai contractors, MEP firms, fit-out companies and QS teams managing fast-moving tender documentation.",
    directAnswer: "Quantara provides Dubai construction teams with a workflow platform to manage interior fit-out scope, MEP documents, and high-volume client revisions.",
    challenges: [
  {
    "title": "Fast-Moving Tender Schedules",
    "description": "Dubai projects often feature aggressive tender timelines, requiring rapid consolidation of PDF and Excel BOQ data."
  },
  {
    "title": "Interior and MEP Complexity",
    "description": "High-end fit-out and complex MEP coordination require structured BOQ records to prevent scope gaps during fast-track delivery."
  }
],
    workflowDescription: "Quantara allows teams to organize detailed project and proposal documents into controlled records. Whether managing fit-out finishes or MEP schedules, the platform structures the BOQ data for professional review before tender submission.",
    workflowExample: "A Dubai fit-out company receives a revised scope of works in PDF just days before the tender deadline. They use Quantara to quickly extract the new joinery and ceiling items, updating their structured BOQ to match the client's latest revision.",
    typicalCategories: [
  "Fit-out Finishes",
  "Joinery Works",
  "MEP Services",
  "Specialist Installations",
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
  "Quantara does not claim a local Dubai office unless explicitly verified.",
  "Quantara does not claim Dubai authority approval or specific integration with Dubai Municipality systems.",
  "Quantara does not provide automated visual drawing measurement."
],
    faqs: [
  {
    "question": "Can Dubai fit-out companies use Quantara for BOQ workflows?",
    "answer": "Yes, Quantara is well-suited for organizing detailed interior fit-out BOQs and tracking client variations."
  },
  {
    "question": "Does Quantara integrate with Dubai government portals?",
    "answer": "No, Quantara does not integrate directly with local tender or government portals. Users must export their BOQ to Excel or PDF for manual submission."
  },
  {
    "question": "Is Quantara approved by Dubai authorities?",
    "answer": "Quantara is an independent software tool and does not claim any official government approval or certification."
  },
  {
    "question": "Can I manage MEP scope separation?",
    "answer": "Yes, the platform allows you to create structured sections to cleanly separate mechanical, electrical, and plumbing scope."
  },
  {
    "question": "Does it support scanned PDFs from local consultants?",
    "answer": "Yes, OCR is available for scanned PDFs, though all extracted data must be professionally reviewed."
  },
  {
    "question": "Does Quantara have a local office in Dubai?",
    "answer": "Quantara operates globally; we do not claim a physical local office in Dubai at this time."
  },
  {
    "question": "Can I track fast-moving revisions?",
    "answer": "Yes, the platform's revision control is designed to handle multiple iterations of a BOQ quickly."
  },
  {
    "question": "Is there a pre-built library for Dubai rates?",
    "answer": "No, Quantara provides the structure; you must apply your own market rates."
  },
  {
    "question": "How do I export my final proposal?",
    "answer": "You can export the structured BOQ as a formatted PDF proposal or an XLSX file."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-uae",
    "label": "BOQ Software UAE"
  },
  {
    "href": "/boq-software-for-fit-out-companies",
    "label": "Fit-Out BOQ Software"
  },
  {
    "href": "/boq-software-for-mep-contractors",
    "label": "MEP BOQ Software"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/contact-sales",
    "label": "Contact Sales"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": "https://quantara.vistabylara.com/boq-software-dubai",
          "url": "https://quantara.vistabylara.com/boq-software-dubai",
          "name": "BOQ Software Dubai for Contractors, MEP and Fit-Out Teams | Quantara",
          "description": "Support Dubai BOQ and estimating workflows with structured documents, revisions, templates and professionally reviewed project outputs using Quantara."
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
              "name": "BOQ Software Dubai",
              "item": "https://quantara.vistabylara.com/boq-software-dubai"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Can Dubai fit-out companies use Quantara for BOQ workflows?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara is well-suited for organizing detailed interior fit-out BOQs and tracking client variations."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara integrate with Dubai government portals?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not integrate directly with local tender or government portals. Users must export their BOQ to Excel or PDF for manual submission."
    }
  },
  {
    "@type": "Question",
    "name": "Is Quantara approved by Dubai authorities?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara is an independent software tool and does not claim any official government approval or certification."
    }
  },
  {
    "@type": "Question",
    "name": "Can I manage MEP scope separation?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, the platform allows you to create structured sections to cleanly separate mechanical, electrical, and plumbing scope."
    }
  },
  {
    "@type": "Question",
    "name": "Does it support scanned PDFs from local consultants?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, OCR is available for scanned PDFs, though all extracted data must be professionally reviewed."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara have a local office in Dubai?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara operates globally; we do not claim a physical local office in Dubai at this time."
    }
  },
  {
    "@type": "Question",
    "name": "Can I track fast-moving revisions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, the platform's revision control is designed to handle multiple iterations of a BOQ quickly."
    }
  },
  {
    "@type": "Question",
    "name": "Is there a pre-built library for Dubai rates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara provides the structure; you must apply your own market rates."
    }
  },
  {
    "@type": "Question",
    "name": "How do I export my final proposal?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can export the structured BOQ as a formatted PDF proposal or an XLSX file."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
