import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software Abu Dhabi for Construction and Engineering Teams | Quantara",
  description: "Organize Abu Dhabi BOQ workflows, project records, revisions, templates and supported professional outputs with Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-abu-dhabi",
  },
  openGraph: {
    title: "BOQ Software Abu Dhabi for Construction and Engineering Teams | Quantara",
    description: "Organize Abu Dhabi BOQ workflows, project records, revisions, templates and supported professional outputs with Quantara.",
    url: "https://quantara.vistabylara.com/boq-software-abu-dhabi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BOQ Software Abu Dhabi for Construction and Engineering Teams | Quantara",
    description: "Organize Abu Dhabi BOQ workflows, project records, revisions, templates and supported professional outputs with Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "BOQ Software Abu Dhabi",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "BOQ Software for Abu Dhabi Construction and Engineering Workflows",
    audienceDescription: "For Abu Dhabi construction, engineering and facilities-management teams requiring robust BOQ structuring.",
    directAnswer: "Quantara helps Abu Dhabi project teams organize consultant and contractor documentation, manage revisions, and structure engineering workflows.",
    challenges: [
  {
    "title": "Complex Engineering Documentation",
    "description": "Large-scale infrastructure and engineering projects generate massive volumes of PDF and Excel documentation that must be structured accurately."
  },
  {
    "title": "Strict Consultant Standards",
    "description": "Matching the exact BOQ structure required by lead consultants across multiple project revisions demands tight document control."
  }
],
    workflowDescription: "Quantara supports structured records for engineering and facilities-management workflows. By organizing supported documents into controlled templates, teams can manage project revisions efficiently and prepare data for professional output review.",
    workflowExample: "An Abu Dhabi engineering consultant uses Quantara to consolidate multiple PDF BOQ sections from various disciplines into a single, unified project record before issuing it to contractors for tender.",
    typicalCategories: [
  "Infrastructure Works",
  "Civil Engineering",
  "Facilities Management",
  "MEP Services",
  "General Preliminaries"
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
  "Quantara does not claim public-sector approval or regulatory integration.",
  "Quantara does not perform engineering validation or design compliance checks.",
  "All outputs must be reviewed by qualified local engineering professionals."
],
    faqs: [
  {
    "question": "Is Quantara suitable for Abu Dhabi engineering consultants?",
    "answer": "Yes, it provides the structured workflows necessary to organize multidisciplinary BOQs and track revisions."
  },
  {
    "question": "Does Quantara have Abu Dhabi public-sector approval?",
    "answer": "No, Quantara does not claim any specific public-sector approval or regulatory certification."
  },
  {
    "question": "Can facilities-management teams use Quantara?",
    "answer": "Yes, FM teams can structure BOQs for refurbishment and maintenance works using the platform."
  },
  {
    "question": "Does it support standard measurement methods like CESMM?",
    "answer": "Quantara provides the structure, but it does not strictly enforce or automatically apply CESMM or any other specific measurement standard."
  },
  {
    "question": "Can I consolidate multiple consultant PDFs?",
    "answer": "Yes, you can extract items from multiple PDFs and organize them into a single, structured project BOQ."
  },
  {
    "question": "How is revision control handled for large projects?",
    "answer": "Revisions are tracked sequentially, allowing teams to maintain a clear audit trail of changes over time."
  },
  {
    "question": "Can I share the BOQ with my team?",
    "answer": "Yes, Quantara supports collaborative project records for your internal team."
  },
  {
    "question": "Are CAD or BIM files supported?",
    "answer": "No, CAD, BIM, and IFC integrations are currently in the Planned phase."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-uae",
    "label": "BOQ Software UAE"
  },
  {
    "href": "/boq-software-for-engineering-consultants",
    "label": "Engineering Consultant BOQ"
  },
  {
    "href": "/boq-software-for-facilities-management",
    "label": "FM BOQ Software"
  },
  {
    "href": "/boq-management",
    "label": "BOQ Management"
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
          "@id": "https://quantara.vistabylara.com/boq-software-abu-dhabi",
          "url": "https://quantara.vistabylara.com/boq-software-abu-dhabi",
          "name": "BOQ Software Abu Dhabi for Construction and Engineering Teams | Quantara",
          "description": "Organize Abu Dhabi BOQ workflows, project records, revisions, templates and supported professional outputs with Quantara."
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
              "name": "BOQ Software Abu Dhabi",
              "item": "https://quantara.vistabylara.com/boq-software-abu-dhabi"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "Is Quantara suitable for Abu Dhabi engineering consultants?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, it provides the structured workflows necessary to organize multidisciplinary BOQs and track revisions."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara have Abu Dhabi public-sector approval?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not claim any specific public-sector approval or regulatory certification."
    }
  },
  {
    "@type": "Question",
    "name": "Can facilities-management teams use Quantara?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, FM teams can structure BOQs for refurbishment and maintenance works using the platform."
    }
  },
  {
    "@type": "Question",
    "name": "Does it support standard measurement methods like CESMM?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Quantara provides the structure, but it does not strictly enforce or automatically apply CESMM or any other specific measurement standard."
    }
  },
  {
    "@type": "Question",
    "name": "Can I consolidate multiple consultant PDFs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can extract items from multiple PDFs and organize them into a single, structured project BOQ."
    }
  },
  {
    "@type": "Question",
    "name": "How is revision control handled for large projects?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Revisions are tracked sequentially, allowing teams to maintain a clear audit trail of changes over time."
    }
  },
  {
    "@type": "Question",
    "name": "Can I share the BOQ with my team?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, Quantara supports collaborative project records for your internal team."
    }
  },
  {
    "@type": "Question",
    "name": "Are CAD or BIM files supported?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, CAD, BIM, and IFC integrations are currently in the Planned phase."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
