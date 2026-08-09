import { createPublicPageMetadata, PUBLIC_CONTENT_REVIEW_DATE } from "@/lib/public-site/search-registry";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata = createPublicPageMetadata("/how-to-convert-pdf-boq-to-excel");



export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "How to Convert a PDF BOQ to Excel with Structured Review",
    title: "How to Convert a PDF BOQ to Excel with Structured Review",
    summary: "Contractors frequently receive Bills of Quantities in PDF format, which can be inconvenient to edit or price in spreadsheet workflows. Conversion requires careful attention to table structure, text recognition, values and human verification.",
    reviewedDate: PUBLIC_CONTENT_REVIEW_DATE,
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why Safe Conversion Matters",
    "paragraphs": [
      "Estimating teams should not rely on a PDF-to-Excel conversion without review. Complex layouts can misalign merged cells, decimal values, descriptions or quantities.",
      "A structured conversion and review process helps the team reconcile the resulting pricing document against the source before it is used."
    ]
  },
  {
    "id": "the-workflow",
    "heading": "Safe Conversion Workflow",
    "numberedItems": [
      "Identify the document type: Determine if you have a native text PDF (generated directly from software) or an image-based scanned PDF.",
      "Confirm correct version: Ensure you are converting the latest issued revision.",
      "Extract tables: Use dedicated extraction software to lift the tabular data into a spreadsheet format.",
      "Map columns: Ensure Item Number, Description, Quantity, and Unit columns align correctly.",
      "Review merged cells: Fix headers and descriptions that spanned multiple rows and were broken during extraction.",
      "Identify page breaks: Remove repeating page headers and footers that interrupted the data flow.",
      "Inspect quantities and units: Check for missing decimal points or misaligned columns.",
      "Correct OCR issues: If the document was a scan, manually verify numbers and symbols.",
      "Validate formulas: Rebuild and test SUM formulas to ensure section totals match the PDF summary page.",
      "Save a controlled copy: Lock the structure so estimators can only edit the rate columns.",
      "Professionally review the result: Have a qualified person sign off on the converted file before pricing begins."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical contractor receives a text-based PDF BOQ for a school construction project.",
      "Using a generic online converter, the text \"100.00\" in the quantity column is misread as \"10000\" because the decimal point was faded. Without the structured review workflow (Step 7 and 11), the contractor would overprice that item by 100x."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of Conversion",
    "paragraphs": [
      "Do not claim or expect perfect, instant conversion. Complex documents with nested tables, handwritten notes or poor scan quality can require substantial manual reconstruction and review.",
      "Software can assist with supported capture, but a professional must reconcile the result with the source."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Supports Reviewable Extraction",
    "paragraphs": [
      "Quantara captures supported text and table candidates from text-based PDF BOQs and presents them for field-level review. Hierarchy, merged cells, units and values still require checking.",
      "Confirmed information can be organized in BOQ sections and exported as XLSX. Cleanup and review effort vary, and no fixed saving is promised."
    ]
  }
],
    faqs: [
  {
    "question": "Why do clients send BOQs as PDFs?",
    "answer": "Clients may issue PDFs to preserve a fixed presentation of item descriptions and quantities. Contractors must still confirm the revision, tender instructions and any permitted qualifications."
  },
  {
    "question": "Can all PDFs be converted?",
    "answer": "Text-based PDFs expose an existing digital text layer, but tables and values still require review. Scanned PDFs require external OCR or manual transcription; Quantara does not currently provide OCR extraction."
  },
  {
    "question": "What is a merged cell error?",
    "answer": "When a long item description spans multiple rows in a PDF, basic converters often chop the text into separate Excel rows, breaking the BOQ structure."
  },
  {
    "question": "How long does manual conversion take?",
    "answer": "Manual conversion effort depends on page count, layout, handwriting, table complexity and the required checks. Supported capture may reduce some transcription steps, but no fixed saving is guaranteed."
  },
  {
    "question": "Do I need to rebuild formulas in Excel?",
    "answer": "Yes. PDFs do not contain embedded spreadsheet formulas. Once the data is in Excel, you must manually recreate the =A1*B1 rate and quantity math."
  }
],
    relatedReading: [
  {
    "href": "/pdf-boq-extraction",
    "label": "PDF BOQ Extraction Software"
  },
  {
    "href": "/text-pdf-vs-scanned-pdf",
    "label": "Text PDF vs Scanned PDF"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "Reviewing AI-Extracted BOQs"
  }
],
    path: "/how-to-convert-pdf-boq-to-excel"
  };

  return <KnowledgePage content={content} />;
}
