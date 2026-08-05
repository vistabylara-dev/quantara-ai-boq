import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software Oman for Construction and Estimating Teams | Quantara",
  description: "Support Oman BOQ workflows with structured project documents, revisions, templates and professionally reviewed outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-oman",
  },
  openGraph: {
    title: "BOQ Software Oman for Construction and Estimating Teams | Quantara",
    description: "Support Oman BOQ workflows with structured project documents, revisions, templates and professionally reviewed outputs using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-oman",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software Oman for Construction and Estimating Teams | Quantara",
    description: "Support Oman BOQ workflows with structured project documents, revisions, templates and professionally reviewed outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "BOQ Software Oman",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "BOQ Software for Oman Construction and Estimating Workflows",
    audienceDescription: "For Oman contractors, consultants and estimating teams looking for reliable BOQ workflow software.",
    directAnswer: "Quantara helps Oman construction teams organize PDF and spreadsheet BOQs, manage project revisions, and generate structured outputs.",
    challenges: [
  {
    "title": "Document Consolidation",
    "description": "Tender packages often arrive in a mix of unstructured PDF and Excel formats that are difficult to consolidate."
  },
  {
    "title": "Tracking Client Changes",
    "description": "Managing client revisions effectively without a structured system often leads to pricing errors and missed scope."
  }
],
    workflowDescription: "Quantara streamlines contractor and consultant workflows by structuring PDF and spreadsheet BOQs. It tracks project revisions, organizes client records, and produces structured outputs for professional validation.",
    workflowExample: "A main contractor in Oman uses Quantara to import a text-based PDF BOQ, quickly organizing the items into structured sections for civil works and finishes, allowing their team to begin pricing much faster.",
    typicalCategories: [
  "Preliminaries",
  "Civil Works",
  "Finishes",
  "MEP Works",
  "External Site Works"
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
  "Quantara does not claim Oman regulatory compliance.",
  "Quantara does not provide local-rate support or cost databases.",
  "Visual quantity takeoff and drawing measurement are not currently supported."
],
    faqs: [
  {
    "question": "Is Quantara available to construction teams in Oman?",
    "answer": "Yes, Quantara is a cloud-based platform available to contractors and estimators in Oman."
  },
  {
    "question": "Does Quantara include Oman market rates?",
    "answer": "No, Quantara does not supply pricing data or local rates. Users must apply their own pricing."
  },
  {
    "question": "Can I extract BOQs from PDFs?",
    "answer": "Yes, Quantara can extract items from both text-based and scanned PDFs to help structure your BOQ."
  },
  {
    "question": "Does Quantara comply with local Oman regulations?",
    "answer": "Quantara is a document management tool and does not claim specific regulatory or engineering compliance."
  },
  {
    "question": "How do I manage client revisions?",
    "answer": "You can use the platform’s revision control features to track changes between different issues of a BOQ."
  },
  {
    "question": "Does it support automated drawing measurement?",
    "answer": "No, automated drawing measurement and visual takeoff are currently Planned features."
  },
  {
    "question": "Can I create my own BOQ templates?",
    "answer": "Yes, you can define and save your own structural templates for use on future projects."
  },
  {
    "question": "What formats can I export my BOQ to?",
    "answer": "You can export the data to Structured Excel (XLSX), CSV, or formatted PDF proposals."
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
    "href": "/boq-management",
    "label": "BOQ Management"
  },
  {
    "href": "/how-to-prepare-a-boq",
    "label": "How to Prepare a BOQ"
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
          "@id": "https://quantara.vistabylara.com/boq-software-oman",
          "url": "https://quantara.vistabylara.com/boq-software-oman",
          "name": "BOQ Software Oman for Construction and Estimating Teams | Quantara",
          "description": "Support Oman BOQ workflows with structured project documents, revisions, templates and professionally reviewed outputs using Quantara."
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
              "name": "BOQ Software Oman",
              "item": "https://quantara.vistabylara.com/boq-software-oman"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Is Quantara available to construction teams in Oman?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara is a cloud-based platform available to contractors and estimators in Oman."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara include Oman market rates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not supply pricing data or local rates. Users must apply their own pricing."
    }
  },
  {
    "@type": "Question",
    "name": "Can I extract BOQs from PDFs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara can extract items from both text-based and scanned PDFs to help structure your BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara comply with local Oman regulations?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara is a document management tool and does not claim specific regulatory or engineering compliance."
    }
  },
  {
    "@type": "Question",
    "name": "How do I manage client revisions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can use the platform’s revision control features to track changes between different issues of a BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "Does it support automated drawing measurement?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, automated drawing measurement and visual takeoff are currently Planned features."
    }
  },
  {
    "@type": "Question",
    "name": "Can I create my own BOQ templates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can define and save your own structural templates for use on future projects."
    }
  },
  {
    "@type": "Question",
    "name": "What formats can I export my BOQ to?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "You can export the data to Structured Excel (XLSX), CSV, or formatted PDF proposals."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
