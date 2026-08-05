import { Metadata } from 'next';
import { ComparisonPage } from '@/components/layout/comparison-page';

export const metadata: Metadata = {
  title: 'OCR vs Structured BOQ Extraction for Construction Documents',
  description: 'Understand the difference between basic OCR text recognition and structured BOQ extraction, review and project organization.',
  alternates: {
    canonical: 'https://quantara.vistabylara.com/ocr-vs-structured-boq-extraction'
  },
  openGraph: {
    title: 'OCR vs Structured BOQ Extraction for Construction Documents',
    description: 'Understand the difference between basic OCR text recognition and structured BOQ extraction, review and project organization.',
    url: 'https://quantara.vistabylara.com/ocr-vs-structured-boq-extraction',
    type: 'article'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OCR vs Structured BOQ Extraction for Construction Documents',
    description: 'Understand the difference between basic OCR text recognition and structured BOQ extraction, review and project organization.'
  }
};

export default function Page() {
  return (
    <ComparisonPage 
      slug="ocr-vs-structured-boq-extraction"
      title="OCR vs Structured BOQ Extraction for Construction Documents"
      h1="OCR vs Structured BOQ Extraction: Text Recognition Is Only One Step"
      directAnswer="OCR attempts to recognize text and numbers. Structured BOQ extraction adds organization, field mapping, project context and human review around that recognized content."
      approachAName="Basic OCR"
      approachBName="Structured BOQ Extraction"
      whenToChooseA={["You only need to copy a few paragraphs of text","The document is a simple narrative without tables","You are building a custom data pipeline from scratch","You just need the document to be searchable"]}
      whenToChooseB={["You are dealing with hierarchical bills of quantities","You need to separate item descriptions from quantities and units","The layout includes complex merged cells and section headings","You need the output in a specific construction format"]}
      whenToUseBoth={["Structured extraction relies on underlying OCR technology to read the characters before organizing them."]}
      approachADefinition={"Optical Character Recognition (OCR) is the foundational technology that converts images of typed, handwritten, or printed text into machine-encoded text."}
      approachBDefinition={"Structured BOQ extraction uses OCR as a first step, then applies spatial and contextual logic to reconstruct tables, identify headers, map fields, and organize the data into a usable hierarchy."}
      comparisonCriteria={[{"label":"Output Format","approachAValue":"Flat text or raw tables","approachBValue":"Hierarchical BOQ structure"},{"label":"Field Mapping","approachAValue":"None (just text)","approachBValue":"Identifies Item, Description, Qty, Unit, Rate"},{"label":"Context Awareness","approachAValue":"Low","approachBValue":"High (tuned for construction)"},{"label":"Handling Merged Cells","approachAValue":"Often breaks structure","approachBValue":"Logic applied to resolve structure"},{"label":"Review Interface","approachAValue":"Generic text editor","approachBValue":"Purpose-built correction UI"},{"label":"Integration","approachAValue":"Requires manual formatting later","approachBValue":"Ready for estimating workflows"}]}
      approachAStrengths={["Widely available and inexpensive","Good for making PDFs searchable","Fast processing of simple text","Technology is very mature"]}
      approachALimitations={["Outputs require heavy manual formatting to be useful","Cannot understand what the text means contextually","Frequently fails on complex table structures"]}
      approachBStrengths={["Outputs data ready for construction estimating","Understands the relationship between sections and items","Includes specialized interfaces for fixing extraction errors","Saves hours of formatting time"]}
      approachBLimitations={["More specialized and typically more expensive than generic OCR","Still requires human review","May struggle with highly unconventional, non-standard layouts"]}
      workflowExample={"Using basic OCR on a BOQ PDF might give you a giant block of text or a messy spreadsheet where descriptions are mixed with numbers. Using structured extraction, the software recognizes the table boundaries, understands that \"m2\" is a unit, and outputs a clean, organized hierarchy."}
      quantaraRole={"Quantara goes beyond basic OCR by providing structured BOQ extraction, ensuring the data is organized, mapped to the right fields, and presented in a review interface."}
      faqs={[{"question":"Is OCR the same as BOQ extraction?","answer":"No. OCR is just the text recognition part. Extraction involves understanding the layout and structure of that text."},{"question":"Why does basic OCR fail on BOQs?","answer":"BOQs have complex layouts with merged cells, multi-line descriptions, and hierarchical headings that confuse basic text-reading algorithms."},{"question":"Does structured extraction guarantee perfect results?","answer":"No. It significantly improves structure, but human review is always required to catch edge cases and errors."},{"question":"Can I use generic OCR tools for my estimates?","answer":"You can, but you will spend a lot of time manually formatting the output to make it usable."},{"question":"What makes Quantara different from Adobe Acrobat OCR?","answer":"Acrobat provides flat text. Quantara attempts to reconstruct the specific table relationships needed for a Bill of Quantities."},{"question":"Do I still need to review the document?","answer":"Yes, professional review is a mandatory step in any extraction workflow."},{"question":"Does it work on scanned PDFs?","answer":"Yes, provided the scan quality is sufficient for the underlying OCR engine to read the text."}]}
      relatedLinks={[{"url":"/ocr-for-boq-documents","label":"OCR for BOQ Documents"},{"url":"/pdf-boq-extraction","label":"PDF BOQ Extraction"},{"url":"/scanned-pdf-boq","label":"Scanned PDF Workflows"},{"url":"/how-to-convert-pdf-boq-to-excel","label":"Convert PDF to Excel"},{"url":"/how-to-review-ai-extracted-boq","label":"Reviewing AI BOQs"}]}
      breadcrumbCurrent="OCR vs Structured BOQ Extraction: Text Recognition Is Only One Step"
    />
  );
}
