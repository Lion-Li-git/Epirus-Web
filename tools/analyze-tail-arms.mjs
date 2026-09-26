#!/usr/bin/env node
/* ============================================================================
 * analyze-tail-arms.mjs —— §E51/§E52 的配对统计（尾部聚合这根杠杆到底有没有因果效应）
 *
 * 输入（都是本仓工具的原始输出，不二次抄数）：
 *   --regime=<dir>      probe-regime-fitness 的 `--json` 分片目录（臂产物 + 现役，独立种子流）
 *   --frontier=<file>   probe-pool-frontier `--stage=2 --rows --g4-scope=all` 的 stdout（吃 #ROWS 行）
 *   --arm-prefix=E51    臂名形如 <prefix>-{ctl,t4,t8}-<seed>
 *
 * 为什么处处"配对"：同一种子 = 同一初始种群 + 同一随机流走向，配对差才把"臂与臂本来就不一样"抵掉。
 * 三条红线（都是这两天栽过的）：
 *   · **凑不成对的就明说并丢掉那一对**（不许拿单边数当配对差，METHODOLOGY 75）；
 *   · SE 小不等于可信（一律同时印 n、符号数、以及"效应 vs 噪声底"的倍数）；
 *   · 参照量不到 ⇒ 响亮失败而非退回某个默认线（METHODOLOGY 78）。只读，不写仓库。
 * ==========================================================================*/
import { readdirSync, readFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['regime', 'frontier', 'arm-prefix', 'detail'], 'analyze-tail-arms');
const RDIR = arg('regime', ''), FFILE = arg('frontier', ''), PREFIX = arg('arm-prefix', 'E51');
if (!RDIR) { console.error('⛔ 需要 --regime=<dir>（--frontier 可省 = 只判 regime 那把尺）'); process.exit(64); }

/* ---------- 读 regime 分片 ---------- */
const regRows = [];
for (const f of readdirSync(RDIR).filter(x => x.endsWith('.json')).sort()) {
  let j; try { j = JSON.parse(readFileSync(RDIR + '/' + f, 'utf8')); } catch (e) { console.error('⛔ 分片坏了 ' + f + '：' + e.message); process.exit(2); }
  if (!j.rows || !j.meta) { console.error('⛔ 分片缺 rows/meta ' + f); process.exit(2); }
  for (const r of j.rows) regRows.push(r);
  if (!regRows.meta) regRows.meta = j.meta;
}
if (regRows.length < 3) { console.error('⛔ regime 读数太少（' + regRows.length + '）'); process.exit(3); }
const regimes = Object.keys(regRows[0].per);
const poolN = regimes.filter(n => regRows[0].per[n].inpool === true);
const heldN = regimes.filter(n => regRows[0].per[n].inpool === false);
if (!heldN.length) { console.error('⛔ 分片里没有 inpool=false 的环境格 ⇒ "池外地板"这一维无从判（量具版本不对？）'); process.exit(4); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const asc = a => a.slice().sort((x, y) => x - y);
const bot = (a, k) => mean(asc(a).slice(0, Math.min(k, a.length)));
const sd = a => { if (a.length < 2) return NaN; const mu = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / (a.length - 1)); };
const METRICS = {};
for (const r of regRows) {
  const held = heldN.map(n => r.per[n]), pool = poolN.map(n => r.per[n]);
  const wins = regimes.map(n => r.per[n].win);
  METRICS[r.label] = {
    '池外地板(最差3格fit)': bot(held.map(x => x.fit), 3),
    '池外mean-fit': mean(held.map(x => x.fit)),
    '池外平均胜率': mean(held.map(x => x.win)),
    '池外最差胜率': Math.min(...held.map(x => x.win)),
    '跨环境胜率极差': Math.max(...wins) - Math.min(...wins),
    '池内mean-fit(=选择看见的)': pool.length ? mean(pool.map(x => x.fit)) : NaN,
  };
}
/* ---------- 读 frontier 的 #ROWS ---------- */
const FT = {}, FTL = [];
for (const ln of (FFILE ? readFileSync(FFILE, 'utf8') : '').split('\n')) {
  if (!/^#ROWS(-INCUMBENT)?\t/.test(ln)) continue;
  const c = ln.split('\t');
  const inc = /^#ROWS-INCUMBENT/.test(ln);
  const rec = {
    file: c[1], gMulti: +c[2], gLong: +c[3], landMulti: +c[4], landLong: +c[5], gained: +c[6], spentRate: +c[7],
    wide: c[8] === '1', closed: c[9] === '1', robust: c[10] === '1', g4long: c[11] === '' ? NaN : +c[11], g4multi: c[12] === '' ? NaN : +c[12], killer: c[13] || ''
  };
  if (inc) { FT.__inc__ = rec; FTL.push(['__inc__', rec]); }
  else {
    /* 键 = **basename**（去掉所有目录与扩展名）。两侧来源不同：frontier 的标签只剥到 `artifacts/`，
     * 而 regime 侧的标签是探针自己生成的 ⇒ 统一收到 basename，否则查不到会**悄悄丢对**（n 变小才看得出来）。 */
    const key = rec.file.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '');
    FT[key] = rec; FTL.push([key, rec]);
  }
}
if (FFILE && !FT.__inc__) { console.error('⛔ frontier 输出里没有现役参照行 ⇒ "最克 ≤ 现役"这条判据无法成立（不许退回绝对线）'); process.exit(5); }
const INC = FT.__inc__;
const armOf = key => { const m = new RegExp('^' + PREFIX + '-(ctl|t[0-9]+)-(\\d+)$').exec(key); return m ? { k: m[1], s: m[2] } : null; };

/* ---------- 配对 ---------- */
const bySeed = {};
for (const key of Object.keys(METRICS)) {
  const a = armOf(key.replace(/\.js$/, '').replace(/^.*[\\/]/, ''));
  if (!a) continue;
  (bySeed[a.s] = bySeed[a.s] || {})[a.k] = key;
}
const DOSES = [...new Set(Object.values(bySeed).flatMap(g => Object.keys(g).filter(k => k !== 'ctl')))].sort();
if (!DOSES.length) { console.error('⛔ 一只处理臂都没有（只有 ctl）⇒ 无从配对'); process.exit(6); }
const full = Object.keys(bySeed).filter(s => bySeed[s].ctl && DOSES.every(d => bySeed[s][d]));
const dropped = Object.keys(bySeed).length - full.length;
console.log('# 尾部聚合配对分析 · regime 读数 ' + regRows.length + ' 粒 × ' + regimes.length + ' 环境（池内 ' + poolN.length + ' / 池外 ' + heldN.length +
  '）· 每格 ' + regRows.meta.seeds + ' 种子 × ' + regRows.meta.games + ' 局（种子流偏移 ' + (regRows.meta.seed0 || 0) + '）');
console.log('# 三臂齐的对：' + full.length + ' / ' + Object.keys(bySeed).length + (dropped ? '（丢掉不齐的 ' + dropped + ' 对 ⇒ 单边数不进配对统计）' : ''));
if (full.length < 4) { console.error('⛔ 齐的对 <4 ⇒ 配对 SE 没有意义，本判不成立'); process.exit(6); }

const KEYM = ['池外地板(最差3格fit)', '池外mean-fit', '池外平均胜率', '跨环境胜率极差', '池内mean-fit(=选择看见的)'];
function paired(treat) {
  const out = {};
  for (const m of KEYM.concat(['最克long', '花珠率', 'G multi', '池外最差胜率'])) {
    const d = [];
    for (const s of full) {
      const t = METRICS[bySeed[s][treat]] && METRICS[bySeed[s][treat]][m];
      const c = METRICS[bySeed[s].ctl] && METRICS[bySeed[s].ctl][m];
      if (m === '最克long' || m === '花珠率' || m === 'G multi') {
        const ft = FT[armKeyOf(s, treat)], fc = FT[armKeyOf(s, 'ctl')];
        if (!ft || !fc) continue;
        const pick = r => m === '最克long' ? r.g4long : m === '花珠率' ? r.spentRate : r.gMulti;
        if (!Number.isFinite(pick(ft)) || !Number.isFinite(pick(fc))) continue;
        d.push(pick(ft) - pick(fc)); continue;
      }
      if (typeof t !== 'number' || typeof c !== 'number' || !isFinite(t) || !isFinite(c)) continue;
      d.push(t - c);
    }
    if (d.length < 4) { out[m] = { n: d.length, bad: true }; continue; }
    const mu = mean(d), se = sd(d) / Math.sqrt(d.length);
    out[m] = { n: d.length, mu: mu, se: se, t: se > 0 ? mu / se : NaN, plus: d.filter(x => x > 0).length, minus: d.filter(x => x < 0).length };
  }
  return out;
}
function armKeyOf(s, k) {
  const key = bySeed[s] && bySeed[s][k];
  return key ? key.replace(/^.*[\\/]/, '').replace(/\.(js|bak)$/, '') : null;
}
function show(name, o) {
  console.log('\n## ' + name);
  for (const [m, v] of Object.entries(o)) {
    if (!v || v.bad) { console.log('   ' + m.padEnd(26) + ' n=' + ((v && v.n) || 0) + ' ⇒ 配对数不足，**不判**'); continue; }
    console.log('   ' + m.padEnd(26) + ' Δ均值 ' + (v.mu >= 0 ? '+' : '') + v.mu.toFixed(3) + ' ± SE ' + v.se.toFixed(3) +
      '（t=' + (Number.isFinite(v.t) ? v.t.toFixed(2) : '—') + '，n=' + v.n + '，处理赢 ' + v.plus + ' / 对照赢 ' + v.minus + '）');
  }
}
const DOSE_W = { t4: 'W=0.4', t8: 'W=0.8', t5: 'W=0.5' };
for (const d of DOSES) show(d + '（' + (DOSE_W[d] || d) + '）− ctl', paired(d));

/* ---------- 接力退化：那笔"资产账"在臂上的样子 ---------- */
if (!FT.__inc__) console.log('\n## 接力退化对照：本次**没有** frontier 输入 ⇒ 最克/闭环这一路不判（不是"没效应"，是"没量"）');
else console.log('\n## 接力退化对照（现役最克 long=' + INC.g4long + '/multi=' + INC.g4multi + ' ⇒ 每一臂离它多远）');
const rows2 = [];
for (const [key, rec] of FTL) {
  if (key === '__inc__') continue;
  const a = armOf(key);
  if (!a) continue;
  /* frontier 的键是去扩展名的文件名，而 regime 侧的标签带 `.js`（探针只剥 `.bak`）⇒ 两种都要试一次，
   * 否则明细表会**静默印成 "—"**（看着像"没量到"，其实是键没对上）。 */
  const mm = METRICS[key] || METRICS[key + '.js'] || METRICS[PREFIX + '-' + a.k + '-' + a.s] || null;
  rows2.push({ arm: key, k: a.k, s: a.s, g4: rec.g4long, g4m: rec.g4multi, killer: rec.killer, wide: rec.wide, closed: rec.closed,
    floor: mm ? mm['池外地板(最差3格fit)'] : NaN, winOut: mm ? mm['池外平均胜率'] : NaN });
}
const groupMean = (k, conv) => ['ctl'].concat(DOSES).map(x => {
  const v = rows2.filter(r => r.k === x).map(r => (conv ? conv(r[k]) : r[k])).filter(y => Number.isFinite(y));
  return v.length ? { x: x, mu: mean(v), n: v.length } : null;
}).filter(Boolean);
const yes1 = b => (b ? 1 : 0);
const LINE = { g4: '最克long', g4m: '最克multi', floor: '池外地板(fit)', winOut: '池外平均胜率', wide: '判"宽"(1=宽)', closed: '判"闭环"(1=是)' };
for (const k of ['g4', 'g4m', 'floor', 'winOut', 'wide', 'closed']) {
  const g = groupMean(k, (k === 'wide' || k === 'closed') ? yes1 : null);
  if (!g.length) { console.log('   ' + LINE[k] + '：三组都没有读数（frontier 的 --g4-scope=all 跑了吗？）'); continue; }
  console.log('   ' + LINE[k].padEnd(16) + g.map(x => x.x + ' ' + (k === 'winOut' ? (100 * x.mu).toFixed(0) + '%' : x.mu.toFixed(k === 'floor' ? 3 : (k === 'g4' || k === 'g4m') ? 1 : 2)) + '(n=' + x.n + ')').join(' · '));
}
const byK = k => rows2.filter(r => r.k === k);
for (const k of ['ctl'].concat(DOSES)) {
  const g = byK(k).filter(r => Number.isFinite(r.g4)).sort((a, b) => a.g4 - b.g4).slice(0, 3);
  console.log('   ' + k + ' 组最克最好的三臂：' + (g.map(r => r.arm + '=' + r.g4 + '/' + r.g4m + (r.killer ? '(' + r.killer + ')' : '')).join(' · ') || '（无量到）'));
}
if (arg('detail', '0') === '1') {
  console.log('\n## 全臂明细');
  for (const r of rows2.slice().sort((a, b) => a.k.localeCompare(b.k) || a.s.localeCompare(b.s)))
    console.log('   ' + r.arm.padEnd(18) + ' 最克 ' + (Number.isFinite(r.g4) ? r.g4 + '/' + r.g4m : '—') + ' · 宽 ' + (r.wide ? '✔' : '✗') +
      ' 闭环 ' + (r.closed ? '✔' : '✗') + ' · 池外地板 ' + (Number.isFinite(r.floor) ? r.floor.toFixed(3) : '—') +
      ' · 池外平均胜率 ' + (Number.isFinite(r.winOut) ? (100 * r.winOut).toFixed(0) + '%' : '—') + ' · 杀手 ' + (r.killer || '—'));
}
