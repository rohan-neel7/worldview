import { spawn } from 'child_process';

console.log('=======================================================');
console.log(' Starting Worldview Express API Server & Vite Server...');
console.log('=======================================================');

const server = spawn('node', ['server/index.js'], { stdio: 'inherit', shell: true });
const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

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
