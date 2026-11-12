#!/usr/bin/env node
/* B 轴增样批（ZCode · 11-13 凌晨）：今晚新产物 × 双夹具（F2 现役尺 ‖ F3k2 换尺观察）。
 *   口径 = exam-4n --dose=page（与在册 B 尺读数同口径，可并排比较）；seed/rounds 与既有批一致。
 *   ⚠ 11-12 裁定"暂不换 F3k2"——本批只进观察账（scratch/f3k2-extra.tsv 同族），不触发换尺流程。
 * 用法：node scratch/zcode-1113-deps/baxis-batch.mjs [--concurrency=3]
 *   产物：scratch/zcode-1113-deps/baxis-F2-1113.tsv ‖ baxis-F3k2-1113.tsv
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const CONC = Math.max(1, Number(arg('concurrency', 3)) || 3);
const F2 = 'MSB11-R2S306293884,MSB10-R1S1149480262,MSB8-charge-R1S1861674281,Q-s47';
const F3K2 = 'MSB13-R1S791820660,MSB11-R2S306293884,MSB8-charge-R1S1861674281,KDG-B-Q-s13';
const FIX = { F2, F3k2: F3K2 };
const PACKS = [
  ['MSB16-R1S1355910883', 'docs/artifacts/night-adapt/MSB16-R1S1355910883.js'],
  ['MSB17-R1S1454169188', 'docs/artifacts/night-adapt/MSB17-R1S1454169188.js'],
  ['MSB16T-R1S1616219090-seg1', 'docs/artifacts/MSB16T-R1S1616219090-seg1.bak'],
  ['GD6a-TILT', 'scratch/arms/GD6a-TILT.bak'],
  ['GD6b-TILT', 'scratch/arms/GD6b-TILT.bak'],
];
const OUTDIR = 'scratch/zcode-1113-deps';
mkdirSync(OUTDIR, { recursive: true });

const jobs = [];
for (const [id, path] of PACKS) for (const fk of Object.keys(FIX)) for (const mode of ['multi', 'long']) jobs.push({ id, path, fk, mode });
const HEAD = ['id', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'n2', 'n3', 'n5', 'n8', 'seed', 'rounds', 'mode', 'dose', 'exam', 'pool', 'champ', 'sec'];
const results = { F2: [], F3k2: [] };
let done = 0, fails = [];
function runOne(job, cb) {
  const args = ['tools/exam-4n.mjs', '100', '77000', job.path, '--exam=B', '--dose=page', '--champ=' + FIX[job.fk]];
  if (job.mode === 'long') args.push('--mode=long');
  execFile(process.execPath, args, { maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
    done++;
    if (err) { fails.push(job.id + '/' + job.fk + '/' + job.mode + ': ' + String(stderr).split('\n')[0]); console.log('[' + done + '/' + jobs.length + '] ✘ ' + job.id + ' ' + job.fk + ' ' + job.mode); return cb(); }
    const line = stdout.split('\n').find((l) => l.startsWith('[冠军4N-B]'));
    if (!line) { fails.push(job.id + '/' + job.fk + '/' + job.mode + ': 无读数行'); return cb(); }
    const get = (k) => { const m = line.match(new RegExp('[ hnx]' + k + '=([-0-9.%]+)')); return m ? m[1] : ''; };
    const row = [job.id, get('h2'), get('h3'), get('h5'), get('h8'), get('x2'), get('x3'), get('x5'), get('x8'),
      get('n2'), get('n3'), get('n5'), get('n8'), '77000', '100', job.mode === 'long' ? 'long' : 'multi(默认)', 'page', 'B',
      get('pool'), job.fk === 'F2' ? F2 : F3K2, get('sec')];
    console.log('[' + done + '/' + jobs.length + '] ✔ ' + job.id + ' ' + job.fk + ' ' + job.mode + '  x2=' + row[5] + ' x5=' + row[7]);
    results[job.fk].push(row); cb();
  });
}
let cursor = 0;
function next() { if (cursor >= jobs.length) return finish(); const j = jobs[cursor++]; runOne(j, next); }
for (let i = 0; i < CONC; i++) next();
function finish() {
  for (const fk of Object.keys(results)) {
    writeFileSync(OUTDIR + '/baxis-' + fk + '-1113.tsv', [HEAD.join('\t')].concat(results[fk].map((r) => r.join('\t'))).join('\n') + '\n');
    console.log('✔ 写 ' + OUTDIR + '/baxis-' + fk + '-1113.tsv（' + results[fk].length + ' 行）');
  }
  if (fails.length) { console.log('✘ 失败 ' + fails.length + '：'); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
}
