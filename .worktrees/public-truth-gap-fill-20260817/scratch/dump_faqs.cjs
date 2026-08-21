const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx,md}', { absolute: true });

files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/question:\s*["']([^"']+)["']/g);
  if(m) {
    console.log(f);
    console.log(m);
  }
});
