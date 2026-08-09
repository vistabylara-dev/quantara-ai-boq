import { createPublicPageMetadata, PUBLIC_CONTENT_REVIEW_DATE } from "@/lib/public-site/search-registry";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata = createPublicPageMetadata("/text-pdf-vs-scanned-pdf");



export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "Text PDF vs Scanned PDF",
    title: "Text PDF vs Scanned PDF: Why the Difference Matters for BOQs",
    summary: "When extracting a Bill of Quantities into a workable format, the type of PDF you receive determines the difficulty of the task. A native text PDF contains embedded digital characters, while a scanned PDF is merely a flat image of a page. Understanding this difference is crucial for estimating teams managing their workflow and accuracy expectations.",
    reviewedDate: PUBLIC_CONTENT_REVIEW_DATE,
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why Document Quality Matters",
    "paragraphs": [
      "A text PDF exposes embedded characters for supported capture, but its tables and values still require review. A scanned PDF contains page images and needs OCR or manual transcription before its text can be processed.",
      "Identifying the document type immediately dictates the necessary quality control workflow."
    ]
  },
  {
    "id": "core-differences",
    "heading": "Text PDFs vs Scanned PDFs",
    "bullets": [
      "Native Text PDF: Generated directly from software (like Word or Excel) via \"Save as PDF\". You can usually select individual letters and numbers, allowing software to access the embedded text while still requiring structural and value checks.",
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
          "Varies by layout; review required",
          "Variable (depends on scan quality)"
        ],
        [
          "Processing Method",
          "Direct character extraction",
          "Requires OCR technology"
        ],
        [
          "File Size",
          "Varies with embedded content",
          "Varies with resolution and compression"
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
      "If the page is skewed or the resolution is low, OCR software might misread an \"8\" as a \"3\". A digitally exported PDF would retain an embedded text layer, although its table structure and values would still require review."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of Scanned Documents",
    "paragraphs": [
      "Scans often suffer from skew, compression artifacts and handwriting over text. These elements can reduce recognition confidence.",
      "No software can guarantee perfect extraction from a poor-quality scan. Human validation is always required."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Processes PDFs",
    "paragraphs": [
      "Quantara accepts text-based and scanned PDFs. It stores extractable text from text-based PDFs and creates review candidates only from supported detected table rows; plain paragraph text does not become BOQ candidates. Scanned or image-only documents are detected and flagged as requiring OCR, but OCR text extraction is not currently available, so scanned content requires manual transcription.",
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
    "answer": "A scan stores page imagery, while a text PDF can store characters and vector instructions. Actual file size varies with images, fonts, resolution, compression and other embedded content."
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
    path: "/text-pdf-vs-scanned-pdf"
  };

  return <KnowledgePage content={content} />;
}
