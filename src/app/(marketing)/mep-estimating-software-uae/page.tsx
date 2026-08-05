import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "MEP Estimating Software UAE for Structured BOQ Workflows | Quantara",
  description: "Organize UAE mechanical, electrical and plumbing BOQ workflows, documents, revisions and professional outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/mep-estimating-software-uae",
  },
  openGraph: {
    title: "MEP Estimating Software UAE for Structured BOQ Workflows | Quantara",
    description: "Organize UAE mechanical, electrical and plumbing BOQ workflows, documents, revisions and professional outputs using Quantara.",
    url: "https://quantara.vistabylara.com/mep-estimating-software-uae",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MEP Estimating Software UAE for Structured BOQ Workflows | Quantara",
    description: "Organize UAE mechanical, electrical and plumbing BOQ workflows, documents, revisions and professional outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "UAE MEP Estimating Software",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "MEP Estimating Software for UAE Contractors and Project Teams",
    audienceDescription: "For UAE MEP contractors and estimators managing complex technical schedules and multi-discipline BOQs.",
    directAnswer: "Quantara helps UAE MEP contractors structure mechanical, electrical, and plumbing BOQs, track technical schedules, and manage project revisions.",
    challenges: [
  {
    "title": "Multi-Discipline Complexity",
    "description": "Separating HVAC, plumbing, drainage, and electrical scope from a massive consultant BOQ is tedious and error-prone."
  },
  {
    "title": "Technical Schedule Extraction",
    "description": "Extracting data accurately from detailed equipment schedules in PDF format is a major bottleneck for MEP estimators."
  }
],
    workflowDescription: "Quantara provides the structure to manage distinct MEP scopes, including HVAC, fire fighting, controls, and testing & commissioning. Users can organize revisions and technical schedules into a unified BOQ, preparing the data for professional review.",
    workflowExample: "An MEP estimator in the UAE uses Quantara to extract equipment schedules from a consultant’s PDF, organizing the AHUs and FCUs into a structured HVAC section while keeping the lighting fixtures in a separate Electrical section.",
    typicalCategories: [
  "HVAC",
  "Plumbing and Drainage",
  "Electrical Services",
  "Fire Fighting",
  "Testing and Commissioning"
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
  "Quantara does not claim automatic MEP measurement from drawings.",
  "Quantara does not validate engineering code compliance.",
  "Quantara does not provide pre-built MEP pricing libraries."
],
    faqs: [
  {
    "question": "Can I manage electrical and mechanical scope separately?",
    "answer": "Yes, you can create distinct sections within Quantara to cleanly separate different MEP disciplines."
  },
  {
    "question": "Does Quantara measure pipe or cable lengths automatically?",
    "answer": "No, automated drawing measurement is a Planned feature and is not currently active."
  },
  {
    "question": "Can I extract HVAC equipment schedules?",
    "answer": "Yes, you can extract technical schedules from PDFs and structure them, though manual verification is required."
  },
  {
    "question": "Does it validate MEP engineering compliance?",
    "answer": "No, Quantara is a workflow tool and provides no engineering approval or compliance validation."
  },
  {
    "question": "Can I track testing and commissioning items?",
    "answer": "Yes, testing, balancing, and commissioning can be organized as structured items in your BOQ."
  },
  {
    "question": "How are MEP revisions handled?",
    "answer": "You can use revision control to track updates to specific MEP sections as consultant addenda are issued."
  },
  {
    "question": "Does it include UAE MEP rates?",
    "answer": "No, Quantara does not include pricing databases or local rates."
  },
  {
    "question": "What formats can I export to?",
    "answer": "You can export your structured MEP BOQ to XLSX, CSV, or formatted PDF proposals."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-for-mep-contractors",
    "label": "MEP BOQ Software"
  },
  {
    "href": "/boq-software-for-hvac-contractors",
    "label": "HVAC BOQ Software"
  },
  {
    "href": "/boq-software-for-fire-fighting-contractors",
    "label": "Fire Fighting BOQ Software"
  },
  {
    "href": "/pdf-boq-extraction",
    "label": "PDF BOQ Extraction"
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
          "@id": "https://quantara.vistabylara.com/mep-estimating-software-uae",
          "url": "https://quantara.vistabylara.com/mep-estimating-software-uae",
          "name": "MEP Estimating Software UAE for Structured BOQ Workflows | Quantara",
          "description": "Organize UAE mechanical, electrical and plumbing BOQ workflows, documents, revisions and professional outputs using Quantara."
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
              "name": "UAE MEP Estimating Software",
              "item": "https://quantara.vistabylara.com/mep-estimating-software-uae"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Can I manage electrical and mechanical scope separately?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can create distinct sections within Quantara to cleanly separate different MEP disciplines."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara measure pipe or cable lengths automatically?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, automated drawing measurement is a Planned feature and is not currently active."
    }
  },
  {
    "@type": "Question",
    "name": "Can I extract HVAC equipment schedules?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can extract technical schedules from PDFs and structure them, though manual verification is required."
    }
  },
  {
    "@type": "Question",
    "name": "Does it validate MEP engineering compliance?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara is a workflow tool and provides no engineering approval or compliance validation."
    }
  },
  {
    "@type": "Question",
    "name": "Can I track testing and commissioning items?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, testing, balancing, and commissioning can be organized as structured items in your BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "How are MEP revisions handled?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can use revision control to track updates to specific MEP sections as consultant addenda are issued."
    }
  },
  {
    "@type": "Question",
    "name": "Does it include UAE MEP rates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not include pricing databases or local rates."
    }
  },
  {
    "@type": "Question",
    "name": "What formats can I export to?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can export your structured MEP BOQ to XLSX, CSV, or formatted PDF proposals."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
