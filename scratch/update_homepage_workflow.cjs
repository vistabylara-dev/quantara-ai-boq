const fs = require('fs');

const pagePath = 'src/app/page.tsx';
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Replace the steps in the array
const newSteps = `[
              { title: "Create a Project", desc: "Start by creating a project and entering the relevant project information. The project becomes the controlled workspace for drawings, BOQ records, revisions and generated documents." },
              { title: "Open the Project", desc: "Open the required project from the project list. Confirm that you are working inside the correct client and project record before uploading documents or creating BOQ information." },
              { title: "Open Drawings", desc: "Select the Drawings area inside the project. This is where supported project drawing files are uploaded, previewed and stored." },
              { title: "Upload the PDF", desc: "Upload the supported PDF drawing or document. File processing and preview availability may depend on the file size, format, scan quality and current Early Access limits." },
              { title: "Preview and Store the Drawing", desc: "Review the uploaded PDF preview and confirm that the correct drawing and revision have been added to the project. The source document should remain connected to the project record for reference and professional review." },
              { title: "Create the BOQ", desc: "After the drawing is available within the project, begin creating the BOQ. Organize the required sections and items, then review descriptions, quantities, units, specifications, assumptions and exclusions before generating or issuing any document." }
            ]`;

// We know the array currently looks like:
// {[
//   { title: "Create Project", desc: "..." },
//   ...
//   { title: "Generate Supported Outputs", desc: "..." }
// ].map((step, index) => (
const stepsRegex = /\{\[\s*\{\s*title:.*?\]\.map\(\(step,\s*index\)/s;
content = content.replace(stepsRegex, `{${newSteps}.map((step, index)`);

// 2. Add the introductory copy
const introRegex = /<h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-6">\s*How to Use Quantara\s*<\/h2>\s*<p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl">.*?(?=<\/p>)/s;
const newIntro = `<h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-6">
              How to Use Quantara
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl">
              Quantara follows a project-based workflow. Users first create and open a project, then upload supported PDF files through the Drawings area. The uploaded drawing can be previewed and stored within the project before the user begins creating the BOQ.`;
content = content.replace(introRegex, newIntro);

// 3. Add Professional Review notice below the steps
const professionalNotice = `
          <div className="mt-16 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 md:p-8 max-w-4xl">
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Professional Review Notice
            </h3>
            <p className="text-amber-800 dark:text-amber-200 text-sm md:text-base leading-relaxed">
              Uploading a drawing does not automatically confirm quantities, measurements, scope or technical accuracy. All BOQ information must be reviewed by an appropriately qualified estimator, quantity surveyor, engineer or responsible project professional before tender, procurement, contractual or construction use.
            </p>
          </div>
`;

// Find where the ol ends.
const olEndRegex = /<\/ol>\s*(?=<div className="grid md:grid-cols-3 gap-8 mt-24">)/s;
content = content.replace(olEndRegex, `</ol>\n${professionalNotice}\n`);

fs.writeFileSync(pagePath, content);
console.log('Updated page.tsx');
