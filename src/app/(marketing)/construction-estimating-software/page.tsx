import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "Construction Estimating Software and BOQ Workflows | Quantara",
  description: "Organize project scope, BOQ items, quantities, templates, revisions and professional outputs with Quantara’s construction-estimating workflow platform.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/construction-estimating-software",
  },
  openGraph: {
    title: "Construction Estimating Software and BOQ Workflows | Quantara",
    description: "Organize project scope, BOQ items, quantities, templates, revisions and professional outputs with Quantara’s construction-estimating workflow platform.",
    url: "https://quantara.vistabylara.com/construction-estimating-software",
    siteName: "Quantara",
  },
  twitter: {
    title: "Construction Estimating Software and BOQ Workflows | Quantara",
    description: "Organize project scope, BOQ items, quantities, templates, revisions and professional outputs with Quantara’s construction-estimating workflow platform.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "Construction Estimating",
  h1: "Construction Estimating Software Built Around Structured BOQ Workflows",
  directDefinition: "Construction estimating software centralizes the organization of project scope, item quantities, and pricing structures, enabling estimators to transition from raw project documents to accurate, professionally reviewed commercial proposals.",
  audience: {
    heading: "Who Uses Estimating Workflows?",
    content: "Structured estimating workflows are critical for teams responsible for accurate project pricing and risk management.",
    items: ["Main Contractors preparing tender bids","MEP Subcontractors pricing specialized scope","Fit-out Companies managing detailed material lists","Consultants verifying project budgets"]
  },
  workflowProblem: {
    heading: "The Risk of Disconnected Estimating",
    paragraphs: ["Estimating is often a fragmented process. Quantities are extracted in one tool, formatted in another, and priced in a third. This disjointed workflow leads to version control issues, lost assumptions, and a high risk of commercial errors when late revisions are introduced.","Without a centralized, structured relationship between the source BOQ and the final estimate, teams struggle to maintain governance over their pricing templates and project records."]
  },
  quantaraSupport: {
    heading: "Connecting Scope to Commercial Output",
    paragraphs: ["Quantara bridges the gap between raw document extraction and structured estimating. By bringing the BOQ into a controlled database environment, estimators can apply their rates, assumptions, and exclusions to a stable, hierarchical structure.","This ensures that when a revision occurs, the changes are tracked cleanly against the established project scope, rather than getting lost in a labyrinth of spreadsheet tabs."]
  },
  relevantFeatures: [{"name":"Structured Workspaces","status":"Live","description":"Maintain clear boundaries between project scope and pricing."},{"name":"Revision Control","status":"Preview UI","description":"Track changes to quantities and scope over time."},{"name":"Template Management","status":"Live","description":"Apply consistent corporate formatting to all estimates."}],
  workflowExample: {
    heading: "Structured Estimating Workflow",
    introduction: "How an estimating team handles a complex tender:",
    steps: [{"title":"Scope Ingestion","description":"The client's BOQ is extracted from a PDF into Quantara."},{"title":"Verification","description":"The estimator reviews the extracted items against the drawings."},{"title":"Pricing Structure","description":"The BOQ is mapped to the company's internal cost codes and templates."},{"title":"Commercial Review","description":"Management reviews the structured estimate and assumptions."},{"title":"Proposal Generation","description":"A formal PDF proposal is generated directly from the approved data."}]
  },
  supportedInputs: [{"name":"XLSX / CSV","status":"Live","description":"Importing pricing databases or client BOQs."},{"name":"Text-based PDF","status":"Live","description":"Extracting scope from consultant documents."},{"name":"Scanned PDF","status":"Live","description":"Processing legacy or image-based tender files."},{"name":"BIM / IFC","status":"Planned","description":"Future integration for model-based quantity extraction.","limitation":"Capability and processing method to be confirmed after technical validation."}],
  supportedOutputs: [{"name":"XLSX Export","status":"Live","description":"Data export for downstream ERP systems."},{"name":"PDF Generation","status":"Live","description":"Client-ready proposals and BOQs."},{"name":"Technical Reports","status":"Live","description":"Internal review and assumption documents."}],
  limitations: ["Quantara does not automatically calculate or guarantee final project costs.","It relies entirely on the professional estimator to provide accurate rates and verify scope.","It is not a substitute for professional commercial management."],
  faqs: [{"question":"What is construction estimating software?","answer":"It is software designed to help professionals organize project scope, quantities, and rates to produce accurate commercial proposals and bids."},{"question":"How is a BOQ used in estimating?","answer":"The BOQ provides the structured list of items and quantities that form the foundation of the estimate; the estimator applies rates to these items to determine the cost."},{"question":"What is the difference between quantity takeoff and estimating?","answer":"Quantity takeoff is the process of measuring amounts from drawings. Estimating is the process of applying costs, risks, and overheads to those quantities."},{"question":"Can Quantara calculate complete project prices?","answer":"Quantara calculates totals based on the specific rates and formulas entered by the user, but it does not automatically generate or guarantee the commercial pricing itself."},{"question":"How should rates and assumptions be reviewed?","answer":"All commercial data must be thoroughly reviewed by a qualified estimator or commercial manager before submission."},{"question":"Can estimates be revised?","answer":"Yes, Quantara’s structured environment is designed to handle project revisions and track changes to the scope."},{"question":"Can outputs be generated for client review?","answer":"Yes, Quantara can generate professional PDF and XLSX documents suitable for client submission."},{"question":"Does Quantara replace a commercial manager?","answer":"No. Quantara organizes data; it does not provide the strategic, commercial, or risk-management expertise of a professional manager."}],
  relatedPages: [{"href":"/boq-software","label":"BOQ Software","description":"The foundation of structured project data."},{"href":"/boq-management","label":"BOQ Management","description":"How to control revisions and project records."},{"href":"/quantity-surveying-software","label":"Quantity Surveying","description":"Workflows for professional quantity surveyors."},{"href":"/boq-document-generation","label":"Document Generation","description":"Creating professional proposals."},{"href":"/features","label":"Product Features","description":"Explore all Quantara capabilities."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/construction-estimating-software" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/construction-estimating-software#webpage",
                "url": "https://quantara.vistabylara.com/construction-estimating-software",
                "name": "Construction Estimating Software and BOQ Workflows | Quantara",
                "description": "Organize project scope, BOQ items, quantities, templates, revisions and professional outputs with Quantara’s construction-estimating workflow platform.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/construction-estimating-software#breadcrumb",
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
                    "name": "Construction Estimating"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/construction-estimating-software#faq",
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
