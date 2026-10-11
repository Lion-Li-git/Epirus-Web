/* champion-map/opphuman-measure.mjs —— 量「人类形状替身放上训练桌」这批配对臂的闸侧三把尺
 *
 * 判据（与 champion-map/opphuman-arms.mjs 头部**同一份**，跑前已钉，这里只执行、不改口）：
 *   设计：3 粒种子 × 配对两臂（同 seed，只有 EPIRUS_OPP_HUMAN 不同）
 *   主端点 = 人席六格均值（multi/long 两口径）配对差 ON − OFF（越低越好）
 *   次端点 = promote --dry 的阻断（0 = 过闸）
 *   护栏   = G(long) ≥ 3（塌了就红）、页面 H 不掉出噪声带
 *   零剂量守卫（§E249 那一族）：同 seed 两臂**权重指纹必须不同**；相同 ⇒ 那一格作废（假阴性），不是"没效果"
 *   PASS = 3/3 同号改善 且 配对均值改善 ≥ 3.0pt ‖ FAIL = ≥2 粒反号 或 |配对均值| < 1.0pt ‖ 其余 = 不可判
 * ⚠ 尺子口径（千问 §E576(b)）：0.7~2.3pt = **同枚换 seed** 的仪器抖动；12.8pt = **臂间**读数地板。别混读。
 *
 * 用法：node champion-map/opphuman-measure.mjs [--games=200] [--seeds=90210,90211] [--tag=]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { widOf } from './wid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };

const GAMES = arg('games', '200');
const SEAT_SEEDS = String(arg('seeds', '90210,90211')).split(',').map((s) => s.trim()).filter(Boolean);
const TAG = arg('tag', '');
const REF = 'js/bundled-champion-3p.js';   // 现役锚点（探针的锚点自证：multi 5.33/5.00 · long 12.33/9.50）

const LIST = join(HERE, 'opphuman-arms.tsv');
if (!existsSync(LIST)) { console.error('⛔ 缺 champion-map/opphuman-arms.tsv ⇒ 先跑 node champion-map/opphuman-arms.mjs'); process.exit(2); }

/* ===== 1. 从臂清单取"当选包" ===== */
const lines = readFileSync(LIST, 'utf8').trim().split('\n');
const head = lines[0].split('\t');
const ix = (n) => head.indexOf(n);
const sel = [];
for (const l of lines.slice(1)) {
  const c = l.split('\t');
  if (c[ix('selected')] !== '1') continue;
  const arm = c[ix('arm')];
  sel.push({ arm: arm, seed: Number(c[ix('seed')]), human: Number(c[ix('oppHuman')]), rel: c[ix('bandRel')], trainFit: c[ix('trainFit')] });
}
if (!sel.length) { console.error('⛔ 清单里一枚 selected 都没有 ⇒ 先查臂日志'); process.exit(2); }
console.log('当选包 ' + sel.length + ' 枚（' + sel.map((s) => s.arm).join(' ') + '）\n');

/* ===== 2. 零剂量守卫：同 seed 两臂权重指纹必须不同 ===== */
const wid = {};
for (const s of sel) {
  try { wid[s.arm] = widOf(readFileSync(join(ROOT, s.rel), 'utf8')); } catch (e) { wid[s.arm] = 'ERR'; }
}
const seeds = [...new Set(sel.map((s) => s.seed))].sort();
console.log('===== 零剂量守卫（§E249）=====');
const voidSeeds = new Set();
for (const sd of seeds) {
  const off = sel.find((s) => s.seed === sd && s.human === 0);
  const on = sel.find((s) => s.seed === sd && s.human > 0);
  if (!off || !on) { console.log('  seed ' + sd + '：缺一臂 ⇒ 这一格不判'); voidSeeds.add(sd); continue; }
  const same = wid[off.arm] === wid[on.arm];
  if (same) voidSeeds.add(sd);
  console.log('  seed ' + sd + '：off ' + wid[off.arm] + ' ‖ on ' + wid[on.arm]
    + (same ? '  ⛔ **逐字相同 ⇒ 零剂量，这一格读数作废（不是"没效果"）**' : '  ✅ 不同'));
}

/* ===== 3. 人席探针（两批）→ seat-parse ===== */
const packs = sel.map((s) => s.rel).concat([REF]);
const allPacks = packs.join(',');
const stamp = '2026-10-11' + (TAG ? '-' + TAG : '');
const seatRows = {};   // key = path → { '90210': {multi, long}, ... }
console.log('\n===== 人席（1 席"人" vs 4 席被测 · ' + GAMES + ' 局/格 · 两批）=====');
for (const sd of SEAT_SEEDS) {
  const raw = join(HERE, 'opphuman-seat-raw-' + sd + '-' + stamp + '.txt');   // ⚠ .txt 不是 .log（.gitignore:2 是 *.log）
  const tsv = join(HERE, 'opphuman-seat-' + sd + '-' + stamp + '.tsv');
  console.log('  跑 seed ' + sd + ' …');
  let out = '';
  try {
    out = execFileSync(process.execPath, ['tools/probe-human-seat.mjs', '--packs=' + allPacks, '--games=' + GAMES, '--modes=multi,long', '--seed=' + sd],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch (e) { out = String((e && e.stdout) || '') + String((e && e.stderr) || ''); }
  writeFileSync(raw, out, 'utf8');
  execFileSync(process.execPath, ['champion-map/seat-parse.mjs', '--in=' + raw, '--out=' + tsv], { cwd: ROOT, stdio: 'inherit' });
  const tl = readFileSync(tsv, 'utf8').trim().split('\n');
  const th = tl[0].split('\t');
  const cPath = th.indexOf('path'), cMode = th.indexOf('mode'), cMean = th.indexOf('六格均值'), cId = th.indexOf('id');
  for (const l of tl.slice(1)) {
    const c = l.split('\t');
    const key = c[cPath] || c[cId];
    if (!seatRows[key]) seatRows[key] = {};
    seatRows[key][sd] = Object.assign(seatRows[key][sd] || {}, { [c[cMode]]: Number(c[cMean]) });
    seatRows[key].id = c[cId];
  }
}

function seatOf(rel) {
  const r = seatRows[rel];
  if (r) return r;
  const b = rel.replace(/\.[^.]+$/, '');
  for (const k of Object.keys(seatRows)) if (k.replace(/\.[^.]+$/, '') === b) return seatRows[k];
  return null;
}
function seatMean(rel) {   // 两批 × 两口径的均值（越低越好）
  const r = seatOf(rel);
  if (!r) return NaN;
  const v = [];
  for (const sd of SEAT_SEEDS) { const o = r[sd] || {}; if (isFinite(o.multi)) v.push(o.multi); if (isFinite(o.long)) v.push(o.long); }
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}

/* ===== 4. 闸：promote --dry（解析式照 eps-arms-read.mjs，不自己发明）===== */
function gate(file) {
  let out = '';
  try { out = execFileSync(process.execPath, ['tools/promote-champion.mjs', file, '--dry', '--skip-gate-drafts', '--games=20'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch (e) { out = String((e && e.stdout) || '') + String((e && e.stderr) || ''); }
  const g = (re) => { const m = out.match(re); return m ? Number(m[1]) : NaN; };
  return { gm: g(/G\(multi\)\*?\*?\s*([\d.]+)/), gl: g(/G\(long\)\*?\*\s*([\d.]+)/) || g(/G\(long\)\s*([\d.]+)/), blocked: /⛔/.test(out) };
}

/* ===== 5. 判读 ===== */
const R = {};
for (const p of packs) {
  const gt = gate(p);
  R[p] = { seat: seatMean(p), gm: gt.gm, gl: gt.gl, blocked: gt.blocked };
}
console.log('\n===== 逐包读数 =====');
console.log('  包'.padEnd(46) + '人席均值  G(multi) G(long)  闸');
for (const p of packs) {
  const r = R[p];
  console.log('  ' + p.replace('docs/artifacts/opphuman/', '').padEnd(44)
    + (isFinite(r.seat) ? r.seat.toFixed(2) : 'NaN').padStart(6) + '   '
    + (isFinite(r.gm) ? r.gm.toFixed(2) : 'NaN').padStart(6) + '  '
    + (isFinite(r.gl) ? r.gl.toFixed(2) : 'NaN').padStart(6) + '   '
    + (r.blocked ? '⛔阻断' : '✅0 条'));
}
console.log('\n  锚点自证：现役人席均值 = ' + (isFinite(R[REF].seat) ? R[REF].seat.toFixed(2) : 'NaN')
  + '（千问 §E576 记 5.33/5.00(multi) 与 12.33/9.50(long) ⇒ 这台量具没换口径）');

console.log('\n===== 主端点：配对 ON − OFF（人席均值，负 = 人更难赢 = 改善）=====');
const diffs = [];
for (const sd of seeds) {
  const off = sel.find((s) => s.seed === sd && s.human === 0), on = sel.find((s) => s.seed === sd && s.human > 0);
  if (!off || !on) continue;
  const d = R[on.rel].seat - R[off.rel].seat;
  if (voidSeeds.has(sd)) { console.log('  seed ' + sd + '：⛔ 零剂量 ⇒ 不判（' + d.toFixed(2) + 'pt，不作证据）'); continue; }
  if (!isFinite(d)) { console.log('  seed ' + sd + '：读数缺 ⇒ 不判'); continue; }
  diffs.push(d);
  console.log('  seed ' + sd + '：off ' + R[off.rel].seat.toFixed(2) + ' → on ' + R[on.rel].seat.toFixed(2)
    + ' ⇒ ' + (d <= 0 ? '' : '+') + d.toFixed(2) + 'pt ' + (d < 0 ? '(改善 ✅)' : (d > 0 ? '(变差 ❌)' : '(打平)')));
}
const nNeg = diffs.filter((d) => d < 0).length;
const mean = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : NaN;
console.log('\n  可判 ' + diffs.length + ' 粒：改善 ' + nNeg + ' / 反号 ' + diffs.filter((d) => d > 0).length
  + ' ‖ 配对均值 ' + (isFinite(mean) ? (mean <= 0 ? '' : '+') + mean.toFixed(2) + 'pt' : 'NaN'));

let verdict;
if (diffs.length >= 3 && nNeg === diffs.length && mean <= -3.0) verdict = 'PASS（筛查通过：3/3 同号且均值 ≥3pt 改善）';
else if (diffs.length >= 2 && (diffs.filter((d) => d > 0).length >= 2 || Math.abs(mean) < 1.0)) verdict = 'FAIL（本 n 下无信号：≥2 粒反号 或 |均值| < 1.0pt）';
else verdict = '不可判（样本/方向不足 ⇒ 要不要加样本由用户裁；本仓教训：n=3 不足以定论）';
console.log('  ⇒ 判词：' + verdict);

const guard = sel.filter((s) => isFinite(R[s.rel].gl) && R[s.rel].gl < 3);
console.log('\n  护栏 G(long) ≥ 3：' + (guard.length ? '⛔ ' + guard.map((s) => s.arm + '(' + R[s.rel].gl.toFixed(2) + ')').join(' ') : '全部 ≥3 ✅'));

/* ===== 6. 落账 ===== */
const outLines = [];
outLines.push('# opHuman 配对臂 · 闸侧读数（' + stamp + '）· 判据跑前钉在 champion-map/opphuman-arms.mjs 头部');
outLines.push('# 尺：人席 = tools/probe-human-seat.mjs（' + GAMES + ' 局/格 · 两批 ' + SEAT_SEEDS.join('/') + ' · 六格均值两批两口径平均）'
  + ' ‖ 闸 = tools/promote-champion.mjs --dry --games=20 ‖ 现役锚点人席均值 = ' + (isFinite(R[REF].seat) ? R[REF].seat.toFixed(2) : 'NaN'));
outLines.push(['arm', 'seed', 'oppHuman', 'pack', 'wid', 'seatMean', 'Gmulti', 'Glong', 'blocked', 'trainFit'].join('\t'));
for (const s of sel.sort((a, b) => a.seed - b.seed || a.human - b.human)) {
  const r = R[s.rel];
  outLines.push([s.arm, s.seed, s.human, s.rel, wid[s.arm], isFinite(r.seat) ? r.seat.toFixed(2) : '',
    isFinite(r.gm) ? r.gm.toFixed(2) : '', isFinite(r.gl) ? r.gl.toFixed(2) : '', r.blocked ? 1 : 0, s.trainFit].join('\t'));
}
outLines.push('# 配对差（ON − OFF 人席均值，负 = 改善）: ' + diffs.map((d) => d.toFixed(2)).join(' / ') + ' ‖ 均值 ' + (isFinite(mean) ? mean.toFixed(2) : 'NaN') + 'pt');
outLines.push('# 判词: ' + verdict);
writeFileSync(join(HERE, 'opphuman-verdict-' + stamp + '.tsv'), outLines.join('\n') + '\n', 'utf8');
console.log('\n落账：champion-map/opphuman-verdict-' + stamp + '.tsv');
