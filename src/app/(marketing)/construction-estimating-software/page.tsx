import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/construction-estimating-software");



const content: SeoLandingPageContent = {
  breadcrumbLabel: "Construction Estimating",
  h1: "Construction Estimating Software Built Around Structured BOQ Workflows",
  directDefinition: "Construction estimating software helps teams organize project scope, item quantities, rates and assumptions. Quantara supports reviewed BOQ records and outputs; it does not determine final prices or replace the estimator.",
  audience: {
    heading: "Who Uses Estimating Workflows?",
    content: "Structured estimating workflows help teams responsible for project pricing and risk review keep supported records organized.",
    items: ["Main Contractors preparing tender bids","MEP Subcontractors pricing specialized scope","Fit-out Companies managing detailed material lists","Consultants verifying project budgets"]
  },
  workflowProblem: {
    heading: "The Risk of Disconnected Estimating",
    paragraphs: ["Estimating can span source files, measurement tools, spreadsheets and pricing records. Separate copies can make assumptions and revision context harder to review when project information changes.","A structured BOQ record can help organize supported scope and pricing inputs, but the estimator must still reconcile sources, assumptions and revisions."]
  },
  quantaraSupport: {
    heading: "Connecting Scope to Commercial Output",
    paragraphs: ["Quantara captures supported information from text-based PDFs and spreadsheets for review, then organizes BOQ sections, items, quantities, rates and assumptions in a project workspace.","Distinct BOQ revision records preserve versions for comparison. Users remain responsible for identifying and interpreting every scope or commercial change."]
  },
  relevantFeatures: [{"name":"Structured Workspaces","capabilityId":"project-workspaces","description":"Maintain clear boundaries between project scope and pricing."},{"name":"BOQ Revision Records","capabilityId":"boq-management","description":"Keep distinct revision records for review; users interpret quantity and scope changes."},{"name":"Template Management","capabilityId":"document-templates","description":"Apply supported company templates to project records."}],
  workflowExample: {
    heading: "Structured Estimating Workflow",
    introduction: "How an estimating team handles a complex tender:",
    steps: [{"title":"Supported Capture","description":"Extractable PDF text is stored, while supported detected table rows become review candidates."},{"title":"Source Verification","description":"The estimator checks captured items against the original project sources."},{"title":"Pricing Inputs","description":"The professional enters or reviews rates, assumptions and exclusions."},{"title":"Commercial Review","description":"The responsible team reviews the structured estimate and assumptions."},{"title":"Output Generation","description":"A supported PDF or XLSX output is generated from reviewed data and checked before issue."}]
  },
  supportedInputs: [{"name":"XLSX / CSV","capabilityId":"spreadsheet-import","description":"Import supported structured client BOQ or pricing data for review."},{"name":"Text-based PDF","capabilityId":"text-pdf-extraction","description":"Store extractable text and create review candidates from supported detected table rows."},{"name":"Scanned/Image-Only PDF — Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only tender pages and reports that text extraction is unavailable.","limitation":"Quantara does not provide OCR; manual transcription is required."},{"name":"Scanned/Image-Only PDF — OCR","capabilityId":"scanned-pdf-ocr","description":"Automated text recognition for scanned tender files is not currently implemented.","limitation":"Scanned tender files require manual transcription."},{"name":"BIM / IFC","capabilityId":"model-file-import","description":"Model-based quantity extraction is not currently available."}],
  supportedOutputs: [{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Structured data export for further professional processing."},{"name":"PDF Generation","capabilityId":"professional-outputs","description":"Reviewable BOQ documents generated from stored data and available templates."},{"name":"Technical Reports","capabilityId":"technical-report-generation","description":"DOCX reports generated from reviewed project records and templates in supported configured environments."}],
  limitations: ["Quantara does not automatically calculate or guarantee final project costs.","It relies entirely on the professional estimator to provide accurate rates and verify scope.","It is not a substitute for professional commercial management."],
  faqs: [{"question":"What is construction estimating software?","answer":"It helps professionals organize project scope, quantities, rates, assumptions and outputs. The estimator remains responsible for the accuracy and commercial judgement behind the estimate."},{"question":"How is a BOQ used in estimating?","answer":"A BOQ provides structured items and quantities that can support pricing. The estimator reviews the scope and applies rates, risks, overheads and exclusions."},{"question":"What is the difference between quantity takeoff and estimating?","answer":"Quantity takeoff measures amounts from drawings or models. Estimating applies rates, risks and commercial assumptions to reviewed quantities."},{"question":"Can Quantara calculate complete project prices?","answer":"Quantara can calculate supported totals from professional inputs, but it does not invent commercial rates or guarantee a final project price."},{"question":"How should rates and assumptions be reviewed?","answer":"A qualified estimator or commercial manager must check rates, quantities, assumptions, exclusions, formulas and totals before submission."},{"question":"Can estimates be revised?","answer":"Quantara retains distinct BOQ revision records. Users must compare the records and interpret any scope or commercial changes."},{"question":"Can outputs be generated for client review?","answer":"Supported PDF and XLSX outputs can be generated for review. A professional must check them before client submission."},{"question":"Does Quantara replace a commercial manager?","answer":"No. Quantara organizes supported data; strategic, commercial and risk-management decisions remain with the professional team."}],
  relatedPages: [{"href":"/boq-software-comparison-uae","label":"BOQ Software Comparison UAE","description":"Compare Quantara with six takeoff and estimating platforms using official sources."},{"href":"/boq-software","label":"BOQ Software","description":"The foundation of structured project data."},{"href":"/boq-management","label":"BOQ Management","description":"How to control revisions and project records."},{"href":"/quantity-surveying-software","label":"Quantity Surveying","description":"Workflows for professional quantity surveyors."},{"href":"/boq-document-generation","label":"Document Generation","description":"Creating professional proposals."},{"href":"/features","label":"Product Features","description":"Explore all Quantara capabilities."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/construction-estimating-software" />;
}
