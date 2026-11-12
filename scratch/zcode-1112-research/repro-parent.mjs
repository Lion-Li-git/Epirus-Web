import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
const P = 'docs/artifacts/z-repro-child.bak';
writeFileSync(P, 'x');
console.log('t0 existsSync(自写):', existsSync(P));
const child = spawn(process.execPath, ['-e', "const fs=require('fs');fs.writeFileSync('docs/artifacts/z-repro-child.bak','child-wrote');setTimeout(()=>process.exit(0),15000)"], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
setTimeout(() => console.log('t+3s existsSync(子已改写):', existsSync(P), 'childAlive:', !child.exitCode), 3000);
child.on('close', (code) => {
  console.log('child close code=' + code + ' t=' + new Date().toISOString().slice(11,19));
  console.log('t+close existsSync:', existsSync(P));
  console.log('child output captured len:', out.length);
});
