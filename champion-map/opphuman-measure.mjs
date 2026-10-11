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
/* v3：本批主端点 = 人席的**某一格**（默认「只枪压制」）—— 那正是杀掉 12/17 候选的那一格（§E584 §5），
 * 也是 `gunSpam` 这个判据原型对应的人类原型。两批 × 两口径取**最大**（任一次漏了就算漏）。 */
const CELL = arg('cell', '只枪压制');
const ARMS = arg('arms', '');
const LIST = join(HERE, ARMS || ('opphuman-arms' + (TAG ? '-' + TAG : '') + '.tsv'));
const REF = 'js/bundled-champion-3p.js';   // 现役锚点（探针的锚点自证：multi 5.33/5.00 · long 12.33/9.50）
if (!existsSync(LIST)) { console.error('⛔ 缺臂清单 ' + LIST + ' ⇒ 先跑 node champion-map/opphuman-arms.mjs'); process.exit(2); }

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
  const cPath = th.indexOf('path'), cMode = th.indexOf('mode'), cMean = th.indexOf('六格均值'), cId = th.indexOf('id'), cWorst = th.indexOf('最大格'), cCell = th.indexOf(CELL);
  if (cCell < 0) { console.error('⛔ 人席表里没有列「' + CELL + '」（可用列：' + th.join('/') + '）'); process.exit(3); }
  for (const l of tl.slice(1)) {
    const c = l.split('\t');
    const key = c[cPath] || c[cId];
    if (!seatRows[key]) seatRows[key] = {};
    seatRows[key][sd] = Object.assign(seatRows[key][sd] || {}, { [c[cMode]]: Number(c[cMean]) });
    /* v2：**最坏格**（`最大格` 列）——上批的教训：六格均值会被单个尖刺格支配（三格 0、一格 96%）⇒
     * "这个包能不能上桌"要看最坏那一栏，不是平均。 */
    seatRows[key][sd][c[cMode] + '_w'] = Number(c[cWorst]);
    /* v3：点名的那一格（默认「只枪压制」）—— 本批主端点。 */
    seatRows[key][sd][c[cMode] + '_cell'] = Number(c[cCell]);
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
function seatCellMax(rel) {  // 点名那一格在两批 × 两口径里的**最大**值（任一次漏了就算漏）—— v3 主端点
  const r = seatOf(rel);
  if (!r) return NaN;
  const v = [];
  for (const sd of SEAT_SEEDS) { const o = r[sd] || {}; if (isFinite(o.multi_cell)) v.push(o.multi_cell); if (isFinite(o.long_cell)) v.push(o.long_cell); }
  return v.length ? Math.max.apply(null, v) : NaN;
}
function seatCellMean(rel) {
  const r = seatOf(rel);
  if (!r) return NaN;
  const v = [];
  for (const sd of SEAT_SEEDS) { const o = r[sd] || {}; if (isFinite(o.multi_cell)) v.push(o.multi_cell); if (isFinite(o.long_cell)) v.push(o.long_cell); }
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}
function seatWorst(rel) {  // 两批 × 两口径里**最坏的那一格**（越低越好）—— A′ 批的主端点
  const r = seatOf(rel);
  if (!r) return NaN;
  const v = [];
  for (const sd of SEAT_SEEDS) { const o = r[sd] || {}; if (isFinite(o.multi_w)) v.push(o.multi_w); if (isFinite(o.long_w)) v.push(o.long_w); }
  return v.length ? Math.max.apply(null, v) : NaN;
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
  R[p] = { seat: seatMean(p), worst: seatWorst(p), cell: seatCellMax(p), cellMean: seatCellMean(p), gm: gt.gm, gl: gt.gl, blocked: gt.blocked };
}
console.log('\n===== 逐包读数 =====');
console.log('  包'.padEnd(46) + '人席均值  最坏格  ' + CELL + '  G(multi) G(long)  闸');
for (const p of packs) {
  const r = R[p];
  console.log('  ' + p.replace('docs/artifacts/opphuman/', '').padEnd(44)
    + (isFinite(r.seat) ? r.seat.toFixed(2) : 'NaN').padStart(6) + '  '
    + (isFinite(r.worst) ? r.worst.toFixed(1) : 'NaN').padStart(6) + '  '
    + (isFinite(r.cell) ? r.cell.toFixed(1) : 'NaN').padStart(6) + '  '
    + (isFinite(r.gm) ? r.gm.toFixed(2) : 'NaN').padStart(6) + '  '
    + (isFinite(r.gl) ? r.gl.toFixed(2) : 'NaN').padStart(6) + '   '
    + (r.blocked ? '⛔阻断' : '✅0 条'));
}
console.log('\n  锚点自证：现役人席均值 = ' + (isFinite(R[REF].seat) ? R[REF].seat.toFixed(2) : 'NaN')
  + '（千问 §E576 记 5.33/5.00(multi) 与 12.33/9.50(long) ⇒ 均值对得上 = 这台量具没换口径）'
  + ' · 现役最坏格 = ' + (isFinite(R[REF].worst) ? R[REF].worst.toFixed(1) : 'NaN'));

/* 配对差（ON − OFF）。key='worst' 是本批主端点；'seat' 是六格均值（与上批可比，作次端点）。 */
function paired(key, label) {
  console.log('\n===== ' + label + '：配对 ON − OFF（负 = 人更难赢 = 改善）=====');
  const ds = [];
  for (const sd of seeds) {
    const off = sel.find((s) => s.seed === sd && s.human === 0), on = sel.find((s) => s.seed === sd && s.human > 0);
    if (!off || !on) continue;
    const a = R[off.rel][key], b = R[on.rel][key];
    const d = b - a;
    if (voidSeeds.has(sd)) { console.log('  seed ' + sd + '：⛔ 零剂量 ⇒ 不判（' + d.toFixed(2) + 'pt，不作证据）'); continue; }
    if (!isFinite(d)) { console.log('  seed ' + sd + '：读数缺 ⇒ 不判'); continue; }
    ds.push(d);
    console.log('  seed ' + sd + '：off ' + (isFinite(a) ? a.toFixed(2) : 'NaN') + ' → on ' + (isFinite(b) ? b.toFixed(2) : 'NaN')
      + ' ⇒ ' + (d <= 0 ? '' : '+') + d.toFixed(2) + 'pt ' + (d < 0 ? '(改善 ✅)' : (d > 0 ? '(变差 ❌)' : '(打平)')));
  }
  const nNeg = ds.filter((d) => d < 0).length, nPos = ds.filter((d) => d > 0).length;
  const m = ds.length ? ds.reduce((x, y) => x + y, 0) / ds.length : NaN;
  console.log('  可判 ' + ds.length + ' 粒：改善 ' + nNeg + ' / 反号 ' + nPos
    + ' ‖ 配对均值 ' + (isFinite(m) ? (m <= 0 ? '' : '+') + m.toFixed(2) + 'pt' : 'NaN'));
  let v;
  if (ds.length >= 3 && nNeg === ds.length && m <= -3.0) v = 'PASS（筛查通过：3/3 同号且均值 ≥3pt 改善）';
  else if (ds.length >= 2 && (nPos >= 2 || Math.abs(m) < 1.0)) v = 'FAIL（本 n 下无信号：≥2 粒反号 或 |均值| < 1.0pt）';
  else v = '不可判（样本/方向不足 ⇒ 要不要加样本由用户裁；本仓教训：n=3 不足以定论）';
  console.log('  ⇒ 判词：' + v);
  return { ds: ds, mean: m, verdict: v };
}

const PC = paired('cell', '★★ 本批主端点 = 人席「' + CELL + '」格（两批 × 两口径取最大）');
const PW = paired('worst', '次端点 1 = 人席最坏格');
const PM = paired('seat', '次端点 2 = 人席六格均值（与上批可比）');
const diffs = PM.ds, mean = PM.mean, verdict = PM.verdict;
const verdictW = PW.verdict, verdictC = PC.verdict;

const guard = sel.filter((s) => isFinite(R[s.rel].gl) && R[s.rel].gl < 3);
console.log('\n  护栏 G(long) ≥ 3：' + (guard.length ? '⛔ ' + guard.map((s) => s.arm + '(' + R[s.rel].gl.toFixed(2) + ')').join(' ') : '全部 ≥3 ✅'));

/* ===== 6. 落账 ===== */
const outLines = [];
outLines.push('# opHuman 配对臂 · 闸侧读数（' + stamp + '）· 判据跑前钉在 champion-map/opphuman-arms.mjs 头部');
outLines.push('# 尺：人席 = tools/probe-human-seat.mjs（' + GAMES + ' 局/格 · 两批 ' + SEAT_SEEDS.join('/') + ' · 六格均值两批两口径平均）'
  + ' ‖ 闸 = tools/promote-champion.mjs --dry --games=20 ‖ 现役锚点人席均值 = ' + (isFinite(R[REF].seat) ? R[REF].seat.toFixed(2) : 'NaN'));
outLines.push(['arm', 'seed', 'oppHuman', 'pack', 'wid', 'seatWorst', 'seatMean', 'Gmulti', 'Glong', 'blocked', 'trainFit'].join('\t'));
for (const s of sel.sort((a, b) => a.seed - b.seed || a.human - b.human)) {
  const r = R[s.rel];
  outLines.push([s.arm, s.seed, s.human, s.rel, wid[s.arm], isFinite(r.worst) ? r.worst.toFixed(1) : '', isFinite(r.seat) ? r.seat.toFixed(2) : '',
    isFinite(r.gm) ? r.gm.toFixed(2) : '', isFinite(r.gl) ? r.gl.toFixed(2) : '', r.blocked ? 1 : 0, s.trainFit].join('\t'));
}
outLines.push('# 现役锚点：人席均值 ' + (isFinite(R[REF].seat) ? R[REF].seat.toFixed(2) : 'NaN') + ' ‖ 最坏格 ' + (isFinite(R[REF].worst) ? R[REF].worst.toFixed(1) : 'NaN'));
outLines.push('# ★★ 本批主端点配对差（ON − OFF 人席「' + CELL + '」格取最大，负 = 改善）: ' + PC.ds.map((d) => d.toFixed(2)).join(' / ') + ' ‖ 均值 ' + (isFinite(PC.mean) ? PC.mean.toFixed(2) : 'NaN') + 'pt');
outLines.push('# ★★ 本批主端点判词: ' + verdictC);
outLines.push('# 次端点 1 配对差（ON − OFF 人席最坏格，负 = 改善）: ' + PW.ds.map((d) => d.toFixed(2)).join(' / ') + ' ‖ 均值 ' + (isFinite(PW.mean) ? PW.mean.toFixed(2) : 'NaN') + 'pt');
outLines.push('# 次端点 1 判词: ' + verdictW);
outLines.push('# 次端点配对差（ON − OFF 人席六格均值，负 = 改善）: ' + diffs.map((d) => d.toFixed(2)).join(' / ') + ' ‖ 均值 ' + (isFinite(mean) ? mean.toFixed(2) : 'NaN') + 'pt');
outLines.push('# 次端点判词: ' + verdict);
writeFileSync(join(HERE, 'opphuman-verdict-' + stamp + '.tsv'), outLines.join('\n') + '\n', 'utf8');
console.log('\n落账：champion-map/opphuman-verdict-' + stamp + '.tsv');
