import { Metadata } from "next";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export const metadata: Metadata = {
  title: "Fire-Fighting BOQ Software for Contractors and Estimators",
  description: "Organize fire-fighting BOQ items, system components, project documents, revisions and professional outputs with Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-for-fire-fighting-contractors",
  },
  openGraph: {
    title: "Fire-Fighting BOQ Software for Contractors and Estimators | Quantara",
    description: "Organize fire-fighting BOQ items, system components, project documents, revisions and professional outputs with Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-for-fire-fighting-contractors",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fire-Fighting BOQ Software for Contractors and Estimators | Quantara",
    description: "Organize fire-fighting BOQ items, system components, project documents, revisions and professional outputs with Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "Fire-Fighting BOQ Software",
    title: "Fire-Fighting BOQ Software for Structured Project and Estimating Workflows",
    audienceDescription: "For fire-fighting and life-safety contractors managing highly technical equipment schedules, piping, and system BOQs.",
    directAnswer: "Quantara provides fire-fighting contractors with a reliable platform to organize technical BOQs, system components, and equipment schedules.",
    challenges: [
  {
    "title": "Technical Complexity",
    "description": "Life-safety BOQs contain highly specific equipment, valves, and specialized piping that must be perfectly translated from consultant documents."
  },
  {
    "title": "Strict Revision Management",
    "description": "Changes to fire-protection scope require rigorous documentation to ensure the final tender matches the approved safety strategy."
  }
],
    workflowDescription: "Quantara helps teams organize pumps, sprinkler systems, specialized piping, valves, hose reels, extinguishers, and accessories. By managing technical schedules and revisions in a structured format, contractors can ensure their testing and commissioning items are correctly aligned with the scope.",
    workflowExample: "A fire-fighting contractor is reviewing a consultant's BOQ alongside newly revised pump equipment schedules. They use Quantara to extract the updated schedules, structure the items into the master BOQ, and track the revision to ensure the final proposal reflects the latest requirements.",
    typicalCategories: [
  "Fire Pumps and Equipment",
  "Sprinkler Systems",
  "Fire Fighting Piping",
  "Valves and Accessories",
  "Hose Reels and Cabinets",
  "Fire Extinguishers",
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
  "Quantara does not claim standards compliance or automatic engineering validation.",
  "Quantara does not provide hydraulic calculations or design software.",
  "All extracted life-safety scope must be reviewed by a qualified professional."
],
    faqs: [
  {
    "question": "Does Quantara validate fire-protection compliance?",
    "answer": "No, Quantara is purely a document workflow tool. It does not provide code compliance certification or engineering approval."
  },
  {
    "question": "Can I extract pump equipment schedules?",
    "answer": "Yes, technical schedules can be extracted from PDFs and structured as items, but manual verification of technical specs is mandatory."
  },
  {
    "question": "How are valves and accessories managed?",
    "answer": "They are managed as standard BOQ items with specific descriptions and quantities, organized within your chosen sections."
  },
  {
    "question": "Does Quantara perform hydraulic calculations?",
    "answer": "No, Quantara does not perform engineering calculations. It only manages the BOQ document structure."
  },
  {
    "question": "Can I track testing and commissioning?",
    "answer": "Yes, testing and commissioning should be structured as specific items or sections within the BOQ."
  },
  {
    "question": "Is it suitable for sprinkler system BOQs?",
    "answer": "Yes, the platform can organize all components of a sprinkler system, including pipework and heads, into a structured format."
  },
  {
    "question": "How do you handle consultant revisions?",
    "answer": "Quantara’s revision control allows you to update specific sections based on new consultant instructions while retaining an audit trail."
  },
  {
    "question": "Can I export a professional proposal?",
    "answer": "Yes, you can generate formatted PDF proposals based on the finalized and priced BOQ."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-for-mep-contractors",
    "label": "BOQ Software for MEP Contractors"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "How to Review AI-Extracted BOQ"
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
          "@id": "https://quantara.vistabylara.com/boq-software-for-fire-fighting-contractors",
          "url": "https://quantara.vistabylara.com/boq-software-for-fire-fighting-contractors",
          "name": "Fire-Fighting BOQ Software for Contractors and Estimators | Quantara",
          "description": "Organize fire-fighting BOQ items, system components, project documents, revisions and professional outputs with Quantara."
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
              "name": "Fire-Fighting BOQ Software",
              "item": "https://quantara.vistabylara.com/boq-software-for-fire-fighting-contractors"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Does Quantara validate fire-protection compliance?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara is purely a document workflow tool. It does not provide code compliance certification or engineering approval."
    }
  },
  {
    "@type": "Question",
    "name": "Can I extract pump equipment schedules?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, technical schedules can be extracted from PDFs and structured as items, but manual verification of technical specs is mandatory."
    }
  },
  {
    "@type": "Question",
    "name": "How are valves and accessories managed?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "They are managed as standard BOQ items with specific descriptions and quantities, organized within your chosen sections."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara perform hydraulic calculations?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not perform engineering calculations. It only manages the BOQ document structure."
    }
  },
  {
    "@type": "Question",
    "name": "Can I track testing and commissioning?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, testing and commissioning should be structured as specific items or sections within the BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "Is it suitable for sprinkler system BOQs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, the platform can organize all components of a sprinkler system, including pipework and heads, into a structured format."
    }
  },
  {
    "@type": "Question",
    "name": "How do you handle consultant revisions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara’s revision control allows you to update specific sections based on new consultant instructions while retaining an audit trail."
    }
  },
  {
    "@type": "Question",
    "name": "Can I export a professional proposal?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can generate formatted PDF proposals based on the finalized and priced BOQ."
    }
  }
]
        }
      ]
    }
  };

  return <IndustryLandingPage content={content} />;
}
