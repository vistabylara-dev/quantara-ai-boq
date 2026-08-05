const fs = require('fs');
const path = require('path');

const publicRoutes = [
  { file: 'privacy/page.tsx', route: '/privacy' },
  { file: 'terms/page.tsx', route: '/terms' },
  { file: 'security/page.tsx', route: '/security' },
  { file: 'contact-sales/page.tsx', route: '/contact-sales', title: 'Contact Sales', desc: 'Contact the Quantara team.' },
  { file: 'login/page.tsx', route: '/login', title: 'Login', desc: 'Sign in to your Quantara workspace.' },
  { file: 'register/page.tsx', route: '/register', title: 'Register', desc: 'Request early access to Quantara.' }
];

publicRoutes.forEach(r => {
  const filePath = path.join('src', 'app', r.file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('export const metadata: Metadata = {')) {
      if (!content.includes('canonical: "')) {
        content = content.replace(
          'export const metadata: Metadata = {',
          'export const metadata: Metadata = {\n  alternates: { canonical: "' + r.route + '" },'
        );
      }
    } else {
      const metaImport = content.includes('import { Metadata }') ? '' : 'import type { Metadata } from "next";\n';
      const metaExport = `\nexport const metadata: Metadata = {\n  title: "${r.title} | Quantara",\n  description: "${r.desc}",\n  alternates: {\n    canonical: "${r.route}"\n  }\n};\n\n`;
      
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfImports = content.indexOf('\n', lastImportIndex) + 1;
        content = content.slice(0, endOfImports) + metaImport + metaExport + content.slice(endOfImports);
      } else {
        content = metaImport + metaExport + content;
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
