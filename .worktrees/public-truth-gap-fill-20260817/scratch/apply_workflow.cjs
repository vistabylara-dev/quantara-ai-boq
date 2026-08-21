const fs = require('fs');

const pageTsxPath = 'src/app/page.tsx';
let pageTsx = fs.readFileSync(pageTsxPath, 'utf8');

// Update heading
pageTsx = pageTsx.replace(
  '<h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-16">How Quantara Works</h2>',
  '<h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-16">How to Use Quantara</h2>\n          <p className="text-center text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-8">\n            Quantara uses a project-first workflow. Users create a project once, then bring in supported information through manual file uploads, authorized external applications, or a combination of both. Quantara organizes supported source data within the project workspace so users can review the information and create or update a structured BOQ.\n          </p>\n          <p className="text-center text-sm text-slate-500 dark:text-slate-500 max-w-3xl mx-auto mb-16 italic">\n            Data-source availability depends on the current product status, supported file formats, integration availability and user authorization. Imported or extracted information does not become professionally approved merely because it appears in the project workspace.\n          </p>'
);

// Update workflow list
const oldWorkflow = `[
              { title: "Create a company workspace", desc: "Establish an authenticated, secure environment for your estimators and project teams to collaborate without mixing distinct commercial data." },
              { title: "Add a client and project", desc: "Organize workflows by associating incoming documents, BOQs, and generating technical records strictly within a unified project context." },
              { title: "Upload or import supported project documents", desc: "Upload verified formats like text-based PDFs, XLSX, or CSV files to serve as the baseline scope for the project." },
              { title: "Review AI-assisted extracted information", desc: "Evaluate the data parsed by Quantara, ensuring extracted text, dimensions, and specifications align with the original documents before processing." },
              { title: "Organize BOQ sections and items", desc: "Structure the verified line items into logical groupings, sub-headings, and sections common to trade or industry standards." },
              { title: "Confirm quantities, units, descriptions, and specifications", desc: "Apply strict QA checks on all individual records to verify the technical accuracy and completeness of the requirements." },
              { title: "Apply approved catalogue items, templates, and pricing", desc: "Cross-reference against company-approved standard costs, descriptions, or external catalogue references to apply unified pricing logic." },
              { title: "Review revisions and project history", desc: "Maintain traceability by comparing updates against original baselines, ensuring changes in scope are actively managed and documented." },
              { title: "Generate the supported BOQ, proposal, or technical document", desc: "Export to controlled, standardized formats (such as PDF, DOCX, or XLSX) utilizing your approved company branding and layout." },
              { title: "Complete a professional human review before issuing", desc: "Execute a final manual review by a qualified Quantity Surveyor or responsible professional prior to formal distribution or contractual agreement." }
            ]`;

const newWorkflow = `[
              { title: "Create Project", desc: "Create a project once and enter the relevant client, project and workspace information." },
              { title: "Choose Data Sources", desc: "Select one or more supported data sources for the project, such as local files or authorized external applications." },
              { title: "Upload Files and/or Connect Authorized Applications", desc: "Manually upload supported project files or authorize Quantara to access permitted source information." },
              { title: "Import into Project Workspace", desc: "Bring in information from authorized sources into the controlled project environment." },
              { title: "Normalize and Organize Source Data", desc: "Quantara organizes supported source information into a consistent project structure for review." },
              { title: "Preview and Review", desc: "Preview available source documents and review imported or extracted information before proceeding." },
              { title: "Create or Update BOQ", desc: "Use the verified source data to organize BOQ sections, items, descriptions, and quantities." },
              { title: "Professional Review", desc: "All information must be reviewed by an appropriately qualified professional." },
              { title: "Generate Supported Outputs", desc: "Generate the supported BOQ, proposal, technical report or export format available." }
            ]`;

pageTsx = pageTsx.replace(oldWorkflow, newWorkflow);
fs.writeFileSync(pageTsxPath, pageTsx);

console.log("Updated page.tsx");
