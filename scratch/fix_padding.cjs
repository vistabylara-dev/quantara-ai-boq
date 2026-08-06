const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}
const files = walk('src/app/(marketing)');
let updated = 0;
for (const file of files) {
  if (file.endsWith('page.tsx') && !file.endsWith('(marketing)\\page.tsx') && !file.endsWith('(marketing)/page.tsx')) {
      let content = fs.readFileSync(file, 'utf8');
      let original = content;
      
      content = content.replace(/<div className="flex flex-col min-h-screen bg-white text-slate-900 font-sans">/g, '<div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">');
      content = content.replace(/<div className="min-h-screen flex flex-col bg-white font-sans text-slate-900">/g, '<div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">');
      content = content.replace(/<div className="min-h-screen bg-white text-slate-900 font-sans">/g, '<div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">');
      content = content.replace(/<div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">/g, '<div className="container mx-auto px-4 py-16 md:py-24 max-w-7xl">');
      
      if (content !== original) {
          fs.writeFileSync(file, content);
          console.log('Fixed ' + file);
          updated++;
      }
  }
}
console.log('Total fixed: ' + updated);
