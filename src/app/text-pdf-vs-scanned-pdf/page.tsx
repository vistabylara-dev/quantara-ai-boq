import { Metadata } from "next";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "Text PDF vs Scanned PDF for BOQ Extraction | Quantara",
  description: "Understand how text-based and scanned PDFs differ, how OCR affects extraction, and why document quality matters when processing BOQ files.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/text-pdf-vs-scanned-pdf",
  },
  openGraph: {
    title: "Text PDF vs Scanned PDF for BOQ Extraction | Quantara",
    description: "Understand how text-based and scanned PDFs differ, how OCR affects extraction, and why document quality matters when processing BOQ files.",
    url: "https://quantara.vistabylara.com/text-pdf-vs-scanned-pdf",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "Text PDF vs Scanned PDF",
    title: "Text PDF vs Scanned PDF: Why the Difference Matters for BOQs",
    summary: "When extracting a Bill of Quantities into a workable format, the type of PDF you receive determines the difficulty of the task. A native text PDF contains embedded digital characters, while a scanned PDF is merely a flat image of a page. Understanding this difference is crucial for estimating teams managing their workflow and accuracy expectations.",
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why Document Quality Matters",
    "paragraphs": [
      "For contractors and estimators, receiving a high-quality text PDF means fast, accurate extraction. Receiving a low-resolution scanned PDF means a higher risk of data loss, OCR errors, and increased hours required for manual review.",
      "Identifying the document type immediately dictates the necessary quality control workflow."
    ]
  },
  {
    "id": "core-differences",
    "heading": "Text PDFs vs Scanned PDFs",
    "bullets": [
      "Native Text PDF: Generated directly from software (like Word or Excel) via \"Save as PDF\". You can click and highlight individual letters and numbers. Data extraction software can read the text with near 100% accuracy.",
      "Scanned Image PDF: Created when a physical piece of paper is run through a scanner. It is essentially a photograph. You cannot highlight the text. Software must use Optical Character Recognition (OCR) to \"guess\" what the shapes mean."
    ]
  },
  {
    "id": "comparison-table",
    "heading": "Comparison Overview",
    "table": {
      "headers": [
        "Feature",
        "Native Text PDF",
        "Scanned Image PDF"
      ],
      "rows": [
        [
          "Selectable Text",
          "Yes",
          "No"
        ],
        [
          "Extraction Accuracy",
          "Extremely High",
          "Variable (depends on scan quality)"
        ],
        [
          "Processing Method",
          "Direct character extraction",
          "Requires OCR technology"
        ],
        [
          "File Size",
          "Typically small",
          "Often very large"
        ],
        [
          "Review Requirement",
          "Standard structural review",
          "Rigorous line-by-line verification"
        ]
      ]
    }
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical consultant prints a BOQ, signs it with a pen, and scans it back into the computer. This is now a scanned PDF.",
      "If the page is skewed or the resolution is low, the OCR software might misread an \"8\" as a \"3\". If the document had simply been exported directly to PDF with a digital signature, the text would remain perfectly intact."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of Scanned Documents",
    "paragraphs": [
      "Scans often suffer from skew (crooked pages), compression artifacts (blurriness), and handwriting over text. These elements drastically reduce extraction confidence.",
      "No software can guarantee perfect extraction from a poor-quality scan. Human validation is always required."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Processes PDFs",
    "paragraphs": [
      "Quantara supports both document types. It leverages AI-assisted extraction to parse the clean data from text PDFs, and utilizes advanced OCR capabilities to process scanned documents, bringing them both into a structured, manageable format.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs."
    ]
  }
],
    faqs: [
  {
    "question": "How do I know if my PDF is text or scanned?",
    "answer": "Try to highlight a single word with your mouse cursor. If you can select individual letters, it is a text PDF. If clicking highlights the entire page as a block, it is a scanned image."
  },
  {
    "question": "Can a PDF be a mix of both?",
    "answer": "Yes. Some documents contain digitally generated text pages alongside appended scanned appendices or stamped signature pages."
  },
  {
    "question": "What is OCR?",
    "answer": "OCR stands for Optical Character Recognition. It is technology that analyzes the shapes in an image and translates them into machine-readable text."
  },
  {
    "question": "Why do scans result in larger file sizes?",
    "answer": "A scan saves a high-resolution pixel image of every page, whereas a text PDF only saves the text characters and vector rendering instructions."
  },
  {
    "question": "Can I request a text PDF from the client?",
    "answer": "Yes. It is standard practice during tender periods for contractors to request the native files or text-based PDFs to reduce administrative burden and pricing errors."
  }
],
    relatedReading: [
  {
    "href": "/scanned-pdf-boq",
    "label": "Scanned PDF BOQ Processing"
  },
  {
    "href": "/ocr-for-boq-documents",
    "label": "OCR for BOQ Documents"
  },
  {
    "href": "/how-to-convert-pdf-boq-to-excel",
    "label": "Converting PDF BOQs to Excel"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "Text PDF vs Scanned PDF: Why the Difference Matters for BOQs",
      "description": "Understand how text-based and scanned PDFs differ, how OCR affects extraction, and why document quality matters when processing BOQ files.",
      "url": "https://quantara.vistabylara.com/text-pdf-vs-scanned-pdf",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
