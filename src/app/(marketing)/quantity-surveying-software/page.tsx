import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/quantity-surveying-software");



const content: SeoLandingPageContent = {
  breadcrumbLabel: "Quantity Surveying",
  h1: "Quantity Surveying Software for Structured BOQ Review and Project Control",
  directDefinition: "Quantity surveying software can organize BOQ items, retain distinct revision records and prepare supported outputs. The responsible quantity surveyor still reviews measurements, rates, assumptions and commercial decisions.",
  audience: {
    heading: "Built for Commercial Professionals",
    content: "Quantara supports review-led BOQ work by quantity surveyors and other construction commercial professionals.",
    items: ["Client Quantity Surveyors preparing tender packages","Contractor QS teams pricing and managing variations","Commercial Managers overseeing project risk","Cost Consultants structuring master templates"]
  },
  workflowProblem: {
    heading: "The Burden of Administrative Tasks",
    paragraphs: ["Quantity surveyors provide commercial strategy, risk analysis and cost control. Their workflows can also involve reformatting spreadsheets, comparing separate versions and preparing tender documents.","A structured record can reduce repeated organization work, while professional interpretation and commercial judgement remain with the QS."]
  },
  quantaraSupport: {
    heading: "Elevating the QS Role",
    paragraphs: ["Quantara captures supported information from text-based PDFs and spreadsheets for review, organizes BOQ records and retains distinct revisions. It does not automatically interpret the commercial differences between revisions.","Authorized project workspaces and available templates help teams keep supported records organized. The QS remains responsible for checking every quantity, rate, assumption and output."]
  },
  relevantFeatures: [{"name":"BOQ Revision Records","capabilityId":"boq-management","description":"Keep distinct revision records for professional comparison and interpretation."},{"name":"Template Control","capabilityId":"document-templates","description":"Apply supported company templates to BOQ records."},{"name":"Structured Workspaces","capabilityId":"project-workspaces","description":"Organize data by project and client."}],
  workflowExample: {
    heading: "Managing a Tender Variation",
    introduction: "How a Quantity Surveyor handles a mid-tender design update:",
    steps: [{"title":"Baseline Revision","description":"The QS retains the reviewed BOQ as a distinct revision record."},{"title":"Review Updated Sources","description":"Supported information from updated text-based schedules is captured for professional review."},{"title":"Commercial Analysis","description":"The QS compares the records and analyzes the cost impact of confirmed changes."},{"title":"Apply Rates","description":"The professional enters or revises rates against the reviewed items."},{"title":"Generate Report","description":"A DOCX technical report may be generated in a supported configured environment and checked before issue."}]
  },
  supportedInputs: [{"name":"Text-based PDF","capabilityId":"text-pdf-extraction","description":"Extracting supported detected table rows from consultant documents for review."},{"name":"XLSX / CSV","capabilityId":"spreadsheet-import","description":"Importing pricing data or measurement schedules."},{"name":"BIM / CAD","capabilityId":"model-file-import","description":"Model-based quantity extraction is not currently available."}],
  supportedOutputs: [{"name":"Reviewable PDF Documents","capabilityId":"professional-outputs","description":"Formatted BOQ documents that require checking before issue."},{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Structured data export for further professional processing."},{"name":"Technical Reports","capabilityId":"technical-report-generation","description":"DOCX reports generated from reviewed records and templates in supported configured environments.","limitation":"Durable production storage must be confirmed during Controlled Early Access."}],
  limitations: ["Quantara does not perform regulated professional judgment or certify costs.","It does not automatically generate pricing data.","It is a tool to support the QS, not a replacement for their expertise."],
  faqs: [{"question":"What software do quantity surveyors use?","answer":<React.Fragment>Quantity surveyors use a range of software, including <Link href="/quantity-takeoff-vs-boq-software" className="text-blue-600 hover:underline">measurement tools for takeoff</Link>, estimating platforms for pricing, spreadsheets for flexible analysis and BOQ systems for structured records.</React.Fragment>,"schemaAnswer":"Quantity surveyors use measurement tools for takeoff, estimating platforms for pricing, spreadsheets for flexible analysis and BOQ systems for structured records."},{"question":"Can Quantara replace a quantity surveyor?","answer":"No. Quantara organizes supported information and records; professional judgement, risk analysis and commercial strategy remain with the quantity surveyor."},{"question":"Can Quantara support tender BOQs?","answer":"Quantara can organize tender BOQ records and generate supported reviewable outputs. A qualified professional must check and approve them before issue."},{"question":"Does Quantara perform measurement?","answer":"Quantara does not measure geometry from CAD, BIM or PDF drawings. Supported deterministic calculations can use dimensions entered or confirmed by a professional."},{"question":"How are revisions handled?","answer":"Quantara retains distinct BOQ revision records. Users must compare those records and interpret the commercial changes themselves."},{"question":"Can templates be governed?","answer":"Available company templates can be applied to supported BOQ records; configuration and generated results still require review."},{"question":"Can project records be organized?","answer":"Authorized users can organize supported files and BOQ records within company and project workspaces, subject to current access."},{"question":"What must a quantity surveyor verify?","answer":"A QS must independently verify captured quantities, dimensions, unit rates, assumptions, calculations and final commercial totals before issue."}],
  relatedPages: [{"href":"/boq-software","label":"BOQ Software","description":"The foundation of structured project data."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Applying managed data to commercial estimates."},{"href":"/boq-management","label":"BOQ Management","description":"How to control revisions and project records."},{"href":"/boq-document-generation","label":"Document Generation","description":"Creating professional outputs."},{"href":"/about","label":"About Quantara","description":"Learn about the team behind the platform."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/quantity-surveying-software" />;
}
