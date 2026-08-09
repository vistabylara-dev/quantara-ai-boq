import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { ComparisonPage } from '@/components/layout/comparison-page';
import { QUANTARA_ENTITY_DEFINITION } from "@/lib/public-site/product-truth";

export const metadata = createPublicPageMetadata("/quantara-vs-excel-for-boq");



export default function Page() {
  return (
    <ComparisonPage
      slug="quantara-vs-excel-for-boq"
      title="Quantara vs Excel for BOQ Workflows | Structured Comparison"
      h1="Quantara vs Excel for BOQ Workflows"
      directAnswer="Quantara and Excel may be used together. Quantara focuses on structured BOQ and project workflows, while Excel may remain useful for calculations, pricing analysis and data exchange."
      approachAName="Quantara"
      approachBName="Microsoft Excel"
      whenToChooseA={["Project records are distributed across teams","Revisions require stronger visibility and control","Supported documents must be extracted and reviewed","Multiple BOQ outputs must remain organized together"]}
      whenToChooseB={["The BOQ is small and straightforward","The workflow is familiar to a single user","Advanced project history is unnecessary","The team does not require structured access controls"]}
      whenToUseBoth={["Extracting and structuring BOQs in Quantara, then exporting to Excel for specific rate analysis","Using Quantara for revision control, and Excel for final pricing submissions"]}
      approachADefinition={QUANTARA_ENTITY_DEFINITION}
      approachBDefinition={"Microsoft Excel is a flexible spreadsheet application widely used for calculations, data analysis, tabular formatting, and general-purpose business workflows."}
      comparisonCriteria={[{"label":"Project Context","approachAValue":"Structured by project","approachBValue":"Organization depends on the workbook and file controls"},{"label":"Document Extraction","approachAValue":"Supported review workflow","approachBValue":"Capabilities depend on the Excel version, platform and connectors"},{"label":"Revision Visibility","approachAValue":"Distinct records for user comparison","approachBValue":"Depends on platform and file-management controls"},{"label":"Templates","approachAValue":"Available where configured","approachBValue":"Workbook templates and file copying"},{"label":"Professional Review","approachAValue":"Required","approachBValue":"Required"},{"label":"Calculations","approachAValue":"Supported visible calculations","approachBValue":"Custom formulas where configured by the user"}]}
      approachAStrengths={["Structured BOQ hierarchy","Supported document-capture workflow","Distinct revision records for user comparison","Available templates where configured"]}
      approachALimitations={["Learning curve for new software","Not a full replacement for advanced financial modeling","Requires professional review of outputs"]}
      approachBStrengths={["Broad familiarity","Flexible formulas","Offline capability in supported desktop versions","Customizable formatting"]}
      approachBLimitations={["Formula and review controls depend on workbook design","Structural-change visibility depends on platform and file controls","Import and extraction capabilities depend on version, platform and connectors","Template consistency depends on team governance"]}
      workflowExample={"A quantity surveyor receives a text-based PDF BOQ. They use Quantara to capture supported content and structure a review candidate. After checking and correcting it against the source, they export the structured data to Excel for company-specific pricing analysis."}
      quantaraRole={"Quantara supports capture from eligible sources, BOQ structuring and distinct revision records. Excel may remain part of the workflow for bespoke analysis and data exchange."}
      faqs={[{"question":"Can Quantara replace Excel?","answer":"Not entirely. Quantara can centralize structured BOQ records and supports spreadsheet import and export, while Excel remains useful for bespoke pricing analysis and financial modeling."},{"question":"Is Excel enough for BOQ preparation?","answer":"It can be, especially for small projects or a single-user workflow. Structured software may help when project records and revisions become difficult to control."},{"question":"Can I export from Quantara to Excel?","answer":"Yes. Quantara supports XLSX export for further professional processing."},{"question":"Does Quantara calculate rates automatically?","answer":"No. Quantara does not invent commercial rates; rate application and pricing strategy remain the responsibility of the professional estimator."},{"question":"How are revisions handled differently?","answer":"Excel revisions are usually separate files. Quantara retains distinct BOQ revision records, but users must still review and interpret what changed."},{"question":"Is training required?","answer":"Users need onboarding for Quantara's structured workflow and must understand its supported inputs, review requirements and current limitations."},{"question":"Can document management and BOQ software be used together?","answer":"Yes. Files can remain in document-management systems while authorized structured BOQ records are managed in Quantara."}]}
      relatedLinks={[{"url":"/boq-software-vs-spreadsheets","label":"BOQ Software vs Spreadsheets"},{"url":"/construction-estimating-software-vs-excel","label":"Estimating Software vs Excel"},{"url":"/boq-software","label":"BOQ Software"},{"url":"/boq-management","label":"BOQ Management"},{"url":"/boq-review-checklist","label":"BOQ Review Checklist"}]}
      breadcrumbCurrent="Quantara vs Excel for BOQ Workflows"
    />
  );
}
