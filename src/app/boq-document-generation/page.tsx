import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "BOQ Document Generation for Professional Project Outputs | Quantara",
  description: "Generate supported BOQ documents, proposals, technical reports and export formats using structured project data and governed templates in Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-document-generation",
  },
  openGraph: {
    title: "BOQ Document Generation for Professional Project Outputs | Quantara",
    description: "Generate supported BOQ documents, proposals, technical reports and export formats using structured project data and governed templates in Quantara.",
    url: "https://quantara.vistabylara.com/boq-document-generation",
    siteName: "Quantara",
  },
  twitter: {
    title: "BOQ Document Generation for Professional Project Outputs | Quantara",
    description: "Generate supported BOQ documents, proposals, technical reports and export formats using structured project data and governed templates in Quantara.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "Document Generation",
  h1: "BOQ Document Generation from Structured, Reviewed Project Data",
  directDefinition: "BOQ document generation is the final step in the workflow, where structured, professionally reviewed project data is automatically formatted into standardized, client-ready proposals, reports, and exports.",
  audience: {
    heading: "Who Uses Document Generation?",
    content: "Professional outputs are essential for any team submitting bids, variations, or commercial reports.",
    items: ["Estimators finalizing tender submissions","Quantity Surveyors issuing variation reports","Contractors generating internal budget summaries","Commercial Managers standardizing corporate proposals"]
  },
  workflowProblem: {
    heading: "The Formatting Nightmare",
    paragraphs: ["After spending weeks accurately pricing a complex BOQ, teams often spend hours—or days—struggling with spreadsheet formatting. Page breaks cut across items, headers disappear, fonts mismatch, and formula errors are accidentally introduced during the \"beautification\" process.","Manual formatting is not just a waste of professional time; it introduces significant risk. A single hidden row or broken formula in the final PDF export can completely invalidate a multi-million dollar bid."]
  },
  quantaraSupport: {
    heading: "Automated, Governed Formatting",
    paragraphs: ["Quantara separates the data from the presentation. Because the BOQ is stored in a structured database, the software can automatically apply governed corporate templates to generate flawless PDF documents and clean XLSX files.","This ensures that the final document perfectly reflects the reviewed data, without the risk of manual formatting errors, allowing teams to generate professional proposals in seconds rather than hours."]
  },
  relevantFeatures: [{"name":"Governed Templates","status":"Live","description":"Apply standard corporate branding and layouts."},{"name":"PDF Generation","status":"Live","description":"Create clean, paginated, professional PDF documents."},{"name":"Clean XLSX Export","status":"Live","description":"Export raw data without messy, hardcoded spreadsheet formatting."}],
  workflowExample: {
    heading: "Finalizing a Tender Submission",
    introduction: "How a team prepares the final bid document:",
    steps: [{"title":"Final Review","description":"The Commercial Manager approves the structured BOQ data."},{"title":"Select Template","description":"The user selects the 'Client Tender Submission' template."},{"title":"Generation","description":"Quantara automatically formats the data into a paginated PDF."},{"title":"Verification","description":"The team quickly verifies the layout and totals."},{"title":"Submission","description":"The flawless PDF and accompanying XLSX are submitted to the client."}]
  },
  supportedInputs: [{"name":"Structured Database","status":"Live","description":"Generation relies entirely on data already reviewed and structured within Quantara."}],
  supportedOutputs: [{"name":"Professional PDFs","status":"Live","description":"Client-ready proposals and BOQs."},{"name":"XLSX Export","status":"Live","description":"Clean data exports for integration with other systems."},{"name":"Technical Reports","status":"Live","description":"Internal summaries and assumption documents."}],
  limitations: ["Document generation is only as accurate as the data approved within the system.","Templates must be configured in advance to ensure correct formatting.","Generated documents still require a final visual check by a professional before submission."],
  faqs: [{"question":"What is BOQ document generation?","answer":"It is the automated process of taking structured BOQ data and applying a predefined template to create a formatted, professional document (like a PDF)."},{"question":"Which outputs does Quantara support?","answer":"Quantara currently supports professional PDF generation, clean XLSX exports, and internal technical reports."},{"question":"Can templates be controlled?","answer":"Yes, Quantara allows organizations to govern templates to ensure consistent branding and layout across all projects."},{"question":"Can proposals be generated?","answer":"Yes, structured data can be wrapped in proposal templates suitable for client submission."},{"question":"Are generated documents final?","answer":"No document is truly final until it has been reviewed and signed off by a qualified professional."},{"question":"Can documents contain formatting issues?","answer":"While automated templates drastically reduce formatting errors compared to manual spreadsheets, a final visual review is always recommended."},{"question":"Can outputs be revised?","answer":"If the underlying data changes, a new version of the document can be generated instantly."},{"question":"Who approves the final document?","answer":"The responsible estimator, quantity surveyor, or commercial manager must approve any document before it is issued contractually."}],
  relatedPages: [{"href":"/boq-management","label":"BOQ Management","description":"How to structure the data before generation."},{"href":"/boq-software","label":"BOQ Software","description":"The foundation of structured project records."},{"href":"/pdf-boq-extraction","label":"PDF BOQ Extraction","description":"How data enters the system."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Applying pricing before generation."},{"href":"/features","label":"Product Features","description":"View all capabilities."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/boq-document-generation" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/boq-document-generation#webpage",
                "url": "https://quantara.vistabylara.com/boq-document-generation",
                "name": "BOQ Document Generation for Professional Project Outputs | Quantara",
                "description": "Generate supported BOQ documents, proposals, technical reports and export formats using structured project data and governed templates in Quantara.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/boq-document-generation#breadcrumb",
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
                    "name": "Document Generation"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/boq-document-generation#faq",
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
