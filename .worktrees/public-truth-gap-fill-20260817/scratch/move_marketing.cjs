const fs = require('fs');
const path = require('path');

const srcAppDir = path.join(__dirname, '../src/app');
const destAppDir = path.join(__dirname, '../src/app/(marketing)');

if (!fs.existsSync(destAppDir)) {
  fs.mkdirSync(destAppDir, { recursive: true });
}

const excludedDirs = [
  '(marketing)',
  'api',
  'dashboard',
  'projects',
  'clients',
  'suppliers',
  'settings',
  'company-library',
  'data-library',
  'marketplace',
  'proposal',
  'technical-report',
  'templates',
  'login',
  'forgot-password',
  'reset-password',
  'verify-email',
  'catalogue',
  'imports',
  'fonts',
  'favicon.ico',
  'globals.css',
  'layout.tsx',
  'not-found.tsx',
  'sitemap.ts'
];

const items = fs.readdirSync(srcAppDir);

for (const item of items) {
  if (!excludedDirs.includes(item)) {
    const srcPath = path.join(srcAppDir, item);
    const destPath = path.join(destAppDir, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      console.log(`Moving directory ${item}...`);
      try {
        fs.renameSync(srcPath, destPath);
      } catch (e) {
        console.error(`Failed to move ${item}:`, e);
      }
    } else {
      // Don't move files like layout.tsx, globals.css, etc. unless we want to, but we only want to move route directories.
      if (item !== 'page.tsx') {
         // skip
      } else {
         // Should we move page.tsx? It's the homepage, which was already moved.
         // wait, src/app/page.tsx was moved already? Let's check.
      }
    }
  }
}

console.log('Done.');
