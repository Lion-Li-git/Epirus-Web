#!/usr/bin/env node
/* §E315 读孪生臂：把 eps-arms.mjs 跑出来的 6 支产物量成判据要的三栏
 *   判据（跑前写死在 eps-arms.mjs 头部，这里只执行、不改口）：
 *   (a) 主判据 = 配对 Δε（同种子 pg − ex）：三粒全负 ⇒ "按线上口径训能减脆"立住；有任一 ≥0 ⇒ 判不出，只报极差。
 *   (b) 不许"更稳但更弱"：pg 的页面 H ≥ 同种子 ex − 1pt（1pt 内算打平 —— 同包换 eval seed 极差 p50 就有 1.5pt）。
 *   (c) 不许塌广度：pg 产物 G(long) ≥ 3。
 *   (d) 仪器守卫：同种子两臂**权重指纹必须不同**（§E249 那一族：零剂量臂与孪生逐位相同 = 假阴性，不是"没效果"）。
 *   ⚠ 噪声尺：单口径单 seed 的 H 差 < 3.7pt（p90）不可引 ⇒ 任何"高/低 X pt"先跟这把尺比，再决定能不能说方向。
 * 用法：node champion-map/eps-arms-read.mjs
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { widOf } from './wid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'docs/artifacts/e315-out');

function ev(file, epsOn) {
  const a = ['tools/eval-5p.mjs', '30', '5', '77000', file];
  if (epsOn) a.push('--eps=0.2', '--eps-mode=soft');
  const out = execFileSync(process.execPath, a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  return Number((out.match(/\[冠军\] 1st=([\d.]+)%/) || [0, 'NaN'])[1]);
}
/* G(long) 与阻断清单：用规范仪器 promote --dry，解析式沿用 promscan.mjs 那套（只读 ⛔ 之后的 " · " 项） */
function gate(file) {
  let out = '';
  try { out = execFileSync(process.execPath, ['tools/promote-champion.mjs', file, '--dry'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch (e) { out = String((e && e.stdout) || '') + String((e && e.stderr) || ''); }
  const g = (re) => { const m = out.match(re); return m ? Number(m[1]) : NaN; };
  /* 真实格式（实测 docs/artifacts/e307-out/dry-v7u1-93.txt:11）：`**G(long) 5.87**` ⇒ 直接抓数字，
   *   别照抄 promscan 那条 G4 的复杂式子（那条被脚本名里的英文括号咬过一次，见 §E308 的踩坑记录）。*/
  const gl = g(/G\(long\)\*?\*?\s*([\d.]+)/);
  const blocked = /⛔/.test(out);
  return { gl: gl, blocked: blocked, raw: out };
}

const files = readdirSync(OUT).filter(f => /^eps[XP]-\d+\.js$/.test(f)).sort();
if (!files.length) { console.error('⛔ e315-out 里没有臂产物 ⇒ 先跑 node champion-map/eps-arms.mjs'); process.exit(2); }
const R = [];
for (const f of files) {
  const arm = f.replace(/\.js$/, ''), p = 'docs/artifacts/e315-out/' + f;
  const exam = ev(p, false), page = ev(p, true);
  const w = widOf(readFileSync(join(OUT, f), 'utf8'));
  const gt = gate(p);
  R.push({ arm: arm, seed: Number(arm.split('-')[1]), kind: arm[3] === 'P' ? 'pg' : 'ex', exam: exam, page: page, d: exam - page, wid: w, gl: gt.gl, blocked: gt.blocked });
  console.log('  ' + arm.padEnd(12) + ' 考卷 ' + exam.toFixed(1) + ' ‖ 页面 ' + page.toFixed(1) + ' ‖ Δε ' + (exam - page).toFixed(2) +
    'pt ‖ G(long) ' + (isFinite(gt.gl) ? gt.gl.toFixed(2) : '取不到') + ' ‖ 体检 ' + (gt.blocked ? '⛔' : '✅') + ' ‖ 指纹 ' + w);
}
writeFileSync(join(HERE, 'epsarms.tsv'), ['arm', 'seed', 'kind', 'exam', 'page', 'd', 'Glong', 'blocked', 'wid'].join('\t') + '\n' +
  R.map(r => [r.arm, r.seed, r.kind, r.exam.toFixed(2), r.page.toFixed(2), r.d.toFixed(2), isFinite(r.gl) ? r.gl.toFixed(2) : '', r.blocked ? '1' : '0', r.wid].join('\t')).join('\n') + '\n');

const seeds = [...new Set(R.map(r => r.seed))];
console.log('\n===== 判据 =====');
let allNeg = true;
for (const s of seeds) {
  const ex = R.find(r => r.seed === s && r.kind === 'ex'), pg = R.find(r => r.seed === s && r.kind === 'pg');
  if (!ex || !pg) { console.log('  seed ' + s + '：缺一臂 ⇒ 不判'); allNeg = false; continue; }
  const dd = pg.d - ex.d;
  if (dd >= 0) allNeg = false;
  const same = ex.wid === pg.wid;
  console.log('  seed ' + s + ' 配对 Δε：ex ' + ex.d.toFixed(2) + ' → pg ' + pg.d.toFixed(2) + ' ⇒ 差 ' + (dd >= 0 ? '+' : '') + dd.toFixed(2) +
    'pt ' + (dd < 0 ? '(减脆 ✅)' : '(没减 ❌)') +
    '  ‖ 页面 H ' + ex.page.toFixed(1) + ' → ' + pg.page.toFixed(1) + '（' + (pg.page - ex.page >= -1 ? '没变弱 ✅' : '**变弱 ❌**') + '）' +
    '  ‖ G(long) ' + pg.gl.toFixed(2) + (pg.gl >= 3 ? ' ✅' : ' ⛔<3') +
    (same ? '\n    ⛔ **两臂权重指纹逐字相同 ⇒ 零剂量，这一格读数作废（§E249 那一族），不是"没效果"**' : ''));
}
const ds = seeds.map(s => { const ex = R.find(r => r.seed === s && r.kind === 'ex'), pg = R.find(r => r.seed === s && r.kind === 'pg'); return ex && pg ? pg.d - ex.d : NaN; }).filter(isFinite);
if (ds.length) {
  const mn = Math.min(...ds), mx = Math.max(...ds), md = ds.slice().sort((a, b) => a - b)[ds.length >> 1];
  console.log('  (a) 判定：' + (allNeg && ds.length >= 3 ? '**三粒全负 ⇒ "按线上口径训能减脆"立住**' : '判不出（有非负或不足三粒）') +
    ' ‖ 配对差 中位 ' + md.toFixed(2) + ' ‖ 极差 ' + mn.toFixed(2) + '~' + mx.toFixed(2) + 'pt');
  console.log('  ⚠ 与噪声尺比：同包换 eval seed 极差 p50 1.5 ‖ p90 3.7pt ⇒ 上面这些数**只有 Δε 之差是配对量**，绝对电平一律不许跨臂引。');
}
console.log('\n已写 champion-map/epsarms.tsv');
