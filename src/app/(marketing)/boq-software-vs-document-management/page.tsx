import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { ComparisonPage } from '@/components/layout/comparison-page';

export const metadata = createPublicPageMetadata("/boq-software-vs-document-management");



export default function Page() {
  return (
    <ComparisonPage 
      slug="boq-software-vs-document-management"
      title="BOQ Software vs Document Management Systems"
      h1="BOQ Software vs Document Management: Files and Structured Project Data"
      directAnswer="Document management systems store and organize files, while BOQ software manages the structured data, items, and quantities contained within those files."
      approachAName="BOQ Software"
      approachBName="Document Management (DMS)"
      whenToChooseA={["You need to manage the individual items and quantities of a project","You need to track revisions at the line-item level","You are generating tender outputs from structured data","You need to apply templates to standardized lists"]}
      whenToChooseB={["You need to store PDFs, CAD files, and general project correspondence","You are managing access permissions for a wide variety of file types","You need a central repository for all project documentation","You are tracking file versions, not data changes"]}
      whenToUseBoth={["Storing the original tender PDFs and drawings in the DMS, while extracting and managing the BOQ data in the BOQ software."]}
      approachADefinition={"BOQ software is a specialized platform that structures, extracts, and organizes the line-item data of a Bill of Quantities for estimating and project control."}
      approachBDefinition={"A Document Management System (DMS) is a file storage and organization platform used to track, manage, and store electronic documents and images."}
      comparisonCriteria={[{"label":"Core Unit","approachAValue":"Line items and structured data","approachBValue":"Files and folders"},{"label":"Search Capability","approachAValue":"Structured BOQ fields where available","approachBValue":"Varies by the DMS"},{"label":"Version Handling","approachAValue":"Retains distinct BOQ revisions","approachBValue":"Retains file versions where configured"},{"label":"Data Capture","approachAValue":"Captures supported information for review","approachBValue":"Primarily stores and organizes files"},{"label":"Templates","approachAValue":"Supported BOQ output templates","approachBValue":"Varies by the DMS"},{"label":"Purpose","approachAValue":"BOQ workflow","approachBValue":"Document storage and control"}]}
      approachAStrengths={["Actionable data management","Deep insight into project metrics","Specific to construction workflows","Generates commercial outputs"]}
      approachALimitations={["Not designed for general file storage (e.g., photos, HR docs)","Narrower focus than a company-wide DMS"]}
      approachBStrengths={["Broad document-storage use cases","Can support archiving where configured","May support many file types","Familiar folder-based interfaces"]}
      approachBLimitations={["Data is trapped inside the files","Cannot compare line-item changes between two PDF versions easily","Does not assist in the estimating workflow itself"]}
      workflowExample={"A client sends a revised tender package. The team can retain the source files in its document-management system, capture supported BOQ information in Quantara and keep the resulting revision as a distinct record. A professional must compare the revisions and decide what to update."}
      quantaraRole={"Quantara serves as the BOQ software, focusing on extracting and managing the structured data from the documents you might otherwise just store in a DMS."}
      faqs={[{"question":"Can document management and BOQ software be used together?","answer":"Yes. They serve complementary purposes: a DMS manages files, while BOQ software manages supported structured BOQ records."},{"question":"Is a shared drive a DMS?","answer":"A shared drive provides file storage. DMS versioning, permissions, search and audit features vary by product and configuration."},{"question":"Does BOQ software replace the need for folders?","answer":"No. BOQ software manages structured BOQ records, while folders or a DMS may still be needed for source files, correspondence and drawings."},{"question":"How do revisions work in a DMS?","answer":"Revision handling varies by DMS. Many systems retain file versions but do not interpret BOQ line-item differences."},{"question":"How do revisions work in Quantara?","answer":"Quantara retains distinct BOQ revision records. Users must review the records and source material to determine which quantities or descriptions changed."},{"question":"Can I link documents to BOQ items?","answer":"Quantara stores project sources and evidence references, but availability and presentation depend on the source and workflow."},{"question":"Is Quantara a document management system?","answer":"No. Quantara focuses on BOQ workflow and structured data, not general-purpose document management."}]}
      relatedLinks={[{"url":"/boq-management","label":"BOQ Management"},{"url":"/boq-document-generation","label":"Document Generation"},{"url":"/boq-revision-control","label":"Revision Control"},{"url":"/about","label":"About Quantara"},{"url":"/features","label":"Features"}]}
      breadcrumbCurrent="BOQ Software vs Document Management: Files and Structured Project Data"
    />
  );
}
