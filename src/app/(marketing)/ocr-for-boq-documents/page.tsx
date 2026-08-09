import { createPublicPageMetadata, PUBLIC_CONTENT_REVIEW_DATE } from "@/lib/public-site/search-registry";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata = createPublicPageMetadata("/ocr-for-boq-documents");



export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "OCR for BOQ Documents",
    title: "OCR for BOQ Documents: What It Can and Cannot Do",
    summary: "Optical Character Recognition (OCR) converts images of text into machine-readable text. BOQ tables, technical symbols and numbers can still be misread, so OCR results require human review; Quantara does not currently provide OCR text extraction.",
    reviewedDate: PUBLIC_CONTENT_REVIEW_DATE,
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why OCR Understanding Matters",
    "paragraphs": [
      "For commercial teams processing legacy documents or consultant scans, OCR can be useful. Unreviewed OCR output can still introduce estimating errors.",
      "Understanding common OCR failure patterns helps estimators focus quality-control checks, although errors vary by document and tool."
    ]
  },
  {
    "id": "capabilities",
    "heading": "What OCR Does Well",
    "bullets": [
      "High-Resolution Text: Cleaner, higher-resolution scans generally reduce recognition ambiguity, but results still require checking.",
      "Standard Layouts: Simple, grid-based tables without complex merged cells are generally reconstructed well.",
      "Bulk Processing: OCR can process multiple scanned pages, but processing time, recognition quality and review effort vary."
    ]
  },
  {
    "id": "limitations",
    "heading": "Where OCR Struggles (The Limitations)",
    "paragraphs": [
      "OCR interprets shapes, not engineering intent. Common failure points include:"
    ],
    "bullets": [
      "Similar Characters: Confusing a capital \"I\" with a lowercase \"l\" or the number \"1\".",
      "Decimal Points: Faded or small decimal points in quantities may be completely ignored (turning 10.5 into 105).",
      "Technical Symbols: Specialized engineering symbols (e.g., diameter Ø) may be translated as strange text characters.",
      "Skew and Noise: Crooked, blurred or low-contrast pages can introduce recognition and table-reconstruction errors.",
      "Handwriting: Handwritten annotations or corrections are notoriously difficult for standard OCR to parse accurately."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical contractor scans a BOQ page that includes the item \"m3\" (cubic meters). Because the page is slightly blurry, the OCR engine reads the \"3\" as an \"8\", outputting \"m8\".",
      "A human reviewer must spot this unit error during the validation phase to ensure the estimating software can process the data correctly."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "Quantara's Current OCR Status",
    "paragraphs": [
      "OCR text extraction is not currently available in Quantara. Today, Quantara detects scanned and image-only PDF pages and flags them as requiring OCR — it does not invent or guess text for them. Scanned BOQ content currently requires manual transcription.",
      "Quantara currently focuses on supported document extraction (text-based PDFs, XLSX, CSV), BOQ structuring, project organization, templates, revisions, and professional outputs. It does not perform professional measurement or scope interpretation."
    ]
  }
],
    faqs: [
  {
    "question": "What does OCR mean?",
    "answer": "Optical Character Recognition. It translates images of text into actual digital text data."
  },
  {
    "question": "Is OCR 100% accurate?",
    "answer": "No. Even the best OCR systems can make mistakes on poor-quality scans, blurry text, or non-standard fonts."
  },
  {
    "question": "How can I improve OCR accuracy?",
    "answer": "Use a straight, legible scan at the highest practical resolution and avoid handwritten marks over the text. Review the recognized content against the original."
  },
  {
    "question": "Can OCR read tables?",
    "answer": "Modern OCR engines can detect grid lines and whitespace to reconstruct tables, though complex merged cells often require human adjustment."
  },
  {
    "question": "Does OCR understand construction terminology?",
    "answer": "Basic OCR only reads letters; construction-specific context typically needs to be applied afterward to improve structuring. Quantara does not yet run OCR — this kind of context-aware structuring is part of a capability Quantara does not currently provide, not a current feature."
  }
],
    relatedReading: [
  {
    "href": "/scanned-pdf-boq",
    "label": "Scanned PDF BOQ Processing"
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
    path: "/ocr-for-boq-documents"
  };

  return <KnowledgePage content={content} />;
}
