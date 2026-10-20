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
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const OUT = arg('out', join(HERE, 'prior-style-paired.tsv'));
const SEEDS = String(arg('seeds', '88010,88011,88012')).split(',');
const ORIGINS = ['teach', 'beadseed', 'bead15', 'wall34', 'lctl', 'k1', 'gs82'];

/* ---- champ-audit：列顺序照 tools/champ-audit.mjs:101-124 的打印顺序，逐格数出来 ---- */
const COLS = ['考卷1st', '严胜', '伤害/局', '重击/局', '盾/局(放)', '零伤害率', '平局率', '回合', '反弹墙1st',
  '摆架势', '被集火还手', 'F回合', '有效技能数', '种类', '座位极差', '反弹墙伤害/局', '蓄能/局', '珠浪费', '混合场', '对被动'];
/* 起点包与产物包用同一套短名（否则两张表并不到一行） */
const ORIGIN_KEY = { 'v7teach-32': 'teach-起点', 'v7beadseed-82': 'beadseed-起点', 'v7bead15-93': 'bead15-起点', 'v7wall-34': 'wall34-起点', 'win-Lctl': 'lctl-起点', 'Lctl': 'lctl-起点', 'e234-out/K1': 'k1-起点', 'e514-out/G-s82': 'gs82-起点' };
const normKey = (s) => { const k = s.replace('e675-out/', '').replace('docs/artifacts/', '').replace('eval-out/', '').replace(/\.(js|bak)$/, ''); return ORIGIN_KEY[k] || k; };
function parseAudit(mode) {
  const out = {};
  for (const fn of ['champ-audit-' + mode + '-18.txt', 'champ-audit-' + mode + '-origins.txt', 'champ-audit-' + mode + '-b2.txt', 'champ-audit-' + mode + '-b3.txt', 'champ-audit-' + mode + '-big.txt']) {
    const f = join(HERE, 'raw', fn);
    if (!existsSync(f)) { console.log('⚠ 缺 ' + fn + ' ⇒ 这一路读数不进表'); continue; }
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (!/e675-out\/.*p[02]|\.bak|Lctl/.test(line)) continue;
      const nm = normKey(line.slice(0, 42).trim().replace('win-', 'win-'));
      if (line.slice(42).indexOf('?') >= 0) { console.log('⚠ 行 ' + nm + ' 里有 "?"（那一格没读数）⇒ 整行丢弃，不按位置猜补'); continue; }
      const toks = (line.slice(42).match(/-?\d[\d.]*/g) || []).map(Number);
      if (toks.length < 20) { console.log('⚠ 行 ' + nm + ' 只数到 ' + toks.length + ' 个数（该 20）⇒ 整行丢弃并点名'); continue; }
      const rec = {}; COLS.forEach((c, i) => rec[c] = toks[i]);
      out[nm] = rec;
    }
  }
  return out;
}
/* ---- gift-readout：同一份 tsv 里带"关档"与"开档 2"两把读数 ---- */
function parseGift(mode) {
  const out = {};
  for (const fn of ['gift-readout-' + mode + '-all.tsv', 'gift-readout-' + mode + '-b2.tsv', 'gift-readout-' + mode + '-b3.tsv']) {
    const f = join(HERE, fn);
    if (!existsSync(f)) { console.log('⚠ 缺 ' + fn + ' ⇒ 那一批的送盾读数不进表'); continue; }
    for (const line of readFileSync(f, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/)) {
      const c = line.split('\t');
      if (c.length < 9 || !/\.js$|\.bak$/.test(c[0])) continue;
      out[normKey(c[0])] = { 放关: +c[3], 给别人关: +c[4], 给别人开2: +c[5], 挡关: c[7], 挡开2: c[8] };
    }
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
const keyOf = (o, p, s) => [o + '-' + p + '-s' + s, o + '-' + p];   /* 两种拼法都试：第一批的 88010 没带 seed 后缀，追加批一直带 */
const cellOf = (o, p, s) => o + '-' + p + (s === SEEDS[0] ? '' : '-s' + s);
const lookup = (m, o, p, s, d) => { for (const k of keyOf(o, p, s)) { const v = get(m, k, d); if (v !== null) return v; } return null; };
const poolLookup = (o, p, s) => { for (const k of keyOf(o, p, s)) if (pool[k]) return pool[k]; return null; };
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
        const a = lookup(m, o, 'p0', s, d), b = lookup(m, o, 'p2', s, d);
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
        /* 漂移要按**全部 seed 两两组合**量，不是只前两粒（第一版写死 SEEDS[0]/[1] ⇒ 加了第三粒后漂移被低估） */
        for (let i = 0; i < SEEDS.length; i++) for (let j = i + 1; j < SEEDS.length; j++) {
          const x = lookup(m, o, p, SEEDS[i], d), y = lookup(m, o, p, SEEDS[j], d);
          if (x !== null && y !== null) drift.push(Math.abs(y - x));
        }
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
        : (pos + neg === 0
          ? (mixed > 0 ? '**判不动（每枚起点自己几粒 seed 就互相矛盾：' + mixed + ' 枚）**' : '无位移（' + zero + ' 枚全为 0）')
          : '判不动（反号 ' + neg + ' ‖ 起点内部不一致 ' + mixed + ' ‖ 无位移 ' + zero + '）')));
    lines.push([d, avail, perOrigin.map(r => r.o + ' ' + (r.v > 0 ? '+' : '') + r.v.toFixed(2) + '[' + r.detail + ']').join(' ‖ '),
      pos, neg + (mixed ? '（另有起点内部不一致 ' + mixed + '）' : '') + (zero ? '（无位移 ' + zero + '）' : ''), verdict, drift.length ? median(drift).toFixed(2) : ''].join('\t'));
  }
}
/* ---- 强度闸：池桌主体席的配对差（vs 同一参照），逐包 + 逐起点 ---- */
const rawDir = join(HERE, 'raw');
const pool = {};
const sigs = new Set();
if (existsSync(rawDir)) {
  for (const fn of readdirSync(rawDir)) {
    if (!/^pool-.*\.txt$/.test(fn)) continue;
    const name = fn.replace(/^pool-/, '').replace(/\.txt$/, '');
    const txt = readFileSync(join(rawDir, fn), 'utf8');
    const jl = txt.split(/\r?\n/).filter(l => l.trim().startsWith('{'))[0];
    if (!jl) continue;   // 还在写 / 没跑成 ⇒ 不猜
    let rec; try { rec = JSON.parse(jl); } catch (e) { console.log('⚠ pool-' + name + ' 的机器可读行解析失败 ⇒ 丢弃'); continue; }
    const m = {}, sg = {};
    for (const x of rec.perMode || []) { m[x.mode] = x.diff; sg[x.mode] = x.sig; sigs.add(x.mode + ':' + x.sig); }
    pool[name] = { diff: m, sig: sg, ref: rec.ref, miss: (txt.indexOf('主体席尺') < 0 ? '无表' : '') };
  }
}
const prodSigs = new Set(), originSigs = new Set();
for (const k in pool) (k.startsWith('origin-') ? originSigs : prodSigs).add((pool[k].sig.multi || '?') + '/' + (pool[k].sig.long || '?'));
const strength = ['# 强度闸（tools/probe-pool.mjs --subject= ‖ 读数 = 被考夺1% − 参照夺1% · pts ‖ 参照 ' + (Object.values(pool)[0] || { ref: '?' }).ref + ')',
  '# 产物 18 份的名单签名集合（大小 ' + prodSigs.size + '）：' + Array.from(prodSigs).join(' ‖ ') + (prodSigs.size === 1 ? '  ⇒ 先验配对是同桌，可以并排比' : '  ⇒ ✗ 不同桌，Δ 作废'),
  '# 起点 5 份的名单签名集合（大小 ' + originSigs.size + '）：' + Array.from(originSigs).join(' ‖ ') + (originSigs.size === 1 ? ' ⇒ 同桌' : ' ⇒ **起点侧不同桌**：subject 本身就是池成员的那枚会被摘出对手席 ⇒ roster 变小，起点数不许与产物并排读（只作旁证）'),
  ['包', 'multi 差', 'long 差'].join('\t')];
for (const k of Object.keys(pool).sort()) strength.push([k, pool[k].diff.multi ?? '', pool[k].diff.long ?? ''].join('\t'));
writeFileSync(join(HERE, 'strength-pool.tsv'), strength.join('\r\n') + '\r\n', 'utf8');
lines.push('## 强度闸（池桌配对差，pts）‖ 逐包绝对值见 strength-pool.tsv');
for (const m of ['multi', 'long']) {
  const perOrigin = [];
  for (const o of ORIGINS) {
    const ds = [];
    for (const s of SEEDS) {
      const a = poolLookup(o, 'p0', s), b = poolLookup(o, 'p2', s);
      if (!a || !b || a.diff[m] == null || b.diff[m] == null) continue;
      ds.push(b.diff[m] - a.diff[m]);
    }
    if (ds.length) { const allZero = ds.every(x => Math.abs(x) <= 0.05); perOrigin.push({ o, v: median(ds), sign: allZero ? 0 : (ds.every(x => x > 0.05) ? 1 : (ds.every(x => x < -0.05) ? -1 : 2)), detail: ds.map(x => (x > 0 ? '+' : '') + x.toFixed(1)).join('/') }); }
  }
  if (!perOrigin.length) { lines.push(['强度(' + m + ')', 0, '读不出（池桌表还没跑完）', '', '', '**读不出**', ''].join('\t')); continue; }
  const pos = perOrigin.filter(r => r.sign === 1).length, neg = perOrigin.filter(r => r.sign === -1).length;
  const mixed = perOrigin.filter(r => r.sign === 2).length, zero = perOrigin.filter(r => r.sign === 0).length;
  const verdict = (pos >= 3 && neg === 0 && mixed === 0) ? '**稳定上移**' : (neg >= 3 && pos === 0 && mixed === 0) ? '**稳定下移（强度受损）**' : '判不动';
  lines.push(['强度Δ先验(' + m + ')', perOrigin.length, perOrigin.map(r => r.o + ' ' + (r.v > 0 ? '+' : '') + r.v.toFixed(1) + '[' + r.detail + ']').join(' ‖ '),
    pos, neg + (mixed ? '（不一致 ' + mixed + '）' : '') + (zero ? '（无位移 ' + zero + '）' : ''), verdict, ''].join('\t'));
}

writeFileSync(OUT, lines.join('\r\n') + '\r\n', 'utf8');
console.log(lines.join('\n'));
console.log('\n写 ' + OUT);
