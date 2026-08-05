import { Metadata } from "next";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "BOQ Revision Control and Version Management | Quantara",
  description: "Learn how to manage BOQ revisions, document versions, change records, approvals and controlled project outputs.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-revision-control",
  },
  openGraph: {
    title: "BOQ Revision Control and Version Management | Quantara",
    description: "Learn how to manage BOQ revisions, document versions, change records, approvals and controlled project outputs.",
    url: "https://quantara.vistabylara.com/boq-revision-control",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "BOQ Revision Control for Clear Project and Commercial Records",
    title: "BOQ Revision Control for Clear Project and Commercial Records",
    summary: "BOQ revision control is the systematic management of changes to a Bill of Quantities over a project's lifecycle. As designs evolve, drawings are updated, and client requirements shift, maintaining a strict version history ensures all parties know exactly which scope is currently active and priced.",
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why Version Management Matters",
    "paragraphs": [
      "For commercial teams and estimators, working from an outdated BOQ is a direct path to financial loss. If a contractor prices Revision 1 while the client expects delivery of Revision 3, disputes are inevitable.",
      "Proper revision control provides an audit trail of what changed, when it changed, who approved it, and why."
    ]
  },
  {
    "id": "key-elements",
    "heading": "Core Elements of Revision Control",
    "bullets": [
      "Revision Identifiers: Clear, sequential numbering or lettering (e.g., Rev A, Rev B, Rev 01).",
      "Issue Dates: The exact date the revision was published or locked.",
      "Change Descriptions: A summary log explaining what was modified (e.g., \"Added external paving items to Section 4\").",
      "Source-Document References: Linking the BOQ revision to the specific drawing revisions it is based upon.",
      "Superseded Versions: Clearly marking older versions as obsolete so they cannot be accidentally used.",
      "Approvals: Documenting which qualified professional authorized the release of the new revision."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical consultant issues a BOQ (Rev 0) for a commercial building.",
      "A week later, the architect adds a security fence. The consultant updates the BOQ, changes the identifier to Rev 1, logs \"Added security fence per Drawing A-102 Rev B,\" and issues it to the bidding contractors.",
      "The contractors now know exactly what changed without having to manually compare every single line of the two documents."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations in Manual Processes",
    "paragraphs": [
      "Managing revisions via email attachments (e.g., \"BOQ_Final_v3_Real_Final.xlsx\") leads to chaos. Without a structured system, change logs are often forgotten, and team members overwrite each other's data.",
      "While formal software helps, it does not guarantee formal audit compliance unless organizational processes mandate its strict usage."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Handles Revisions",
    "paragraphs": [
      "Quantara provides structured BOQ management, allowing teams to maintain a single source of truth. Revisions and updates are managed within the platform, reducing the risk of scattered, outdated spreadsheet files.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs."
    ]
  }
],
    faqs: [
  {
    "question": "What is a change record in a BOQ?",
    "answer": "A change record (or revision history block) is a summary table usually placed at the front of the document detailing the date, revision number, and a brief description of the updates made."
  },
  {
    "question": "How do you compare two BOQ revisions?",
    "answer": "Manually, this involves tedious side-by-side checking. Digitally, software can run a variance analysis to highlight added, removed, or modified items and quantities."
  },
  {
    "question": "What happens to older BOQ versions?",
    "answer": "They are retained for historical record and audit purposes, but must be clearly watermarked or segregated into an archive folder labeled \"Superseded.\""
  },
  {
    "question": "Who approves a new BOQ revision?",
    "answer": "A senior commercial manager, project manager, or lead quantity surveyor must review and approve the changes before the revision is formally issued."
  },
  {
    "question": "Why link a BOQ revision to drawing revisions?",
    "answer": "Because the BOQ is just a text representation of the drawings. If you don't know which drawings the BOQ represents, you cannot verify the quantities."
  }
],
    relatedReading: [
  {
    "href": "/boq-management",
    "label": "BOQ Management Software"
  },
  {
    "href": "/how-to-prepare-a-boq",
    "label": "How to Prepare a BOQ"
  },
  {
    "href": "/boq-review-checklist",
    "label": "BOQ Review Checklist"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "BOQ Revision Control for Clear Project and Commercial Records",
      "description": "Learn how to manage BOQ revisions, document versions, change records, approvals and controlled project outputs.",
      "url": "https://quantara.vistabylara.com/boq-revision-control",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
