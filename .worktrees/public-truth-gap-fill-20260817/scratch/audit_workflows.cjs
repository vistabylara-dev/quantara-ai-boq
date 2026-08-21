const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx,md}', { absolute: true });
const findings = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('How Quantara Works') || 
      content.includes('Upload PDF') || 
      content.includes('Create BOQ') || 
      content.includes('how to use') || 
      content.includes('How to use') || 
      content.includes('upload') ||
      content.includes('Upload')) {
        
      findings.push(file.replace(/.*src[\\/]/, 'src/'));
  }
});

console.log('Found ' + findings.length + ' files with possible workflow text:');
console.log(JSON.stringify(findings, null, 2));
