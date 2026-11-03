/* E28a · 「按**产品口径**去选包」会不会选出一批不同的包？——先量"排序随 ε 的稳定性"，再决定要不要开训练臂
 *
 * 背景（口径地图）：训练/门禁的适应度一律 ε=0（`js/train/evo.js` 内部四处写死 `(params, 0.15)`，METHODOLOGY 49 已裁），
 *   而 5 人产品是 `ui.js:464` 的 `ε=0.2 k=5 soft`。⇒ 我们**用 A 口径的分数挑包，交给 B 口径去跑**。
 *   DS 那条路是"给体检再开一栏 B 口径"（只记录不阻断）；这里问的是训练侧的问题：
 *   **如果适应度本身就带 ε，种群的排序会不会挪？会不会挑出另一批包？**
 * 按仓规（METHODOLOGY 63「先验方向再验阈值」）：**先花十分钟量排序稳定性，再决定要不要烧五小时算力行一个 ε 训练臂。**
 *
 * 噪声底怎么定（不能假装有第二个种子）：`mirrorHealth` 的种子是写死的 `mulberry32(9000+g)` ⇒ 换不了 seed。
 *   所以用**剂量-反应**代替 placebo：ε ∈ {0, 0.05, 0.1, 0.2}。
 *   · 若 ε=0→0.05 就把排序打散到和 0→0.2 一样 ⇒ "挪"主要来自任何扰动（噪声），开臂没意义；
 *   · 若 ρ 随剂量单调下降 ⇒ 是**口径本身**在换答案，值得往下做。
 *   另有一组免费的自检：`on=true, eps=0`（把源码里两参换成五参、值仍是 0）必须与 `on=false` **逐字相同**，
 *   否则搬运层有观察者效应 ⇒ 整张表作废（非零退出）。
 *
 * 只读。用法：node tools/probe-caliber-rank.mjs [--every=8] [--limit=120] [--games=60] [--eps=0,0.05,0.1,0.2] [--mode=multi]
 */
import { readdirSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['every', 'limit', 'games', 'eps', 'mode', 'packs'], 'probe-caliber-rank');
const EVERY = Number(arg('every', 8)), LIMIT = Number(arg('limit', 120)), GAMES = Number(arg('games', 60));
const MODE = arg('mode', 'multi');
const EPSL = arg('eps', '0,0.05,0.1,0.2').split(',').map(Number);
const LIST = arg('packs', '');

const files = LIST ? LIST.split(',').map(s => s.trim()).filter(Boolean)
  : readdirSync('docs/artifacts').filter(f => /\.bak$/.test(f)).sort().map(f => 'docs/artifacts/' + f);

function paramsOf(ctx) {
  const sb = ctx.sb, P = sb.EpirusPolicy;
  return P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
}
/** 权重等价类的键（METHODOLOGY 62：样本单位是"类"，不是文件） */
function hashOf(sb) {
  const s = JSON.stringify(sb.EPIRUS_CHAMPION_3P || sb.EPIRUS_CHAMPION);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36) + '_' + s.length;
}

console.log('# 排序随 ε 的稳定性（' + MODE + ' · mirrorHealth ' + GAMES + ' 局 × 5 席 · temp 0.15 k=5 soft）· ε 档 = [' + EPSL.join(', ') + ']');
const uniq = new Map(), bad = { load: 0, unpack: 0 };
for (const f of files) {
  let ctx;
  try { ctx = build({ on: false, pack: f }); } catch (e) { bad.load++; continue; }
  if (!paramsOf(ctx)) { bad.unpack++; continue; }
  const h = hashOf(ctx.sb);
  if (!uniq.has(h)) uniq.set(h, f);
}
const fams = [...uniq.entries()];
const picked = LIST ? fams : fams.filter((_, i) => i % EVERY === 0).slice(0, LIMIT);
console.log('   读取 ' + files.length + ' 个文件（加载失败 ' + bad.load + ' · 无权重 ' + bad.unpack + '）⇒ **等价类 ' + fams.length +
  ' 个** · 本次按 ' + EVERY + ' 步长抽 ' + picked.length + ' 类（占类 ' + (100 * picked.length / fams.length).toFixed(0) + '%）');

const rows = [];
for (const [, f] of picked) {
  const rec = { pack: f.replace(/^.*[\/]/, '').replace(/\.bak$/, ''), file: f, v: {} };
  for (const e of EPSL) {
    let ctx = null;
    try { ctx = build({ on: true, pack: f, temp: 0.15, eps: e, epsK: 5, epsMode: 'soft' }); } catch (err) { ctx = null; }
    if (!ctx) { rec.v[e] = null; continue; }
    if (ctx.patched !== ctx.hardwired) {
      console.log('⛔ 口径搬运自检失败（patched ' + ctx.patched + ' ≠ 真源写死处数 ' + ctx.hardwired + '）：' + f);
      process.exit(9);
    }
    let mh = null;
    try { mh = ctx.sb.EpirusTrainer.mirrorHealth(paramsOf(ctx), GAMES, 5, MODE); } catch (err) { rec.v[e] = null; continue; }
    rec.v[e] = { dmg: mh.dmgPerGame, draw: mh.drawRate, rounds: mh.rounds, gLand: mh.effSkillsLand, spread: mh.seatSpread, file: f };
  }
  rows.push(rec);
}
const live = rows.filter(r => EPSL.every(e => r.v[e]));
console.log('   全部 ε 档都量到的类：**' + live.length + ' / ' + rows.length + '**（缺档的类不参与排序比较）');
if (live.length < 20) { console.log('⛔ 可用类不足 20 ⇒ 排序比较没有功效，非零退出'); process.exit(6); }

/* 免费自检：同一粒包 `on=false` 与 `on=true,eps=0` 必须逐字相同（否则整张表是搬运层造出来的） */
{
  const ctl = build({ on: false, pack: live[0].file });
  const mh0 = ctl.sb.EpirusTrainer.mirrorHealth(paramsOf(ctl), GAMES, 5, MODE);
  const me = live[0].v[0];
  if (Math.abs(mh0.dmgPerGame - me.dmg) > 1e-12 || Math.abs(mh0.rounds - me.rounds) > 1e-12) {
    console.log('⛔ 同一粒包（' + live[0].pack + '）真源读到 dmg ' + mh0.dmgPerGame + '/局长 ' + mh0.rounds +
      '，`on=true,eps=0` 读到 ' + me.dmg + '/' + me.rounds + ' ⇒ **搬运层有观察者效应，整张表作废**');
    process.exit(9);
  }
  console.log('   ✓ 自检：`on=true,eps=0` 与真源 `on=false` 逐字相同（dmg ' + me.dmg.toFixed(4) + ' · 局长 ' + me.rounds.toFixed(2) + '）⇒ 下面的差异只来自 ε 的**值**');
}

function ranks(a) {
  const idx = a.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function spearman(x, y) {
  const a = ranks(x), b = ranks(y), n = x.length;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return sa && sb ? sab / Math.sqrt(sa * sb) : NaN;
}
const col = (e, k) => live.map(r => r.v[e][k]);

console.log('\n## ① 排序稳定性（Spearman ρ vs ε=0 · n=' + live.length + ' 个等价类）');
for (const k of ['dmg', 'gLand', 'rounds', 'draw']) {
  const line = [];
  for (const e of EPSL) line.push('ε=' + e + (e === 0 ? ' —' : ' ρ=' + spearman(col(0, k), col(e, k)).toFixed(3)));
  const lv = EPSL.map(e => { const a = col(e, k); return a.reduce((x, y) => x + y, 0) / a.length; });
  console.log('   ' + k.padEnd(6) + ' ‖ ' + line.join(' · ') + '\n          水平：' + EPSL.map((e, i) => e + '→' + lv[i].toFixed(3)).join('  '));
}
console.log('\n## ② 前 10 名会不会换人（按 `dmg/局` 排 · 括号 = 它在 ε=0 榜上的名次）');
const byBase = live.slice().sort((a, b) => b.v[0].dmg - a.v[0].dmg);
const posOf = new Map(); byBase.forEach((o, i) => posOf.set(o.pack, i + 1));
for (const e of EPSL) {
  const ord = live.slice().sort((a, b) => b.v[e].dmg - a.v[e].dmg);
  console.log('   ε=' + String(e).padEnd(5) + ord.slice(0, 10).map(o => o.pack.slice(0, 12) + '(' + posOf.get(o.pack) + ')').join(' '));
}
console.log('\n## ③ 现役包（`js/bundled-champion-3p.js`）在每一档的位置');
for (const e of EPSL) {
  const c2 = build({ on: true, pack: 'js/bundled-champion-3p.js', temp: 0.15, eps: e, epsK: 5, epsMode: 'soft' });
  const mh = c2.sb.EpirusTrainer.mirrorHealth(paramsOf(c2), GAMES, 5, MODE);
  const below = col(e, 'dmg').filter(x => x < mh.dmgPerGame).length;
  console.log('   ε=' + String(e).padEnd(5) + ' dmg/局 ' + mh.dmgPerGame.toFixed(2) + ' · 局长 ' + mh.rounds.toFixed(1) +
    ' · 平局 ' + (100 * mh.drawRate).toFixed(0) + '% ⇒ 在 ' + live.length + ' 类里第 ' + (below + 1) + ' 名（分位 ' + (100 * below / live.length).toFixed(0) + '%）');
}
const last = EPSL[EPSL.length - 1];
console.log('\n## 结论口径（给"要不要开 ε 训练臂"用的判据，不是结论本身）');
console.log('   首末档 ρ(dmg) = ' + spearman(col(0, 'dmg'), col(last, 'dmg')).toFixed(3) +
  ' ⇒ >0.9：排序几乎不换人，**开臂不值那 5 小时**；0.6~0.9：只值得给体检再开一栏；<0.6：**口径在换答案**，训练侧该上桌');
