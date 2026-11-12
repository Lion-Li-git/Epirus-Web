#!/usr/bin/env node
/* Δε ε=0 半边 · pilot 批驱动（ZCode · 11-13 凌晨，用户令「Δε 全没了…早点做一下测试写进去」）
 *
 * 背景：viewer 的 DE4（Δε = 页面剂量 − 考卷口径，同族）读 X<n>R 列，而 R 夹具族只量过 page dose 半边
 *   （b-f2-page-1111）；ε=0 贪心半边从未量过 ⇒ 全图 Δε 都印「未测」（champion-map/index.html 里 X2R=0 行）。
 *   本驱动 = 全量批的先导：同一台 exam-4n、同一 F2 夹具、同 seed/rounds，只把 --dose=page 换成 --dose=exam。
 *   配对性：两半同 fixture/同 seed/同 planN ⇒ 差值里只剩剂量这一个变量（旧 eps-scan 的同世界原则）。
 *
 * 用法：node scratch/zcode-1113-deps/eps0-pilot.mjs [--n=24] [--concurrency=3] [--seed=13]
 *   产物：scratch/zcode-1113-deps/exam4-F2-eps0-1113.tsv（short）‖ exam4-F2-eps0-long-1113.tsv（long）
 *   schema = exam4 家族（id h2..h8 x2..x8 n2..n8 seed rounds mode dose exam pool champ sec），
 *   与 exam4-F2-page-1111.tsv 同构 ⇒ 回填 readings/换尺管线可用同一套搬运。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const NPICK = Number(arg('n', 24)) || 24;
const CONC = Math.max(1, Number(arg('concurrency', 3)) || 3);
const SEED = Number(arg('seed', 13)) || 13;
const F2 = ['MSB11-R2S306293884', 'MSB10-R1S1149480262', 'MSB8-charge-R1S1861674281', 'Q-s47'];
const CHAMP = F2.join(',');
const OUTDIR = 'scratch/zcode-1113-deps';
mkdirSync(OUTDIR, { recursive: true });

/* ---- 抽样：registry 按 ver 分层，每层按 (pack_id hash % 层内序) 均匀抽 ---- */
const reg = readFileSync('champion-map/data/registry.tsv', 'utf8').replace(/\r/g, '').trim().split('\n').map((l) => l.split('\t'));
const h = Object.fromEntries(reg[0].map((x, i) => [x, i]));
const rows = reg.slice(1).filter((r) => r[h.path] && existsSync(r[h.path]));
const byVer = {};
for (const r of rows) (byVer[r[h.ver]] = byVer[r[h.ver]] || []).push(r);
const strata = Object.keys(byVer).sort();
const per = Math.max(1, Math.floor(NPICK / strata.length));
const picked = [];
let hs = SEED >>> 0;
const rnd = () => { hs = (hs * 1664525 + 1013904223) >>> 0; return hs / 4294967296; };
for (const v of strata) {
  const pool = byVer[v].slice().sort((a, b) => (a[h.pack_id] < b[h.pack_id] ? -1 : 1));
  const take = Math.min(per, pool.length);
  for (let i = 0; i < take; i++) picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
}
console.log('抽样：registry ' + rows.length + ' 行可跑 ‖ 分层 ' + strata.map((v) => v + '=' + byVer[v].length).join(' ') +
  ' ⇒ 抽 ' + picked.length + ' 枚（每层 ' + per + '）');
for (const r of picked) console.log('  · ' + r[h.pack_id] + '  ver=' + r[h.ver] + '  ' + r[h.path]);

/* ---- 跑批：每枚 short+long 两行，并发 CONC ---- */
const HEAD = ['id', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'n2', 'n3', 'n5', 'n8', 'seed', 'rounds', 'mode', 'dose', 'exam', 'pool', 'champ', 'sec'];
const jobs = [];
for (const r of picked) for (const mode of ['multi', 'long']) jobs.push({ id: r[h.pack_id], path: r[h.path], mode });
let done = 0, fails = [];
function runOne(job, cb) {
  const args = ['tools/exam-4n.mjs', '100', '77000', job.path, '--exam=B', '--dose=exam', '--champ=' + CHAMP];
  if (job.mode === 'long') args.push('--mode=long');
  execFile(process.execPath, args, { maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
    done++;
    if (err) { fails.push(job.id + '(' + job.mode + '): ' + String(stderr).split('\n')[0]); console.log('[' + done + '/' + jobs.length + '] ✘ ' + job.id + ' ' + job.mode); return cb(null); }
    const line = stdout.split('\n').find((l) => l.startsWith('[冠军4N-B]'));
    if (!line) { fails.push(job.id + '(' + job.mode + '): 无读数行'); return cb(null); }
    const get = (k) => { const m = line.match(new RegExp('[ hnx]' + k + '=([-0-9.%]+)')); return m ? m[1] : ''; };
    const row = [job.id, get('h2'), get('h3'), get('h5'), get('h8'), get('x2'), get('x3'), get('x5'), get('x8'),
      get('n2'), get('n3'), get('n5'), get('n8'), '77000', '100', job.mode === 'long' ? 'long' : 'multi(默认)', 'exam', 'B',
      get('pool'), CHAMP, get('sec')];
    console.log('[' + done + '/' + jobs.length + '] ✔ ' + job.id + ' ' + job.mode + '  x2=' + row[5] + ' x5=' + row[7] + ' sec=' + row[20]);
    cb(row);
  });
}
const results = { multi: [], long: [] };
let cursor = 0;
function next() {
  if (cursor >= jobs.length) return finish();
  const job = jobs[cursor++];
  runOne(job, (row) => {
    if (row) results[job.mode === 'long' ? 'long' : 'multi'].push(row);
    next();
  });
}
for (let i = 0; i < CONC; i++) next();
function finish() {
  for (const [mode, file] of [['multi', 'exam4-F2-eps0-1113.tsv'], ['long', 'exam4-F2-eps0-long-1113.tsv']]) {
    writeFileSync(OUTDIR + '/' + file, [HEAD.join('\t')].concat(results[mode].map((r) => r.join('\t'))).join('\n') + '\n');
    console.log('✔ 写 ' + OUTDIR + '/' + file + '（' + results[mode].length + ' 行）');
  }
  if (fails.length) { console.log('✘ 失败 ' + fails.length + '：'); for (const f of fails) console.log('  ' + f); process.exit(1); }
  console.log('pilot 完成：' + picked.length + ' 枚 × 2 桌形');
}
