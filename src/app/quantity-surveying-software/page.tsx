import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "Quantity Surveying Software for BOQ and Document Workflows | Quantara",
  description: "Support quantity-surveying workflows with structured BOQs, project records, revisions, templates and professionally reviewed document outputs using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/quantity-surveying-software",
  },
  openGraph: {
    title: "Quantity Surveying Software for BOQ and Document Workflows | Quantara",
    description: "Support quantity-surveying workflows with structured BOQs, project records, revisions, templates and professionally reviewed document outputs using Quantara.",
    url: "https://quantara.vistabylara.com/quantity-surveying-software",
    siteName: "Quantara",
  },
  twitter: {
    title: "Quantity Surveying Software for BOQ and Document Workflows | Quantara",
    description: "Support quantity-surveying workflows with structured BOQs, project records, revisions, templates and professionally reviewed document outputs using Quantara.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "Quantity Surveying",
  h1: "Quantity Surveying Software for Structured BOQ Review and Project Control",
  directDefinition: "Software tailored for quantity surveyors provides the structured environment necessary to manage complex Bills of Quantities, track commercial revisions, and maintain strict governance over project costs and tender documentation.",
  audience: {
    heading: "Built for Commercial Professionals",
    content: "Quantara is designed to support the rigorous standards of professional quantity surveying.",
    items: ["Client Quantity Surveyors preparing tender packages","Contractor QS teams pricing and managing variations","Commercial Managers overseeing project risk","Cost Consultants structuring master templates"]
  },
  workflowProblem: {
    heading: "The Burden of Administrative Tasks",
    paragraphs: ["Quantity surveyors are highly trained professionals whose value lies in commercial strategy, risk management, and cost control. However, a massive portion of a QS's time is often consumed by low-level administrative tasks: reformatting messy spreadsheets, tracking down version differences, and manually typing out tender documents.","When QS teams are bogged down in administration, they have less time for the high-value analytical work that actually protects the project's margin."]
  },
  quantaraSupport: {
    heading: "Elevating the QS Role",
    paragraphs: ["Quantara automates the administrative burden of BOQ management. By handling the extraction of data from PDFs, enforcing template governance, and automatically tracking revisions, the software frees the QS to focus on professional review and rate analysis.","It provides the structured database environment necessary for a QS to manage complex commercial data with confidence, knowing the underlying structure is secure."]
  },
  relevantFeatures: [{"name":"Revision Auditing","status":"Preview UI","description":"Track every commercial change made to a BOQ."},{"name":"Template Control","status":"Live","description":"Ensure all tenders follow the master corporate format."},{"name":"Structured Workspaces","status":"Live","description":"Organize data by project, phase, and client."}],
  workflowExample: {
    heading: "Managing a Tender Variation",
    introduction: "How a Quantity Surveyor handles a mid-tender design update:",
    steps: [{"title":"Baseline Snapshot","description":"The QS locks the original BOQ as a baseline revision."},{"title":"Import Variation","description":"New quantities are imported from the architect's updated schedules."},{"title":"Commercial Analysis","description":"The QS analyzes the cost impact of the changed quantities."},{"title":"Apply Rates","description":"New or revised rates are applied to the changed items."},{"title":"Generate Report","description":"A formal variation report is generated for client approval."}]
  },
  supportedInputs: [{"name":"Text-based PDF","status":"Live","description":"Extracting data from consultant documents."},{"name":"XLSX / CSV","status":"Live","description":"Importing pricing data or measurement schedules."},{"name":"BIM / CAD","status":"Planned","description":"Future integration for model-based quantity extraction.","limitation":"Capability and processing method to be confirmed after technical validation."}],
  supportedOutputs: [{"name":"Professional PDF Proposals","status":"Live","description":"Formatted documents for client submission."},{"name":"XLSX Export","status":"Live","description":"Data export for downstream ERP or accounting systems."},{"name":"Technical Reports","status":"Live","description":"Internal commercial reviews and variation summaries."}],
  limitations: ["Quantara does not perform regulated professional judgment or certify costs.","It does not automatically generate pricing data.","It is a tool to support the QS, not a replacement for their expertise."],
  faqs: [{"question":"What software do quantity surveyors use?","answer":<React.Fragment>Quantity surveyors use a range of software, including <Link href="/quantity-takeoff-vs-boq-software" className="text-blue-600 hover:underline">measurement tools for takeoff</Link>, estimating platforms (for pricing), and BOQ management systems like Quantara (for structuring and revising data).</React.Fragment>,"schemaAnswer":"Quantity surveyors use a range of software, including measurement tools for takeoff, estimating platforms (for pricing), and BOQ management systems like Quantara (for structuring and revising data)."},{"question":"Can Quantara replace a quantity surveyor?","answer":"Absolutely not. Quantara is an administrative tool that organizes data; it cannot replicate the commercial judgment, risk analysis, or strategic expertise of a professional QS."},{"question":"Can Quantara support tender BOQs?","answer":"Yes, Quantara provides the structured environment necessary to prepare, format, and manage tender documentation."},{"question":"Does Quantara perform measurement?","answer":"No, Quantara currently focuses on structuring existing BOQ data, not measuring quantities from CAD or PDF drawings."},{"question":"Can revisions be tracked?","answer":"Yes, revision tracking allows QS teams to maintain a clear audit trail of commercial changes."},{"question":"Can templates be governed?","answer":"Yes, companies can enforce standard BOQ templates across all projects to ensure consistency."},{"question":"Can project records be organized?","answer":"Yes, Quantara provides secure, hierarchical workspaces for clients and projects."},{"question":"What must a quantity surveyor verify?","answer":"A QS must independently verify all extracted quantities, unit rates, assumptions, and final commercial totals before any document is issued."}],
  relatedPages: [{"href":"/boq-software","label":"BOQ Software","description":"The foundation of structured project data."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Applying managed data to commercial estimates."},{"href":"/boq-management","label":"BOQ Management","description":"How to control revisions and project records."},{"href":"/boq-document-generation","label":"Document Generation","description":"Creating professional outputs."},{"href":"/about","label":"About Quantara","description":"Learn about the team behind the platform."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/quantity-surveying-software" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/quantity-surveying-software#webpage",
                "url": "https://quantara.vistabylara.com/quantity-surveying-software",
                "name": "Quantity Surveying Software for BOQ and Document Workflows | Quantara",
                "description": "Support quantity-surveying workflows with structured BOQs, project records, revisions, templates and professionally reviewed document outputs using Quantara.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/quantity-surveying-software#breadcrumb",
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
                    "name": "Quantity Surveying"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/quantity-surveying-software#faq",
                "mainEntity": content.faqs.map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.schemaAnswer || faq.answer
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
