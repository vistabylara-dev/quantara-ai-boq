const fs = require('fs');
const env = fs.readFileSync('.env.production', 'utf8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});
require('child_process').execSync('npx tsx scripts/activate-all-catalogues.ts', { stdio: 'inherit', env: process.env });
