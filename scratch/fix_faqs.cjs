const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx,md}', { absolute: true });

const replacements = [
  {
    find: /question:\s*["']How do I create a BOQ in Quantara\?["'],\s*answer:\s*["']([^"']+)["']/g,
    replace: `question: "How do I create a BOQ in Quantara?",\n    answer: "Create and open a project, then select one or more supported data sources. You may upload files manually, connect an authorized external application where available, or combine both methods. Quantara imports and organizes the supported source data within the project workspace for review. After confirming the source information, revisions, descriptions, quantities and units, you can create or update the BOQ and complete professional review."`
  },
  {
    find: /question:\s*["']Can I use more than one data source\?["'],\s*answer:\s*["']([^"']+)["']/g,
    replace: `question: "Can I use more than one data source?",\n    answer: "Yes, where supported. A Quantara project may combine manually uploaded files with information imported from authorized external applications. Users must review the origin, revision and accuracy of all source information before using it in the BOQ."`
  },
  {
    find: /question:\s*["']Does Quantara automatically combine conflicting source data\?["'],\s*answer:\s*["']([^"']+)["']/g,
    replace: `question: "Does Quantara automatically combine conflicting source data?",\n    answer: "No. Quantara may organize supported source information within the same project, but users must review conflicting descriptions, quantities, revisions and project records. Contractual precedence and professional interpretation remain the responsibility of qualified project professionals."`
  },
  {
    find: /question:\s*["']Do I need to upload files manually\?["'],\s*answer:\s*["']([^"']+)["']/g,
    replace: `question: "Do I need to upload files manually?",\n    answer: "Not necessarily. Manual upload is one supported source method. Where a verified external integration is available, users may authorize the application and import permitted records or files. Availability depends on the current integration status."`
  },
  {
    find: /question:\s*["']Does imported information automatically create the BOQ\?["'],\s*answer:\s*["']([^"']+)["']/g,
    replace: `question: "Does imported information automatically create the BOQ?",\n    answer: "No. Imported or extracted information must be reviewed, corrected and organized before it is used to create or update a BOQ. Professional review remains mandatory."`
  }
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  replacements.forEach(r => {
    if (content.match(r.find)) {
      content = content.replace(r.find, r.replace);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log("Updated FAQ in " + file);
  }
});
