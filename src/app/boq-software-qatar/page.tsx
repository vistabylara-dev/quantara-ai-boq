import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software Qatar for Contractors and Project Teams | Quantara",
  description: "Organize Qatar BOQ workflows, project documents, revisions, templates and professional construction outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-qatar",
  },
  openGraph: {
    title: "BOQ Software Qatar for Contractors and Project Teams | Quantara",
    description: "Organize Qatar BOQ workflows, project documents, revisions, templates and professional construction outputs using Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-qatar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software Qatar for Contractors and Project Teams | Quantara",
    description: "Organize Qatar BOQ workflows, project documents, revisions, templates and professional construction outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "BOQ Software Qatar",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "BOQ Software for Qatar Construction and Project Workflows",
    audienceDescription: "For Qatar construction, MEP, consultant and contractor teams seeking structured BOQ workflows.",
    directAnswer: "Quantara provides Qatar project teams with a structured platform to manage consultant documentation, MEP coordination, and tender revisions.",
    challenges: [
  {
    "title": "Rigorous Consultant Review",
    "description": "Tender submissions often require strict adherence to consultant-issued BOQ formats, making manual data entry risky."
  },
  {
    "title": "MEP Coordination",
    "description": "Managing the overlap between structural and MEP BOQ sections requires clean, structured data organization."
  }
],
    workflowDescription: "Quantara assists with structuring BOQ records from consultant and contractor documentation. It simplifies MEP coordination, manages tender revisions, and utilizes templates to prepare documents for professional review.",
    workflowExample: "A Qatar-based MEP contractor uses Quantara to extract equipment schedules from a consultant’s PDF, structuring the items into a master BOQ to ensure no required testing and commissioning items are missed during pricing.",
    typicalCategories: [
  "Substructure",
  "Superstructure",
  "MEP Services",
  "External Works",
  "Provisional Sums"
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
  "Quantara does not claim Qatar regulatory compliance.",
  "Quantara does not include Qatar market-rate data or pricing libraries.",
  "Quantara does not integrate directly with local tender portals."
],
    faqs: [
  {
    "question": "Does Quantara support Qatar tender portals?",
    "answer": "No, Quantara does not integrate directly with local tender portals. You can export your structured BOQ to Excel for manual submission."
  },
  {
    "question": "Does it include Qatar market rates?",
    "answer": "No, Quantara does not provide pricing databases. You must use your own commercial rates."
  },
  {
    "question": "Can I manage MEP coordination?",
    "answer": "Yes, you can structure specific sections within your BOQ to clearly separate and coordinate MEP scope."
  },
  {
    "question": "Is it suitable for consultant workflows?",
    "answer": "Yes, consultants can use Quantara to structure their BOQs and manage revisions before issuing them to contractors."
  },
  {
    "question": "How do I handle scanned documents?",
    "answer": "Quantara supports OCR for scanned PDFs, but rigorous professional review of the extracted text is mandatory."
  },
  {
    "question": "Can I use company templates?",
    "answer": "Yes, you can save standardized BOQ structures as templates for recurring project types."
  },
  {
    "question": "Does Quantara validate compliance?",
    "answer": "No, it is a document workflow tool and does not validate engineering or regulatory compliance."
  },
  {
    "question": "Can I export a professional proposal?",
    "answer": "Yes, the platform allows you to generate formatted PDF proposals from your structured data."
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
    "href": "/boq-software-for-mep-contractors",
    "label": "MEP BOQ Software"
  },
  {
    "href": "/boq-revision-control",
    "label": "BOQ Revision Control"
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
          "@id": "https://quantara.vistabylara.com/boq-software-qatar",
          "url": "https://quantara.vistabylara.com/boq-software-qatar",
          "name": "BOQ Software Qatar for Contractors and Project Teams | Quantara",
          "description": "Organize Qatar BOQ workflows, project documents, revisions, templates and professional construction outputs using Quantara."
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
              "name": "BOQ Software Qatar",
              "item": "https://quantara.vistabylara.com/boq-software-qatar"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Does Quantara support Qatar tender portals?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not integrate directly with local tender portals. You can export your structured BOQ to Excel for manual submission."
    }
  },
  {
    "@type": "Question",
    "name": "Does it include Qatar market rates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not provide pricing databases. You must use your own commercial rates."
    }
  },
  {
    "@type": "Question",
    "name": "Can I manage MEP coordination?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can structure specific sections within your BOQ to clearly separate and coordinate MEP scope."
    }
  },
  {
    "@type": "Question",
    "name": "Is it suitable for consultant workflows?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, consultants can use Quantara to structure their BOQs and manage revisions before issuing them to contractors."
    }
  },
  {
    "@type": "Question",
    "name": "How do I handle scanned documents?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara supports OCR for scanned PDFs, but rigorous professional review of the extracted text is mandatory."
    }
  },
  {
    "@type": "Question",
    "name": "Can I use company templates?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can save standardized BOQ structures as templates for recurring project types."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara validate compliance?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, it is a document workflow tool and does not validate engineering or regulatory compliance."
    }
  },
  {
    "@type": "Question",
    "name": "Can I export a professional proposal?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, the platform allows you to generate formatted PDF proposals from your structured data."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
