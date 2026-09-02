import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { ComparisonPage } from '@/components/layout/comparison-page';

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/ai-boq-vs-manual-boq-preparation", locale);
}



export default function Page() {
  return (
    <ComparisonPage 
      slug="ai-boq-vs-manual-boq-preparation"
      title="AI BOQ vs Manual BOQ Preparation | Workflow Comparison"
      h1="AI-Assisted BOQ Workflows vs Manual BOQ Preparation"
      directAnswer="AI assistance can reduce supported transcription steps, but coverage, correction effort and review time vary by source. Professional review and project-specific judgement remain required."
      approachAName="AI-Assisted Workflow"
      approachBName="Manual Preparation"
      whenToChooseA={["The source is a supported text-based PDF or spreadsheet","The document contains supported text or table structures","The team wants a reviewable capture workflow","Every proposed field will be checked against the source"]}
      whenToChooseB={["The source documents are highly complex, handwritten, or degraded","The project scope requires interpreting intent rather than just reading text","The BOQ is very small and quick to type","Strict security protocols prevent the use of cloud AI tools"]}
      whenToUseBoth={["Using AI assistance to capture supported candidates, followed by manual review, correction and completion"]}
      approachADefinition={"AI-assisted BOQ workflows can store extractable PDF text and create review candidates from supported detected table rows or structured spreadsheets. Plain PDF paragraphs do not become BOQ candidates; scanned PDFs are detected, but OCR text extraction is not available."}
      approachBDefinition={"Manual preparation involves a human operator reading a document and retyping or copy-pasting the information piece-by-piece into a spreadsheet or software tool."}
      comparisonCriteria={[{"label":"Initial Draft Effort","approachAValue":"Varies by file structure and review needed","approachBValue":"Requires direct transcription and organization"},{"label":"Repetitive Labor","approachAValue":"Can reduce supported transcription steps","approachBValue":"Relies on manual entry"},{"label":"Accuracy","approachAValue":"Depends on document quality; requires review","approachBValue":"Subject to human typing errors"},{"label":"Context Understanding","approachAValue":"Limited to captured source content","approachBValue":"Uses human judgment during entry"},{"label":"Professional Review","approachAValue":"Mandatory","approachBValue":"Mandatory"},{"label":"File Volume","approachAValue":"Processes supported files within product limits","approachBValue":"Effort generally rises with file volume"}]}
      approachAStrengths={["Can reduce repeated transcription for supported content","Provides a consistent structure for review","Helps standardize supported outputs","Keeps professional review in the workflow"]}
      approachALimitations={["Quantara does not extract text from scanned or image-only PDFs today","Requires human validation of captured results","Cannot interpret missing or implied information"]}
      approachBStrengths={["Complete control over every keystroke","Immediate application of professional judgment during entry","Can interpret complex, non-standard document layouts","No reliance on external processing algorithms"]}
      approachBLimitations={["Requires sustained manual effort","Repetitive work can introduce typing errors","Capacity depends on available reviewers","Uses professional time for transcription"]}
      workflowExample={"When a text-based tender BOQ contains supported tables, an estimator can use Quantara to prepare a structured draft and then review every description, unit and quantity against the source. A manual workflow remains appropriate when the file is scanned, irregular or requires interpretation beyond the written content."}
      quantaraRole={"Quantara stores extractable text from supported PDFs, creates candidates from supported detected table rows, and imports supported structured spreadsheets within a workflow that requires manual review, correction and professional approval."}
      faqs={[{"question":"Does AI remove the need for professional review?","answer":"No. AI can assist with supported capture and organization, but a qualified professional must always review and validate the output."},{"question":"Is the AI 100% accurate?","answer":"No. Results depend on the source document and supported structure, so human review remains mandatory."},{"question":"Can manual workflows be more appropriate?","answer":"Yes, especially for scanned, handwritten, degraded or irregular documents, or work that requires interpreting intent."},{"question":"Does AI understand construction terminology?","answer":"Quantara captures supported source content and helps structure it; it does not infer engineering intent or replace construction judgment."},{"question":"What happens if the AI makes a mistake?","answer":"The user corrects it during the review phase before exporting or finalizing the BOQ."},{"question":"Is manual typing completely eliminated?","answer":"No. Corrections, additions, scanned content and pricing information can still require manual entry."},{"question":"How much time does AI actually save?","answer":"No fixed saving is guaranteed. The result depends on document structure, data quality, corrections and the required level of professional review."}]}
      relatedLinks={[{"url":"/ai-boq-software","label":"AI BOQ Software"},{"url":"/how-to-prepare-a-boq","label":"How to Prepare a BOQ"},{"url":"/how-to-review-ai-extracted-boq","label":"Reviewing AI BOQs"},{"url":"/common-boq-errors","label":"Common Errors"},{"url":"/features","label":"Quantara Features"}]}
      breadcrumbCurrent="AI-Assisted BOQ Workflows vs Manual BOQ Preparation"
    />
  );
}
