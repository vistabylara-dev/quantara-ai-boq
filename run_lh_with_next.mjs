import { spawn } from 'child_process';
import { execSync } from 'child_process';

const nextProcess = spawn('npm', ['start', '--', '-p', '3005'], { stdio: 'inherit', shell: true });

setTimeout(() => {
  try {
    console.log("Running lighthouse...");
    execSync('node run-lighthouse.mjs', { stdio: 'inherit' });
  } catch(e) {
    console.error(e);
  } finally {
    nextProcess.kill();
  }
}, 5000);
