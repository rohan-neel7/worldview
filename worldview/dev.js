import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=======================================================');
console.log(' Starting Worldview Express API Server & Vite Server...');
console.log('=======================================================');

const server = spawn('node', ['server/index.js'], { cwd: __dirname, stdio: 'inherit', shell: true });
const vite = spawn('npx', ['vite'], { cwd: __dirname, stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  server.kill();
  vite.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  server.kill();
  vite.kill();
  process.exit();
});
