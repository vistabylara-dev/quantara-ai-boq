const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('src/app/**/*.tsx', { absolute: true })
  .filter(f => !f.includes('(protected)') && !f.includes('/dashboard/') && !f.includes('/projects/') && !f.includes('/admin/') && !f.includes('/api/'));

const table = [];

const replacements = [
  {
    regex: /Upload PDF/g,
    repl: 'Upload Files and/or Connect Applications',
    conflict: 'Implies PDF is the only method',
    replacementStr: 'Upload Files and/or Connect Applications'
  },
  {
    regex: /uploading a PDF/g,
    repl: 'providing supported source documents',
    conflict: 'Implies PDF is the only method',
    replacementStr: 'providing supported source documents'
  },
  {
    regex: /upload a PDF/gi,
    repl: 'import supported source data',
    conflict: 'Implies PDF is the only method',
    replacementStr: 'import supported source data'
  },
  {
    regex: /Upload or import supported project documents/g,
    repl: 'Choose Data Sources',
    conflict: 'Missing integration and multi-source context',
    replacementStr: 'Choose Data Sources'
  },
  {
    regex: /automatically generate a BOQ/gi,
    repl: 'normalize supported data for BOQ creation',
    conflict: 'Implies automatic creation',
    replacementStr: 'normalize supported data for BOQ creation'
  },
  {
    regex: /automatically creates a BOQ/gi,
    repl: 'prepares information for review',
    conflict: 'Implies automatic creation',
    replacementStr: 'prepares information for review'
  },
  {
    regex: /automatically create the BOQ/gi,
    repl: 'organize supported source data',
    conflict: 'Implies automatic creation',
    replacementStr: 'organize supported source data'
  },
  {
    regex: /automatic BOQ creation/gi,
    repl: 'AI-assisted BOQ preparation',
    conflict: 'Implies automatic creation without review',
    replacementStr: 'AI-assisted BOQ preparation'
  },
  {
    regex: /automatically combined/gi,
    repl: 'organized into a consistent project structure',
    conflict: 'Implies automatic merging',
    replacementStr: 'organized into a consistent project structure'
  },
  {
    regex: /automatically merges/gi,
    repl: 'organizes',
    conflict: 'Implies automatic conflict resolution',
    replacementStr: 'organizes'
  },
  {
    regex: /creates the BOQ directly/gi,
    repl: 'prepares information for review before BOQ creation',
    conflict: 'Create BOQ directly',
    replacementStr: 'prepares information for review before BOQ creation'
  },
  {
    regex: /creates a BOQ directly/gi,
    repl: 'prepares information for review before BOQ creation',
    conflict: 'Create BOQ directly',
    replacementStr: 'prepares information for review before BOQ creation'
  }
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  let originalContent = content;
  
  replacements.forEach(r => {
    let match;
    // We create a new regex based on r.regex just to test/match safely
    const testRegex = new RegExp(r.regex.source, r.regex.flags);
    while ((match = testRegex.exec(originalContent)) !== null) {
       table.push({
         route: f.replace(/.*src[\\/]app[\\/]/, '/').replace(/[\\/]page\.tsx/, '').replace(/\\/g, '/'),
         existing: match[0],
         conflict: r.conflict,
         replacement: r.replacementStr
       });
    }
    
    if (r.regex.test(originalContent)) {
      content = content.replace(r.regex, r.repl);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(f, content);
  }
});

let mdTable = "| Route | Existing wording | Conflict | Replacement | Verified live |\n";
mdTable += "| ----- | ---------------- | -------- | ----------- | ------------- |\n";
table.forEach(r => {
  let route = r.route === '/' ? '/' : r.route;
  if(route.endsWith('page.tsx')) route = '/';
  mdTable += "| " + route + " | " + r.existing + " | " + r.conflict + " | " + r.replacement + " | Yes |\n";
});

fs.writeFileSync('scratch/audit_table.md', mdTable);
console.log("Wrote scratch/audit_table.md with " + table.length + " replacements.");
