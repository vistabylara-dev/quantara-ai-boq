import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software Saudi Arabia for Construction and Estimating Teams | Quantara",
  description: "Support Saudi construction BOQ workflows with structured documents, project records, revisions, templates and professionally reviewed outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-saudi-arabia",
  },
  openGraph: {
    title: "BOQ Software Saudi Arabia for Construction and Estimating Teams | Quantara",
    description: "Support Saudi construction BOQ workflows with structured documents, project records, revisions, templates and professionally reviewed outputs using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-saudi-arabia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software Saudi Arabia for Construction and Estimating Teams | Quantara",
    description: "Support Saudi construction BOQ workflows with structured documents, project records, revisions, templates and professionally reviewed outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "BOQ Software Saudi Arabia",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "BOQ Software for Saudi Arabia Construction and Estimating Workflows",
    audienceDescription: "For Saudi construction, MEP and QS teams managing large-scale and multidisciplinary project documentation.",
    directAnswer: "Quantara supports Saudi construction teams by providing a platform to structure complex consultant BOQs, manage revisions, and organize estimating records.",
    challenges: [
  {
    "title": "Massive Project Scale",
    "description": "Giga-projects and large-scale developments generate enormous BOQs that are difficult to manage across disparate spreadsheet files."
  },
  {
    "title": "Stringent Revision Tracking",
    "description": "Keeping track of continuous tender addenda and scope changes requires a structured revision-control system."
  }
],
    workflowDescription: "Quantara helps organize contractor and consultant BOQs. It provides revision control and supports PDF and spreadsheet workflows. Teams can establish structured project records for professional review before formal submission.",
    workflowExample: "A main contractor in Saudi Arabia receives a 500-page PDF BOQ for a commercial development. They use Quantara to extract the text, structure the major divisions, and apply a controlled template to distribute the workload among their estimating team.",
    typicalCategories: [
  "Earthworks",
  "Concrete Structure",
  "MEP Infrastructure",
  "Architectural Works",
  "Landscaping"
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
  "Quantara does not claim Saudi regulatory compliance or government integration.",
  "Quantara does not guarantee local hosting or data residency in Saudi Arabia.",
  "Quantara does not claim native Arabic language support unless explicitly verified."
],
    faqs: [
  {
    "question": "Does Quantara comply with Saudi construction regulations?",
    "answer": "Quantara is a document management and workflow tool; it does not provide regulatory compliance or engineering certification."
  },
  {
    "question": "Can Quantara process Arabic BOQ documents?",
    "answer": "Quantara is currently optimized for English. It does not support native Arabic translation or parsing unless explicitly verified."
  },
  {
    "question": "Is Quantara hosted in Saudi Arabia?",
    "answer": "No, Quantara uses global cloud infrastructure and does not claim local data residency in Saudi Arabia."
  },
  {
    "question": "Does it support Saudi government tender portals?",
    "answer": "No, there is no direct integration. You must export your data to Excel or PDF for manual upload."
  },
  {
    "question": "Can large multidisciplinary teams use it?",
    "answer": "Yes, it is designed to help structure large BOQs, making it easier to manage complex multidisciplinary projects."
  },
  {
    "question": "How does revision control work?",
    "answer": "It allows you to lock versions of your BOQ, ensuring you have a clear historical record of changes across tender addenda."
  },
  {
    "question": "Are standard measurement rules built-in?",
    "answer": "No, you define the structure. Quantara does not enforce specific measurement rules like POMI or CESMM."
  },
  {
    "question": "Does it include local Saudi rates?",
    "answer": "No, the platform focuses on BOQ structuring. Users must apply their own market rates."
  }
],
    relatedPages: [
  {
    "href": "/gcc-boq-software",
    "label": "GCC BOQ Software"
  },
  {
    "href": "/boq-software",
    "label": "BOQ Software"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/boq-software-for-contractors",
    "label": "BOQ Software for Contractors"
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
          "@id": "https://quantara.vistabylara.com/boq-software-saudi-arabia",
          "url": "https://quantara.vistabylara.com/boq-software-saudi-arabia",
          "name": "BOQ Software Saudi Arabia for Construction and Estimating Teams | Quantara",
          "description": "Support Saudi construction BOQ workflows with structured documents, project records, revisions, templates and professionally reviewed outputs using Quantara."
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
              "name": "BOQ Software Saudi Arabia",
              "item": "https://quantara.vistabylara.com/boq-software-saudi-arabia"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Does Quantara comply with Saudi construction regulations?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara is a document management and workflow tool; it does not provide regulatory compliance or engineering certification."
    }
  },
  {
    "@type": "Question",
    "name": "Can Quantara process Arabic BOQ documents?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara is currently optimized for English. It does not support native Arabic translation or parsing unless explicitly verified."
    }
  },
  {
    "@type": "Question",
    "name": "Is Quantara hosted in Saudi Arabia?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara uses global cloud infrastructure and does not claim local data residency in Saudi Arabia."
    }
  },
  {
    "@type": "Question",
    "name": "Does it support Saudi government tender portals?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, there is no direct integration. You must export your data to Excel or PDF for manual upload."
    }
  },
  {
    "@type": "Question",
    "name": "Can large multidisciplinary teams use it?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, it is designed to help structure large BOQs, making it easier to manage complex multidisciplinary projects."
    }
  },
  {
    "@type": "Question",
    "name": "How does revision control work?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "It allows you to lock versions of your BOQ, ensuring you have a clear historical record of changes across tender addenda."
    }
  },
  {
    "@type": "Question",
    "name": "Are standard measurement rules built-in?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, you define the structure. Quantara does not enforce specific measurement rules like POMI or CESMM."
    }
  },
  {
    "@type": "Question",
    "name": "Does it include local Saudi rates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, the platform focuses on BOQ structuring. Users must apply their own market rates."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
