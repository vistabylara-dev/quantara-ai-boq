import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

(async () => {
  console.log("Starting server...");
  const server = spawn('npm', ['start', '--', '-p', '3005'], { stdio: 'inherit', shell: true });
  
  await new Promise(r => setTimeout(r, 6000));
  console.log("Taking screenshots...");
  
  const outDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\287a06bb-9e83-4e95-b39b-dd28dbc5135e\\scratch';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true});

  const browser = await chromium.launch();
  
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 }
  ];

  const routes = [
    { path: '/', name: 'homepage' },
    { path: '/features', name: 'features' },
    { path: '/register', name: 'register' },
    { path: '/contact-sales', name: 'contact-sales' }
  ];

  for (const v of viewports) {
    const context = await browser.newContext({ viewport: { width: v.width, height: v.height } });
    const page = await context.newPage();
    
    for (const r of routes) {
      if (v.name !== 'desktop' && r.name !== 'homepage') continue; // Only need desktop for the subpages
      
      console.log(`Screenshotting ${r.name} on ${v.name}`);
      await page.goto(`http://localhost:3005${r.path}`, { waitUntil: 'networkidle' });
      
      // Remove any fixed UI elements that might obstruct full page screenshots or just wait a bit
      await new Promise(r => setTimeout(r, 500));
      
      const filename = `${r.name}_${v.name}.png`;
      await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
    }
    await context.close();
  }

  await browser.close();
  server.kill();
  console.log("Done");
})();
