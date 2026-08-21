const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/**/*.tsx', { absolute: true });
const results = [];

files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  if (c.toLowerCase().includes('upload') || c.toLowerCase().includes('pdf') || c.toLowerCase().includes('automatic') || c.toLowerCase().includes('create boq')) {
    results.push(f.replace(/.*src[\\/]/, 'src/'));
  }
});

fs.writeFileSync('scratch/audit_targets.json', JSON.stringify(results, null, 2));
console.log('Found ' + results.length + ' files to audit.');
