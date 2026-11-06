import { readFileSync, readdirSync } from 'node:fs';
const dir = 'tools/gates';
for (const f of readdirSync(dir).filter(x => x.endsWith('.mjs') && x !== '_ctx.mjs').sort()) {
  const src = readFileSync(dir + '/' + f, 'utf8');
  const names = [...src.matchAll(/^t\('([^']+)'/gm)].map(m => m[1]);
  console.log('### ' + f + ' (' + names.length + ')');
  names.forEach((n, i) => console.log(String(i + 1).padStart(2, ' ') + '. ' + n));
  console.log('');
}