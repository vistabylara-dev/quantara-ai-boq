import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: "Construction Estimating Software UAE and BOQ Workflows | Quantara",
  description: "Organize UAE construction scope, BOQ items, revisions, templates, assumptions and professional estimating outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/construction-estimating-software-uae",
  },
  openGraph: {
    title: "Construction Estimating Software UAE and BOQ Workflows | Quantara",
    description: "Organize UAE construction scope, BOQ items, revisions, templates, assumptions and professional estimating outputs using Quantara.",
    url: "https://quantara.vistabylara.com/construction-estimating-software-uae",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Construction Estimating Software UAE and BOQ Workflows | Quantara",
    description: "Organize UAE construction scope, BOQ items, revisions, templates, assumptions and professional estimating outputs using Quantara.",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: "UAE Estimating Software",
    breadcrumbParent: {"href":"/gcc-boq-software","label":"GCC BOQ Software"},
    title: "Construction Estimating Software for UAE BOQ and Project Workflows",
    audienceDescription: "For UAE teams linking BOQ preparation to their core construction-estimating processes.",
    directAnswer: "Quantara provides a structured foundation for UAE estimating teams, organizing BOQ items, quantities, and assumptions before professional pricing review.",
    challenges: [
  {
    "title": "Unstructured Estimating Data",
    "description": "Estimators frequently waste hours re-typing BOQ descriptions from PDFs into pricing spreadsheets, risking critical omissions."
  },
  {
    "title": "Tracking Assumptions",
    "description": "Failing to clearly link commercial assumptions and exclusions to specific BOQ items often leads to disputes post-award."
  }
],
    workflowDescription: "Quantara clarifies the BOQ-to-estimate relationship by allowing teams to structure quantities, units, rates, and explicit assumptions. Users can apply company templates to supported project documents, ensuring a clean baseline for professional pricing review.",
    workflowExample: "A UAE estimator imports a scanned PDF BOQ into Quantara. They structure the items, add specific notes for their commercial exclusions, and export the clean, organized list to Excel for final rate application.",
    typicalCategories: [
  "Site Preparation",
  "Concrete Works",
  "Masonry",
  "Metals",
  "Finishes"
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
  "Quantara does not provide an automatic final-cost guarantee.",
  "Quantara does not claim to include UAE rate libraries or databases.",
  "Quantara does not calculate VAT or other statutory deductions."
],
    faqs: [
  {
    "question": "How does Quantara assist UAE estimators?",
    "answer": "It accelerates the pre-pricing phase by structuring BOQ documents, allowing estimators to focus on applying rates rather than data entry."
  },
  {
    "question": "Does it include a UAE pricing database?",
    "answer": "No, Quantara does not provide pre-built rate libraries. Estimators must use their own commercial rates."
  },
  {
    "question": "Can I track estimating assumptions?",
    "answer": "Yes, assumptions and exclusions can be documented directly against specific BOQ sections or items."
  },
  {
    "question": "Does Quantara guarantee final project costs?",
    "answer": "No, Quantara is a workflow tool. Final cost guarantees are entirely the responsibility of the estimating professional."
  },
  {
    "question": "Does it support VAT calculation?",
    "answer": "No, Quantara does not handle tax calculations like VAT."
  },
  {
    "question": "Can I export the structured BOQ to my estimating software?",
    "answer": "Yes, you can export the data to CSV or XLSX for import into your primary financial or estimating system."
  },
  {
    "question": "Are standard company templates supported?",
    "answer": "Yes, you can save your preferred BOQ structure as a template for future use."
  },
  {
    "question": "Does Quantara perform visual quantity takeoff?",
    "answer": "No, automated drawing measurement and visual takeoff are Planned features."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-uae",
    "label": "BOQ Software UAE"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/boq-vs-construction-estimate",
    "label": "BOQ vs Construction Estimate"
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
          "@id": "https://quantara.vistabylara.com/construction-estimating-software-uae",
          "url": "https://quantara.vistabylara.com/construction-estimating-software-uae",
          "name": "Construction Estimating Software UAE and BOQ Workflows | Quantara",
          "description": "Organize UAE construction scope, BOQ items, revisions, templates, assumptions and professional estimating outputs using Quantara."
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
              "name": "UAE Estimating Software",
              "item": "https://quantara.vistabylara.com/construction-estimating-software-uae"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
  {
    "@type": "Question",
    "name": "How does Quantara assist UAE estimators?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "It accelerates the pre-pricing phase by structuring BOQ documents, allowing estimators to focus on applying rates rather than data entry."
    }
  },
  {
    "@type": "Question",
    "name": "Does it include a UAE pricing database?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not provide pre-built rate libraries. Estimators must use their own commercial rates."
    }
  },
  {
    "@type": "Question",
    "name": "Can I track estimating assumptions?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, assumptions and exclusions can be documented directly against specific BOQ sections or items."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara guarantee final project costs?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara is a workflow tool. Final cost guarantees are entirely the responsibility of the estimating professional."
    }
  },
  {
    "@type": "Question",
    "name": "Does it support VAT calculation?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, Quantara does not handle tax calculations like VAT."
    }
  },
  {
    "@type": "Question",
    "name": "Can I export the structured BOQ to my estimating software?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can export the data to CSV or XLSX for import into your primary financial or estimating system."
    }
  },
  {
    "@type": "Question",
    "name": "Are standard company templates supported?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Yes, you can save your preferred BOQ structure as a template for future use."
    }
  },
  {
    "@type": "Question",
    "name": "Does Quantara perform visual quantity takeoff?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "No, automated drawing measurement and visual takeoff are Planned features."
    }
  }
]
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
