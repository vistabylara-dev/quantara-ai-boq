import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { ComparisonPage } from '@/components/layout/comparison-page';

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/ocr-vs-structured-boq-extraction", locale);
}



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
      whenToUseBoth={["Image-only document workflows may use external OCR before structuring and review. Supported text-based PDFs can use their existing digital text layer without OCR."]}
      approachADefinition={"Optical Character Recognition (OCR) is the foundational technology that converts images of typed, handwritten, or printed text into machine-encoded text."}
      approachBDefinition={"Structured BOQ extraction uses available digital text or OCR output to propose supported rows and fields for review. Layout, hierarchy, units and every captured value still require checking."}
      comparisonCriteria={[{"label":"Input Layer","approachAValue":"Page image","approachBValue":"Digital text or OCR output"},{"label":"Output Format","approachAValue":"Recognized text","approachBValue":"Proposed BOQ rows and fields"},{"label":"Field Mapping","approachAValue":"Not established by OCR alone","approachBValue":"Product and source dependent"},{"label":"Merged Cells","approachAValue":"Relationship may be lost","approachBValue":"Requires reconstruction and review"},{"label":"Review Interface","approachAValue":"Tool dependent","approachBValue":"Can present field-level correction"},{"label":"Professional Review","approachAValue":"Required for BOQ use","approachBValue":"Required"}]}
      approachAStrengths={["Widely available","Can make image text searchable","Produces machine-readable text","Useful as one step in a document workflow"]}
      approachALimitations={["Does not by itself establish BOQ hierarchy","Table relationships can be ambiguous","Recognized characters and values require review"]}
      approachBStrengths={["Can propose supported BOQ fields for review","Can preserve supported row and section context","Can include field-level correction interfaces","Places professional review inside the workflow"]}
      approachBLimitations={["More specialized and typically more expensive than generic OCR","Still requires human review","May struggle with highly unconventional, non-standard layouts"]}
      workflowExample={"External OCR may produce recognized text from an image-only BOQ. A structured workflow can then propose supported rows and fields, but a professional must reconstruct ambiguous tables and verify descriptions, units and quantities against the source."}
      quantaraRole={"For text-based PDFs, Quantara captures supported information from the document's text layer and presents it for structured review. For scanned or image-only PDFs, Quantara detects and flags pages as requiring OCR; OCR-based extraction is not currently available."}
      faqs={[{"question":"Is OCR the same as BOQ extraction?","answer":"No. OCR recognizes characters in an image. BOQ extraction also has to interpret supported rows, columns and hierarchy, and the result still requires review."},{"question":"Why can basic OCR struggle with BOQs?","answer":"Merged cells, multi-line descriptions and hierarchical headings can make the relationship between recognized text and BOQ fields ambiguous."},{"question":"Does structured extraction guarantee perfect results?","answer":"No. Source layout and data quality affect capture, so professional review is required."},{"question":"Can I use generic OCR tools for my estimates?","answer":"Generic OCR can produce text from images, but the output may need manual structuring and reconciliation before estimating use."},{"question":"What makes Quantara different from a generic OCR tool?","answer":"For supported text-based PDFs, Quantara captures table relationships from the existing text layer into a review workflow. Quantara does not currently run OCR on scanned documents."},{"question":"Do I still need to review the document?","answer":"Yes. Captured items, units and quantities must be checked against the original source before use."},{"question":"Does it work on scanned PDFs?","answer":"Scanned PDFs can be uploaded and are automatically detected and flagged as requiring OCR, but OCR text extraction is not currently available. Scanned content requires manual transcription."}]}
      relatedLinks={[{"url":"/ocr-for-boq-documents","label":"OCR for BOQ Documents"},{"url":"/pdf-boq-extraction","label":"PDF BOQ Extraction"},{"url":"/scanned-pdf-boq","label":"Scanned PDF Workflows"},{"url":"/how-to-convert-pdf-boq-to-excel","label":"Convert PDF to Excel"},{"url":"/how-to-review-ai-extracted-boq","label":"Reviewing AI BOQs"}]}
      breadcrumbCurrent="OCR vs Structured BOQ Extraction: Text Recognition Is Only One Step"
    />
  );
}
