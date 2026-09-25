/* E25 · 新 G（最大单卡落地份额 ≤60%）在 **long 口径**下到底卡住多少包？（用户 09-26 已批"可以覆盖 long"）
 *   ⇒ 这条栏要覆盖 long，先按仓规"先量判别力再立门"：两个模式各量一遍分布 + 现役落在第几分位 + 各条线会砍掉多少。
 * 单一来源：份额一律走 `audit-lib.landShareOf`（不许自己 max(landByKey)/landedTotal —— DS 那样算出过 44900%）。
 * 口径（METHODOLOGY 62）：**先按权重哈希去重**，再在"等价类"上抽样。
 *   ⇒ 归档里同一家族常有几十上百个逐位相同的克隆；不去重直接按文件步长抽，分布会被最大的那族绑架（不是"样本量"问题，是"样本单位"问题）。
 * 只读。用法：node tools/probe-share-modes.mjs [--every=4] [--limit=200] [--games=120] [--line=0.60] [--packs=a,b]
 */
import { readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from './probe-layer-caliber.mjs';
import { landShareOf, rejectUnknownFlags } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['every', 'limit', 'games', 'line', 'packs', 'gscan'], 'probe-share-modes');
const EVERY = Number(arg('every', 4)), LIMIT = Number(arg('limit', 200)), GAMES = Number(arg('games', 120)), LINE = Number(arg('line', 0.60));
const LIST = arg('packs', '');
const files = LIST ? LIST.split(',').map(s => s.trim()).filter(Boolean)
  : readdirSync('docs/artifacts').filter(f => /\.bak$/.test(f)).sort().map(f => 'docs/artifacts/' + f);

/** 从一粒包里取"3P 那一份权重"（与 promote 同一读法），并给出稳定哈希 */
function unpack3p(ctx) {
  const sb = ctx.sb, P = sb.EpirusPolicy;
  const params = P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
  if (!params) return null;
  const h = createHash('sha1').update(JSON.stringify(sb.EPIRUS_CHAMPION_3P || sb.EPIRUS_CHAMPION)).digest('hex').slice(0, 12);
  return { params: params, hash: h };
}

console.log('# 最大单卡落地份额 · **两个模式各量**（mirrorHealth ' + GAMES + ' 局 × 5 席 · 确定性 ε=0）· 现线 =' + (100 * LINE).toFixed(0) + '%');
console.log('## ① 去重（先定"样本单位"再谈分布）');
const uniq = new Map(), bad = { load: 0, unpack: 0 };
for (const f of files) {
  let ctx;
  try { ctx = build({ on: false, pack: f }); } catch (e) { bad.load++; continue; }
  const u = unpack3p(ctx);
  if (!u) { bad.unpack++; continue; }
  if (!uniq.has(u.hash)) uniq.set(u.hash, { file: f, hash: u.hash, n: 1 });
  else uniq.get(u.hash).n++;
}
console.log('   读取 ' + files.length + ' 个文件 → 加载失败 ' + bad.load + ' · 无权重 ' + bad.unpack +
  ' ⇒ 可测 ' + (files.length - bad.load - bad.unpack) + ' · **去重后等价类 ' + uniq.size + ' 个**（平均每类 ' +
  ((files.length - bad.load - bad.unpack) / Math.max(1, uniq.size)).toFixed(1) + ' 个逐位相同的文件）');
const fams = [...uniq.values()];
const picked = LIST ? fams : fams.filter((_, i) => i % EVERY === 0).slice(0, LIMIT);
console.log('   本表在等价类上按 ' + EVERY + ' 步长抽 ' + picked.length + ' 类（覆盖率 ' + (100 * picked.length / fams.length).toFixed(0) + '% 的类 · ' +
  (100 * picked.reduce((a, x) => a + x.n, 0) / fams.reduce((a, x) => a + x.n, 0)).toFixed(0) + '% 的文件）');

const rows = [];
for (const it of picked) {
  let ctx;
  try { ctx = build({ on: false, pack: it.file }); } catch (e) { continue; }
  const u = unpack3p(ctx);
  if (!u) continue;
  const sb = ctx.sb;
  let shM = null, shL = null;
  try {
    shM = landShareOf(sb, sb.EpirusTrainer.mirrorHealth(u.params, GAMES, 5, 'multi'));
    shL = landShareOf(sb, sb.EpirusTrainer.mirrorHealth(u.params, GAMES, 5, 'long'));
  } catch (e) { continue; }
  if (!shM.total || !shL.total) continue;
  rows.push({
    pack: it.file.replace(/^.*[\/]/, '').replace(/\.bak$/, ''), n: it.n,
    multi: shM.share, long: shL.share, mkey: shM.key, lkey: shL.key, nLand: shL.total
  });
}
if (!rows.length) { console.log('⛔ 一粒都没量到 ⇒ 非零退出'); process.exit(6); }
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const m = rows.map(r => r.multi), l = rows.map(r => r.long);
console.log('\n## 分布（n=' + rows.length + ' 个等价类 · 份额 = 真卡名里最大一张的落地占比）');
for (const [nm, a] of [['multi', m], ['long  ', l]]) {
  const over = a.filter(x => x > LINE).length;
  console.log('   ' + nm + '：p10 ' + (100 * q(a, .1)).toFixed(1) + '% · 中位 ' + (100 * q(a, .5)).toFixed(1) + '% · p90 ' + (100 * q(a, .9)).toFixed(1) +
    '% · 最大 ' + (100 * Math.max.apply(null, a)).toFixed(1) + '%  ⇒  过线(>)' + (100 * LINE).toFixed(0) + '% 的有 **' + over + ' 类 = ' + (100 * over / a.length).toFixed(1) + '%**');
}
const d = rows.map(r => r.long - r.multi).sort((x, y) => x - y);
console.log('   long − multi 差：中位 ' + (100 * d[d.length >> 1]).toFixed(1) + 'pt · p10 ' + (100 * q(d, .1)).toFixed(1) + ' · p90 ' + (100 * q(d, .9)).toFixed(1) + 'pt');
console.log('\n## 现役包（`js/bundled-champion-3p.js`）在各线下的位置');
let incM = null, incL = null;
{
  const ctx = build({ on: false, pack: 'js/bundled-champion-3p.js' });
  const u = unpack3p(ctx);
  const sb = ctx.sb;
  for (const mode of ['multi', 'long']) {
    const s = landShareOf(sb, sb.EpirusTrainer.mirrorHealth(u.params, GAMES, 5, mode));
    const arr = mode === 'multi' ? m : l;
    const below = arr.filter(x => x < s.share).length;
    if (mode === 'multi') incM = s.share; else incL = s.share;
    console.log('   ' + mode.padEnd(5) + ' 最大单卡 = `' + s.key + '` ' + (100 * s.share).toFixed(1) + '%（n=' + s.total + ' 次落地）⇒ 在 ' + rows.length + ' 类里排第 ' +
      (below + 1) + '（**分位 ' + (100 * below / arr.length).toFixed(0) + '%**）· 距线 ' + (100 * (LINE - s.share)).toFixed(1) + 'pt · ' +
      (s.share > LINE ? '**⛔ 过线（会被砍）**' : '✓ 在线内'));
  }
  /* `--gscan=1`：份额对**样本量**有多敏感 ⇒ 直接决定"这条线能不能立在某个 n 上"。
   * （09-26 实测：现役 long 在 G=20/40/80/120/200/300 读 60.2/59.3/62.5/63.9/62.6/62.5 ⇒ 只有 n≤40 那两档"在线内"） */
  if (arg('gscan', '') === '1') {
    for (const g of [20, 40, 80, 120, 200]) {
      const rm = landShareOf(sb, sb.EpirusTrainer.mirrorHealth(u.params, g, 5, 'multi'));
      const rl = landShareOf(sb, sb.EpirusTrainer.mirrorHealth(u.params, g, 5, 'long'));
      console.log('   G=' + String(g).padEnd(4) + ' multi ' + (100 * rm.share).toFixed(1) + '% · long ' + (100 * rl.share).toFixed(1) +
        '%  ⇒  两模式都在线内？' + (rm.share <= LINE && rl.share <= LINE ? '是' : '**否**'));
    }
  }
}
console.log('\n## 线位扫描（"把线放在哪里"= 砍掉多少类 + 现役还留不留得住）');
console.log('   线      multi 过线    long 过线    两模式都判(multi|long)   现役 multi/long 是否还在');
for (const ln of [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]) {
  const om = m.filter(x => x > ln).length, ol = l.filter(x => x > ln).length;
  const ob = rows.filter(r => r.multi > ln || r.long > ln).length;
  console.log('   ' + (100 * ln).toFixed(0) + '%    ' + (100 * om / m.length).toFixed(1).padStart(5) + '% (' + String(om).padStart(3) + ')  ' +
    (100 * ol / l.length).toFixed(1).padStart(5) + '% (' + String(ol).padStart(3) + ')  ' +
    (100 * ob / rows.length).toFixed(1).padStart(5) + '% (' + String(ob).padStart(3) + ')      ' +
    (incM > ln ? '⛔multi' : '✓multi') + ' / ' + (incL > ln ? '**⛔long**' : '✓long'));
}
console.log('\n## 每类两模式并排（按 long 降序 · 前 26 · 类大小 n=该权重在归档里出现几个文件）');
console.log('   包                          n   multi%   long%   Δpt    砍?（multi/long）  主卡(long)');
for (const r of rows.slice().sort((a, b) => b.long - a.long).slice(0, 26)) {
  console.log('   ' + r.pack.slice(0, 26).padEnd(28) + String(r.n).padStart(3) + ' ' + (100 * r.multi).toFixed(1).padStart(6) + ' ' + (100 * r.long).toFixed(1).padStart(6) +
    ' ' + (100 * (r.long - r.multi)).toFixed(1).padStart(6) + '      ' + (r.multi > LINE ? '⛔' : '✓') + '/' + (r.long > LINE ? '⛔' : '✓') + '        ' + (r.lkey || '—'));
}
const both = rows.filter(r => r.multi > LINE && r.long > LINE).length, onlyL = rows.filter(r => r.multi <= LINE && r.long > LINE).length;
console.log('\n## 若把线扩到 long（两模式都判，与 v1.5.145 的"广度两个模式都判"同规矩）');
console.log('   只 multi 过线被砍：' + rows.filter(r => r.multi > LINE).length + ' 类 → 加上 long 后共 ' +
  rows.filter(r => r.multi > LINE || r.long > LINE).length + ' 类（**多砍 ' + onlyL + ' 类**，两模式都过线 ' + both + ' 类）');
