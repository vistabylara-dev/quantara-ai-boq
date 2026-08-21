const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx,md}', { absolute: true });

const replacements = [
  {
    find: /question:\s*["']How do I create a BOQ in Quantara\?["'],\s*answer:\s*["']([^"']+)["']/g,
    replace: `question: "How do I create a BOQ in Quantara?",\n    answer: "Create and open a project, go to Drawings, upload the supported PDF, preview and store the drawing, and then create the BOQ inside the project. All extracted or entered information requires professional review."`
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
