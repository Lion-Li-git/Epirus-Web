import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const tasks = [];
for (const pool of [1, 0]) for (const mode of ['multi', 'long']) for (let s = 0; s < 8; s++) tasks.push({ pool, mode, seed: 77000 + s });
const out = []; let next = 0;
function runOne(t) {
  return new Promise(res => {
    const args = ['tools/probe-diff-ladder.mjs', '--n=5', '--games=1000', '--mode=' + t.mode, '--seed=' + t.seed];
    if (t.pool) args.push('--pool=1');
    const ch = spawn(process.execPath, args, { cwd: 'D:/code/Epirus-Web' });
    let txt = ''; ch.stdout.on('data', d => txt += d); ch.stderr.on('data', d => txt += d);
    ch.on('close', () => {
      const g = x => { const m = txt.match(new RegExp('  ' + x + '[^\\n]*?替身夺冠 ([0-9.]+)%')); return m ? Number(m[1]) : NaN; };
      out.push({ pool: t.pool, mode: t.mode, seed: t.seed, h: g('困难'), r: g('普通'), s: g('简单') });
      res();
    });
  });
}
function worker() { if (next >= tasks.length) return Promise.resolve(); const t = tasks[next++]; return runOne(t).then(worker); }
Promise.all(Array.from({ length: 8 }, worker)).then(() => { writeFileSync('C:/Users/14765/AppData/Local/Temp/epi-claim3.json', JSON.stringify(out)); console.log('DONE', out.length); process.exit(0); });