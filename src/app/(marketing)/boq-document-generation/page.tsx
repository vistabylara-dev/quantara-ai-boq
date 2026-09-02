import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-document-generation", locale);
}



const content: SeoLandingPageContent = {
  breadcrumbLabel: "Document Generation",
  h1: "BOQ Document Generation from Structured, Reviewed Project Data",
  directDefinition: "BOQ document generation applies a supported template to structured project data to create reviewable proposals, reports and exports. Every generated file still requires professional checking before issue.",
  audience: {
    heading: "Who Uses Document Generation?",
    content: "Professional outputs are essential for any team submitting bids, variations, or commercial reports.",
    items: ["Estimators finalizing tender submissions","Quantity Surveyors issuing variation reports","Contractors generating internal budget summaries","Commercial Managers standardizing corporate proposals"]
  },
  workflowProblem: {
    heading: "The Formatting Nightmare",
    paragraphs: ["Spreadsheet formatting can introduce page-break, heading, font and formula problems while teams prepare a BOQ for issue.","Hidden rows, broken formulas or inconsistent pagination can affect a commercial submission, so the final output must be checked against the reviewed project data."]
  },
  quantaraSupport: {
    heading: "Template-Based, Reviewable Formatting",
    paragraphs: ["Quantara separates stored BOQ data from its presentation and applies a selected supported template to generate PDF and XLSX outputs.","Templates can reduce repeated formatting steps, but they do not remove risk. Users must review pagination, totals, headings, branding and the underlying data before issue."]
  },
  relevantFeatures: [{"name":"Available Templates","capabilityId":"document-templates","description":"Apply supported branding and layout settings where configured."},{"name":"PDF Generation","capabilityId":"professional-outputs","description":"Generate paginated PDF outputs for review."},{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Export structured BOQ data for further professional use."}],
  workflowExample: {
    heading: "Finalizing a Tender Submission",
    introduction: "How a team prepares the final bid document:",
    steps: [{"title":"Final Review","description":"The responsible professional reviews the structured BOQ data."},{"title":"Select Template","description":"The user selects an available output template."},{"title":"Generation","description":"Quantara formats the stored data into the selected supported output."},{"title":"Verification","description":"The team checks layout, data, calculations and totals against the reviewed project record."},{"title":"Approval and Issue","description":"The responsible professional approves the checked files before they are issued."}]
  },
  supportedInputs: [{"name":"Structured Database","capabilityId":"boq-management","description":"Generation relies entirely on data already reviewed and structured within Quantara."}],
  supportedOutputs: [{"name":"PDF Outputs","capabilityId":"professional-outputs","description":"Reviewable proposals and BOQ documents generated from stored data."},{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Structured spreadsheet exports for further professional use."},{"name":"Technical Reports","capabilityId":"technical-report-generation","description":"DOCX project summaries and assumption documents in supported configured environments."}],
  limitations: ["Document generation depends on the reviewed data stored in the project.","Templates must be configured and checked before use.","Generated documents still require a final visual and data check by a professional before submission."],
  faqs: [{"question":"What is BOQ document generation?","answer":"It applies a supported template to structured BOQ data to create a formatted output such as a PDF."},{"question":"Which outputs does Quantara support?","answer":"The BOQ document workflow supports PDF, XLSX, CSV, DOCX and HTML formats. Technical-report generation is a separate limited DOCX workflow in supported configured environments, and every output requires professional review."},{"question":"Can templates be controlled?","answer":"Available templates can standardize supported branding and layout, but their configuration and every generated result must be checked."},{"question":"Can proposals be generated?","answer":"Structured data can be used with an available proposal template, subject to final professional review before client submission."},{"question":"Are generated documents final?","answer":"No. A qualified professional must review and approve each document before it is issued."},{"question":"Can documents contain formatting issues?","answer":"Yes. Templates can reduce repeated formatting work, but pagination, headings, totals and layout can still require correction."},{"question":"Can outputs be revised?","answer":"A new output can be generated after the underlying data and selected template are reviewed; no fixed generation time is promised."},{"question":"Who approves the final document?","answer":"The responsible estimator, quantity surveyor or commercial manager must approve any document before it is issued contractually."}],
  relatedPages: [{"href":"/boq-management","label":"BOQ Management","description":"How to structure the data before generation."},{"href":"/boq-software","label":"BOQ Software","description":"The foundation of structured project records."},{"href":"/pdf-boq-extraction","label":"PDF BOQ Extraction","description":"How data enters the system."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Applying pricing before generation."},{"href":"/features","label":"Product Features","description":"View all capabilities."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/boq-document-generation" />;
}
