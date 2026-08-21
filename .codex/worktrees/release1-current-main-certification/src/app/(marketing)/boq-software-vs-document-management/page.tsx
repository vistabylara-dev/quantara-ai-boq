import { Metadata } from 'next';
import { ComparisonPage } from '@/components/layout/comparison-page';

export const metadata: Metadata = {
  title: 'BOQ Software vs Document Management Systems',
  description: 'Compare structured BOQ software with document-management tools across project records, item structure, revisions, templates and outputs.',
  alternates: {
    canonical: 'https://quantara.vistabylara.com/boq-software-vs-document-management'
  },
  openGraph: {
    title: 'BOQ Software vs Document Management Systems',
    description: 'Compare structured BOQ software with document-management tools across project records, item structure, revisions, templates and outputs.',
    url: 'https://quantara.vistabylara.com/boq-software-vs-document-management',
    type: 'article'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BOQ Software vs Document Management Systems',
    description: 'Compare structured BOQ software with document-management tools across project records, item structure, revisions, templates and outputs.'
  }
};

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
      comparisonCriteria={[{"label":"Core Unit","approachAValue":"Line items and data","approachBValue":"Files and folders"},{"label":"Search Capability","approachAValue":"Search by item, section, or quantity","approachBValue":"Search by filename or document text"},{"label":"Version Control","approachAValue":"Tracks changes to specific quantities/rates","approachBValue":"Tracks entirely new file uploads (v1 vs v2)"},{"label":"Data Extraction","approachAValue":"Pulls data out of the file","approachBValue":"Stores the file as-is"},{"label":"Templates","approachAValue":"Standardized BOQ structures","approachBValue":"Folder structures"},{"label":"Purpose","approachAValue":"Commercial workflow","approachBValue":"Record keeping and compliance"}]}
      approachAStrengths={["Actionable data management","Deep insight into project metrics","Specific to construction workflows","Generates commercial outputs"]}
      approachALimitations={["Not designed for general file storage (e.g., photos, HR docs)","Narrower focus than a company-wide DMS"]}
      approachBStrengths={["Universal application across the company","Excellent for compliance and archiving","Handles any file type","Familiar folder-based interface"]}
      approachBLimitations={["Data is trapped inside the files","Cannot compare line-item changes between two PDF versions easily","Does not assist in the estimating workflow itself"]}
      workflowExample={"A client sends a revised tender package. You save the zip file and new PDFs in your Document Management System for record-keeping. You then upload the revised BOQ PDF into your BOQ software to extract the new data, compare it against the previous version, and update your estimate."}
      quantaraRole={"Quantara serves as the BOQ software, focusing on extracting and managing the structured data from the documents you might otherwise just store in a DMS."}
      faqs={[{"question":"Can document management and BOQ software be used together?","answer":"Yes, they serve complementary purposes. DMS stores the files; BOQ software manages the data."},{"question":"Is a shared drive a DMS?","answer":"A shared network drive is basic file storage. A true DMS includes version control, permissions, and audit trails."},{"question":"Does BOQ software replace the need for folders?","answer":"For BOQ data, yes. But you will still need folders (or a DMS) for general project correspondence and drawings."},{"question":"How do revisions work in a DMS?","answer":"Usually, you upload a new file named \"v2\" and the DMS tracks the history. It does not tell you which specific line item changed inside the file."},{"question":"How do revisions work in BOQ software?","answer":"The software highlights exactly which quantity or description changed from the previous version."},{"question":"Can I link documents to BOQ items?","answer":"Many BOQ systems allow you to reference source documents stored externally or uploaded directly."},{"question":"Is Quantara a document management system?","answer":"No. Quantara manages the workflow and structured data extraction for BOQs, not general file storage."}]}
      relatedLinks={[{"url":"/boq-management","label":"BOQ Management"},{"url":"/boq-document-generation","label":"Document Generation"},{"url":"/boq-revision-control","label":"Revision Control"},{"url":"/about","label":"About Quantara"},{"url":"/features","label":"Features"}]}
      breadcrumbCurrent="BOQ Software vs Document Management: Files and Structured Project Data"
    />
  );
}
