import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Contractors, Estimators and Quantity Surveyors",
  description: "Manage structured BOQs, project records, revisions, templates and supported outputs using Quantara’s AI-assisted construction workflow platform.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software",
  },
  openGraph: {
    title: "BOQ Software for Contractors, Estimators and Quantity Surveyors | Quantara",
    description: "Manage structured BOQs, project records, revisions, templates and supported outputs using Quantara’s AI-assisted construction workflow platform.",
    url: "https://quantara.vistabylara.com/boq-software",
    siteName: "Quantara",
  },
  twitter: {
    title: "BOQ Software for Contractors, Estimators and Quantity Surveyors | Quantara",
    description: "Manage structured BOQs, project records, revisions, templates and supported outputs using Quantara’s AI-assisted construction workflow platform.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "BOQ Software",
  h1: "BOQ Software for Controlled Construction and Estimating Workflows",
  directDefinition: "BOQ software provides a structured, hierarchical database environment designed specifically to manage Bills of Quantities, replacing fragile spreadsheets with controlled project records, revision tracking, and standardized templates.",
  audience: {
    heading: "Who Relies on BOQ Software?",
    content: "Professional BOQ software is essential for teams managing complex project scopes and commercial data.",
    items: ["Commercial Managers overseeing project budgets","Estimators requiring stable calculation environments","Quantity Surveyors tracking variations","Contractors standardizing their bidding process"]
  },
  workflowProblem: {
    heading: "The Limitations of Spreadsheets",
    paragraphs: ["While spreadsheets are universally accessible, they lack the structural integrity required for complex construction projects. Formulas can be easily overwritten, rows accidentally hidden, and version control quickly becomes a chaotic exchange of renamed files.","When managing a BOQ with thousands of items across multiple trades, the lack of a strict hierarchy and audit trail creates immense commercial risk. Teams need a system that understands the specific relationship between sections, items, quantities, and rates."]
  },
  quantaraSupport: {
    heading: "Structured BOQ Management with Quantara",
    paragraphs: ["Quantara provides a purpose-built environment for BOQ administration. It enforces a logical hierarchy where projects contain sections, and sections contain items with specific attributes like descriptions, units, and quantities.","By moving from a flat spreadsheet to a relational structure, teams can apply standardized templates, track revisions with confidence, and generate professional outputs without fear of broken formatting."]
  },
  relevantFeatures: [{"name":"Hierarchical Structure","status":"Live","description":"Manage complex nesting of sections and line items."},{"name":"Revision Tracking","status":"Preview UI","description":"Maintain a history of changes across the project lifecycle."},{"name":"Template Governance","status":"Live","description":"Apply standardized formats across all projects."}],
  workflowExample: {
    heading: "BOQ Standardization Workflow",
    introduction: "How a contractor standardizes an incoming, messy BOQ:",
    steps: [{"title":"Import Data","description":"The raw BOQ data is imported via PDF extraction or CSV."},{"title":"Apply Structure","description":"Items are organized into the contractor's standard trade packages."},{"title":"Rate Application","description":"The estimator applies standard rates within the controlled environment."},{"title":"Peer Review","description":"A commercial manager reviews the structured data."},{"title":"Client Export","description":"A clean, formatted PDF is generated for the final bid."}]
  },
  supportedInputs: [{"name":"XLSX / CSV","status":"Live","description":"Direct import of existing spreadsheet data."},{"name":"Text-based PDF","status":"Live","description":"AI-assisted extraction from PDFs."},{"name":"Scanned/Image-Only PDF — Detection","status":"Live","description":"Identifies scanned/image-only pages and flags them as requiring OCR; no text is extracted from them yet."},{"name":"Scanned/Image-Only PDF — OCR","status":"Planned","description":"Automated text recognition for image-based documents is not yet implemented.","limitation":"Scanned pages currently require manual transcription."},{"name":"IFC","status":"Planned","description":"Model data integration.","limitation":"Capability and processing method to be confirmed after technical validation."}],
  supportedOutputs: [{"name":"XLSX Export","status":"Live","description":"Structured spreadsheet output."},{"name":"PDF Generation","status":"Live","description":"Professional document generation."},{"name":"Technical Reports","status":"Live","description":"Formatted project summaries."}],
  limitations: ["Quantara is a BOQ management tool, not a full ERP or accounting system.","It does not automatically generate pricing data without user input.","All structural changes and rate applications require professional review."],
  faqs: [{"question":"What does BOQ software do?","answer":"BOQ software provides a structured database environment to manage the hierarchy, items, quantities, and revisions of a Bill of Quantities, replacing unstructured spreadsheets."},{"question":"Who uses BOQ software?","answer":"It is primarily used by contractors, estimators, quantity surveyors, and commercial managers in the construction industry."},{"question":"Can BOQ software replace Excel?","answer":"Yes, for the specific task of managing BOQs, dedicated software offers much stronger data integrity, version control, and template governance than Excel."},{"question":"What information is stored in a BOQ?","answer":"A BOQ typically stores hierarchical sections, item descriptions, quantities, units of measure, rates, and total amounts."},{"question":"How are BOQ revisions managed?","answer":"In a structured system like Quantara, revisions are tracked as distinct project states, allowing teams to maintain a clear audit trail of changes."},{"question":"Can multiple projects be managed?","answer":"Yes, Quantara provides a centralized workspace to manage multiple projects, clients, and templates simultaneously."},{"question":"Does BOQ software calculate rates automatically?","answer":"While the software calculates totals based on user-provided rates and quantities, it does not invent or automatically determine the commercial rates."},{"question":"How does Quantara handle professional review?","answer":"Quantara requires that all extracted and structured data be reviewed and approved by a qualified professional before any commercial use."}],
  relatedPages: [{"href":"/boq-management","label":"BOQ Management","description":"Deep dive into project control and governance."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Understand how BOQs support the estimating workflow."},{"href":"/quantity-surveying-software","label":"Quantity Surveying","description":"Software support for professional QS workflows."},{"href":"/boq-document-generation","label":"Document Generation","description":"Creating professional outputs from structured data."},{"href":"/about","label":"About Quantara","description":"Learn about the Vista By Lara team behind Quantara."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/boq-software" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/boq-software#webpage",
                "url": "https://quantara.vistabylara.com/boq-software",
                "name": "BOQ Software for Contractors, Estimators and Quantity Surveyors | Quantara",
                "description": "Manage structured BOQs, project records, revisions, templates and supported outputs using Quantara’s AI-assisted construction workflow platform.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/boq-software#breadcrumb",
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
                    "name": "BOQ Software"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/boq-software#faq",
                "mainEntity": content.faqs.map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                  }
                }))
              }
            ]
          })
        }}
      />
    </>
  );
}
