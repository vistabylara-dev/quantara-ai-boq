const fs = require('fs');

const files = [
  'src/components/layout/comparison-page.tsx',
  'src/components/layout/industry-landing-page.tsx',
  'src/components/layout/knowledge-page.tsx',
  'src/components/layout/regional-landing-page.tsx',
  'src/components/layout/seo-landing-page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Remove imports
  content = content.replace(/import PublicHeader[^\n]*\n/g, '');
  content = content.replace(/import PublicFooter[^\n]*\n/g, '');
  
  // Remove components
  content = content.replace(/<PublicHeader \/>\s*/g, '');
  content = content.replace(/<PublicFooter \/>\s*/g, '');
  
  // Replace <main> with <div>
  content = content.replace(/<main /g, '<div ');
  content = content.replace(/<\/main>/g, '</div>');
  
  // Remove redundant min-h-screen from the outermost div since marketing/layout handles it
  content = content.replace(/className="flex flex-col min-h-screen bg-white text-slate-900 font-sans"/g, 'className="w-full bg-white text-slate-900 font-sans"');
  
  if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Cleaned layout component: ' + file);
  }
}
