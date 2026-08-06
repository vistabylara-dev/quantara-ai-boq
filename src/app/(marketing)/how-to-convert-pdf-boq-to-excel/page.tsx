import { Metadata } from "next";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "How to Convert a PDF BOQ to Excel Safely",
  description: "Learn how to convert a BOQ from PDF to Excel while reviewing tables, quantities, units, merged cells, OCR issues and document structure.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/how-to-convert-pdf-boq-to-excel",
  },
  openGraph: {
    title: "How to Convert a PDF BOQ to Excel Safely | Quantara",
    description: "Learn how to convert a BOQ from PDF to Excel while reviewing tables, quantities, units, merged cells, OCR issues and document structure.",
    url: "https://quantara.vistabylara.com/how-to-convert-pdf-boq-to-excel",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "How to Convert a PDF BOQ to Excel with Structured Review",
    title: "How to Convert a PDF BOQ to Excel with Structured Review",
    summary: "Contractors frequently receive Bills of Quantities in PDF format, making them impossible to price directly. Converting a PDF BOQ to an editable Excel or digital format is a necessary workflow, but doing it safely requires careful attention to table structures, text recognition, and human verification.",
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why Safe Conversion Matters",
    "paragraphs": [
      "For estimating teams, blindly trusting a PDF-to-Excel conversion tool is a massive commercial risk. Automated converters often scramble merged cells, drop decimal points, or mix item descriptions with quantities.",
      "A structured conversion and review process ensures the resulting pricing document is 100% faithful to the client's original intent."
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
      "A hypothetical contractor receives a 50-page PDF BOQ for a school construction project.",
      "Using a generic online converter, the text \"100.00\" in the quantity column is misread as \"10000\" because the decimal point was faded. Without the structured review workflow (Step 7 and 11), the contractor would overprice that item by 100x."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of Conversion",
    "paragraphs": [
      "Do not claim or expect perfect, instant conversion. Complex documents with nested tables, handwritten notes, or poor scan quality will always require manual intervention.",
      "The goal of software is to do the heavy lifting, but human oversight is mandatory."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Enhances Extraction",
    "paragraphs": [
      "Quantara is specifically designed to handle BOQ document extraction. Rather than just dumping unstructured text into Excel, it uses AI-assisted processing to understand the structure of construction items, drastically reducing the manual cleanup required.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs."
    ]
  }
],
    faqs: [
  {
    "question": "Why do clients send BOQs as PDFs?",
    "answer": "Clients issue PDFs to prevent contractors from easily altering the item descriptions, quantities, or formulas, ensuring all bids are submitted on an identical baseline."
  },
  {
    "question": "Can all PDFs be converted?",
    "answer": "Native text PDFs can usually be extracted cleanly. Scanned image PDFs require OCR and are much harder to convert accurately."
  },
  {
    "question": "What is a merged cell error?",
    "answer": "When a long item description spans multiple rows in a PDF, basic converters often chop the text into separate Excel rows, breaking the BOQ structure."
  },
  {
    "question": "How long does manual conversion take?",
    "answer": "Retyping a complex 100-page BOQ can take an estimator several days. Extraction software reduces this, but review time must still be scheduled."
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
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "How to Convert a PDF BOQ to Excel with Structured Review",
      "description": "Learn how to convert a BOQ from PDF to Excel while reviewing tables, quantities, units, merged cells, OCR issues and document structure.",
      "url": "https://quantara.vistabylara.com/how-to-convert-pdf-boq-to-excel",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
