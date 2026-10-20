/* §E675 配对分析（千问 10-20/21 夜）—— 把"先验效应"与"换 seed 的 run 漂移"分开
 *
 * 为什么必须拆开：DS 那批只报了 multi 一档、且 10 粒只当"配对"用；我这批是**同起点同 seed 只差先验**，
 *   但 120 代热启动本身在同一个先验下换一粒 seed 就能把广度从 1.22 甩到 7.29 ⇒
 *   不把漂移量出来，"Δ = −2" 这种数既不能说有效也不能说无效。
 * 判据按预注册写死：某一维要成为"稳定的资源转移方向"，必须 **≥3 个独立起点同号且 0 个起点反号**；
 *   出现反号 ⇒ 只能写"判不动"；分母不足的维直接写"读不出"（不许写"无响应"）。
 *
 * 读数来源（全部是既有尺，脚本不自己算任何一个指标）：
 *   ‖ docs/research/archive/2026-10-20-prior-style/raw/champ-audit-{multi,long}-18.txt   ← tools/champ-audit.mjs
 *   ‖ docs/research/archive/2026-10-20-prior-style/gift-readout-{multi,long}-all.tsv      ← 调 tools/audit-lib.mjs 的 selfPlay
 * 用法：node docs/research/archive/2026-10-20-prior-style/prior-style-analyze.mjs [--out=<tsv>]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const OUT = arg('out', join(HERE, 'prior-style-paired.tsv'));
const SEEDS = ['88010', '88011'];
const ORIGINS = ['teach', 'beadseed', 'bead15', 'wall34', 'lctl'];

/* ---- champ-audit：列顺序照 tools/champ-audit.mjs:101-124 的打印顺序，逐格数出来 ---- */
const COLS = ['考卷1st', '严胜', '伤害/局', '重击/局', '盾/局(放)', '零伤害率', '平局率', '回合', '反弹墙1st',
  '摆架势', '被集火还手', 'F回合', '有效技能数', '种类', '座位极差', '反弹墙伤害/局', '蓄能/局', '珠浪费', '混合场', '对被动'];
function parseAudit(mode) {
  const f = join(HERE, 'raw', 'champ-audit-' + mode + '-18.txt');
  if (!existsSync(f)) throw new Error('缺 ' + f + ' ⇒ 先跑那把尺，不许在这里补算');
  const out = {};
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!/e675-out\/.*p[02]/.test(line)) continue;
    const nm = line.slice(0, 42).trim().replace('e675-out/', '').replace('.js', '');
    if (line.slice(42).indexOf('?') >= 0) { console.log('⚠ 行 ' + nm + ' 里有 "?"（那一格没读数）⇒ 整行丢弃，不按位置猜补'); continue; }
    const toks = (line.slice(42).match(/-?\d[\d.]*/g) || []).map(Number);
    if (toks.length < 20) { console.log('⚠ 行 ' + nm + ' 只数到 ' + toks.length + ' 个数（该 20）⇒ 整行丢弃并点名'); continue; }
    const rec = {}; COLS.forEach((c, i) => rec[c] = toks[i]);
    out[nm] = rec;
  }
  return out;
}
/* ---- gift-readout：同一份 tsv 里带"关档"与"开档 2"两把读数 ---- */
function parseGift(mode) {
  const f = join(HERE, 'gift-readout-' + mode + '-all.tsv');
  const out = {};
  for (const line of readFileSync(f, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/)) {
    const c = line.split('\t');
    if (c.length < 9 || !/\.js$|\.bak$/.test(c[0])) continue;
    const key = c[0].replace('e675-out/', '').replace('docs/artifacts/', '').replace('eval-out/', '').replace(/\.(js|bak)$/, '');
    out[key === 'win-Lctl' ? 'lctl' : key] = { 放关: +c[3], 给别人关: +c[4], 给别人开2: +c[5], 挡关: c[7], 挡开2: c[8] };
  }
  return out;
}
const PAIRS = { multi: {}, long: {} };
for (const m of ['multi', 'long']) {
  const au = parseAudit(m), gf = parseGift(m);
  for (const k in au) { const rec = Object.assign({}, au[k], { 给别人关: (gf[k] || {}).给别人关, 给别人开2: (gf[k] || {}).给别人开2 }); PAIRS[m][k] = rec; }
  for (const k in gf) if (!PAIRS[m][k]) PAIRS[m][k] = { 给别人关: gf[k].给别人关, 给别人开2: gf[k].给别人开2 };
}
const DIMS = ['盾/局(放)', '给别人关', '给别人开2', '有效技能数', '种类', '伤害/局', '回合', '蓄能/局', '摆架势', '对被动', '严胜', '座位极差', '珠浪费'];

/* ---- 配对：Δ先验 = 同起点同 seed 的 p2 − p0 ‖ Δseed = 同起点同先验换 seed ---- */
const get = (m, key, d) => { const r = PAIRS[m][key]; const v = r && r[d]; return (v === undefined || v === null || !isFinite(v)) ? null : v; };
const keyOf = (o, p, s) => o + '-' + p;    /* 文件名去掉 seed 后缀的部分；seed 版带 -s88011 */
const cellOf = (o, p, s) => s === SEEDS[0] ? keyOf(o, p) : keyOf(o, p) + '-s' + s;
const median = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/* ---- 逐包绝对读数（Δ=0 有两种：两边都 0 vs 两边都高 ⇒ 必须在同一张表里分得开）---- */
const WIDE = ['盾/局(放)', '给别人关', '给别人开2', '有效技能数', '种类', '回合', '伤害/局', '严胜', '蓄能/局', '摆架势', '珠浪费'];
const per = ['# 逐包绝对读数（mode 前缀 M=/L=）‖ 起点包只有 gift 侧读数（champ-audit 没量起点，要就现跑）',
  ['包'].concat(WIDE.map(w => 'M' + w)).concat(WIDE.map(w => 'L' + w)).join('\t')];
const keysAll = Object.keys(PAIRS.multi).concat(Object.keys(PAIRS.long)).filter((v, i, a) => a.indexOf(v) === i).sort();
for (const k of keysAll) {
  const cell = [];
  for (const m of ['multi', 'long']) for (const w of WIDE) { const v = get(m, k, w); cell.push(v === null ? '' : (w === '种类' ? v : +v.toFixed(2))); }
  per.push(k + '\t' + cell.join('\t'));
}
writeFileSync(join(HERE, 'per-pack-readings.tsv'), per.join('\r\n') + '\r\n', 'utf8');

const lines = ['# §E675 配对：先验效应 vs 换 seed 漂移（每维每模式一行）',
  '# 配对单位 = 一枚起点 × 一粒 seed，两臂只差 EPIRUS_SUPPORT_PRIOR ‖ 起点 v7beadseed-82 的 88011 那对两臂都当选**起点本身** ⇒ 无产物、按缺对记账，不算 0 差',
  '# ⚑ 事后口径变更登记：第一版把"两粒 seed 都恰好不动"记成"起点内不一致"，那会把 4 枚同号压成判不动 ⇒ 现改三分（同号/反号/无位移）。',
  '#    这条改动让判词**更宽**，所以两档都印：严档 = 全部起点同号且 ≥3；松档 = 同号 ≥3 且无反号无混合（允许无位移起点）。'];
for (const m of ['multi', 'long']) {
  lines.push('## mode=' + m);
  lines.push(['维度', '可用配对数', '逐起点Δ先验(中位过两 seed)', '同号起点', '反号起点', '判词', '同先验换seed的漂移幅度(中位)'].join('\t'));
  for (const d of DIMS) {
    const perOrigin = [];
    const drift = [];
    let avail = 0;
    for (const o of ORIGINS) {
      const ds = [];
      for (const s of SEEDS) {
        const a = get(m, cellOf(o, 'p0', s), d), b = get(m, cellOf(o, 'p2', s), d);
        if (a === null || b === null) continue;
        ds.push(b - a); avail++;
      }
      if (ds.length) {
        const EPS = 0.05;
        const allPos = ds.every(x => x > EPS), allNeg = ds.every(x => x < -EPS);
        const allZero = ds.every(x => Math.abs(x) <= EPS);
        /* 三分而不是两分：两 seed 都恰好不动 ≠ "方向不一致"（第一版把这种记成不一致 ⇒ 会把 4 枚同号压成判不动） */
        perOrigin.push({ o, v: median(ds), sign: allZero ? 0 : (allPos ? 1 : (allNeg ? -1 : 2)), detail: ds.map(x => (x > 0 ? '+' : '') + x.toFixed(2)).join('/'), spread: Math.max(...ds) - Math.min(...ds) });
      }
      for (const p of ['p0', 'p2']) {
        const x = get(m, cellOf(o, p, SEEDS[0]), d), y = get(m, cellOf(o, p, SEEDS[1]), d);
        if (x !== null && y !== null) drift.push(Math.abs(y - x));
      }
    }
    if (!perOrigin.length) { lines.push([d, 0, '读不出（分母 0）', '', '', '**读不出**', drift.length ? median(drift).toFixed(2) : ''].join('\t')); continue; }
    const pos = perOrigin.filter(r => r.sign === 1).length, neg = perOrigin.filter(r => r.sign === -1).length;
    const mixed = perOrigin.filter(r => r.sign === 2).length, zero = perOrigin.filter(r => r.sign === 0).length;
    const 严 = pos >= 3 && neg === 0 && mixed === 0 && zero === 0;
    const 松 = pos >= 3 && neg === 0 && mixed === 0;
    const 严n = neg >= 3 && pos === 0 && mixed === 0 && zero === 0;
    const 松n = neg >= 3 && pos === 0 && mixed === 0;
    const verdict = 严 ? '**稳定上移（严档也过）**' : (松 ? '**稳定上移（只在松档：另有 ' + zero + ' 枚无位移）**'
      : 严n ? '**稳定下移（严档也过）**' : (松n ? '**稳定下移（只在松档：另有 ' + zero + ' 枚无位移）**'
        : (pos + neg === 0 ? '无位移' : '判不动（反号 ' + neg + ' ‖ 两 seed 内部不一致 ' + mixed + '）')));
    lines.push([d, avail, perOrigin.map(r => r.o + ' ' + (r.v > 0 ? '+' : '') + r.v.toFixed(2) + '[' + r.detail + ']').join(' ‖ '),
      pos, neg + (mixed ? '（另有两 seed 不一致 ' + mixed + '）' : '') + (zero ? '（无位移 ' + zero + '）' : ''), verdict, drift.length ? median(drift).toFixed(2) : ''].join('\t'));
  }
}
writeFileSync(OUT, lines.join('\r\n') + '\r\n', 'utf8');
console.log(lines.join('\n'));
console.log('\n写 ' + OUT);
