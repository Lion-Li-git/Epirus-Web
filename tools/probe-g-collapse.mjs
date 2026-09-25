/* 新 G（广度）的**判别力量具** —— 先量，再决定要不要立门（v1.5.227 · 只读，不写任何产物）
 *
 * ## 为什么换 G 的定义
 * 现定义 = "净兑现 G≥3 且 ≥4 种打上血"（`audit-lib.breadthProfile` / `evo.js:mirrorHealth` 的落地计数）。
 * 两个病：
 *   ① 它数的是**低价层的种类数** —— 而实测池子里 53.5% 的包带"龟缩/响应"体质，低价层（ジ/枪/狙击）本来就那三张；
 *   ② 它把 **"高价层从来不可达"** 和 **"可达但不去"** 都读成"没打上血"（同一句话，两个完全不同的病）。
 * 新定义（用户 09-25 批准方向）分**三轴**报，不再合成一个数：
 *   **① 塌缩**：落地份额最大的一张卡是否 > 60%（= "四粒冠军三粒塌成一种卡"§N29 那个病）
 *   **② 宽度**：真打上血的卡有几种（≥3）
 *   **③ 高价层**：≥3ep 的卡**够不够得着**（可达率）与**够得着时去不去**（成交率）—— 两件事分开报
 *
 * ## 口径
 * 一律**产品口径**（ε=0.2/top5/soft，`ui.js:464`），靠 `probe-layer-caliber.mjs` 的 `build({on:true})`
 * （单一来源；与 v1.5.223 给 `probe-ideal-champion` 用的是同一条路）。
 *
 * 用法：
 *   node tools/probe-g-collapse.mjs [--packs=a,b] [--dir=docs/artifacts] [--sample=20] [--games=120] [--reach-games=60]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { build } from './probe-layer-caliber.mjs';
import { landShareOf } from './audit-lib.mjs';

const arg = function (k, d) { const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; }); return h ? h.split('=')[1] : d; };
const GAMES = Number(arg('games', 120));
const RGAMES = Number(arg('reach-games', 60));
const SAMPLE = Number(arg('sample', 20));
const DIR = arg('dir', 'docs/artifacts');
const PRODUCT = { temp: 0.15, eps: 0.2, epsK: 5, epsMode: 'soft' };
const COLLAPSE_LINE = 0.60;   // ① 的阈值（用户 09-25 默认：一种卡吃掉六成以上落地）
const WIDTH_LINE = 3;         // ② 的阈值

let packs = String(arg('packs', '')).split(',').filter(Boolean);
if (!packs.length) {
  /* ⚠️ METHODOLOGY 第 62 条（千问 09-25）：**按文件名等距抽样会系统漏掉整棵树**，而且 `.bak` 里
   * 大量"同实不同名"（我这版样本里 `v7expo-31`/`v7r3-42`/`v7soft-36` 三行读数逐字相同就是它）。
   * ⇒ 先**按内容去重**（同一份冠军参数只留一个名字），再从**等价类**里等距抽，并**报覆盖率**。
   * 这样得到的比例才谈得上"档案里的比例"；否则只能说"我抽到的这些粒"。 */
  const idOf = function (f) {
    const s = readFileSync(f, 'utf8');
    const m = /window\.EPIRUS_CHAMPION_3P = ([\s\S]*?);\n/.exec(s) || /window\.EPIRUS_CHAMPION = ([\s\S]*?);\n/.exec(s);
    return createHash('sha1').update(m ? m[1] : s).digest('hex').slice(0, 12);
  };
  const all = readdirSync(DIR).filter(function (f) { return /\.bak$/.test(f); }).sort();
  const seen = new Set(), uniq = [];
  let dupNames = 0;
  for (const f of all) {
    const p = DIR + '/' + f;
    let id; try { id = idOf(p); } catch (e) { continue; }
    if (seen.has(id)) { dupNames++; continue; }
    seen.add(id); uniq.push(p);
  }
  const step = Math.max(1, Math.floor(uniq.length / SAMPLE));
  packs = [];
  for (let i = 0; i < uniq.length && packs.length < SAMPLE; i += step) packs.push(uniq[i]);
  packs.unshift('js/bundled-champion-3p.js');   // 现役永远在第一位
  console.log('# 抽样：文件名 ' + all.length + ' 个 ⇒ **按内容去重后 ' + uniq.length + ' 个等价类**（同名异实/同实异名 ' + dupNames +
    ' 个）· 本表等距抽 ' + (packs.length - 1) + ' 个 ⇒ 覆盖率 ' + (100 * (packs.length - 1) / Math.max(1, uniq.length)).toFixed(1) +
    '%（**不是**总体估计，见 METHODOLOGY 62）');
}

const pct = function (a, b) { return (b > 0 ? (100 * a / b).toFixed(1) : 'n/a') + '%'; };

function landingProfile(file) {
  const b = build({ on: true, pack: file, temp: PRODUCT.temp, eps: PRODUCT.eps, epsK: PRODUCT.epsK, epsMode: PRODUCT.epsMode });
  /* 自检：**只**判 `evo.js` 那条路（替换数 = 源码现算数）。
   * ⚠️ 不判"经包装调用 > 0"：那条路是给 `audit-lib` 的函数（seatSymmetry 等）用的，
   * 而本探针只调 `mirrorHealth`（在 evo.js 里 ⇒ 走"改装载源码"那条）⇒ 包装层本来就**该**是 0。
   * （v1.5.227 第一版照抄了 probe-ideal-champion 的那条自检，于是每一粒都被判"搬运没生效"。） */
  if (b.patched !== b.hardwired) return { error: '口径搬运没生效（evo 替换 ' + b.patched + '/' + b.hardwired + '）' };
  const sb = b.sb, P = sb.EpirusPolicy;
  const params = P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
  if (!params) return { error: '读不出包' };
  const mh = sb.EpirusTrainer.mirrorHealth(params, GAMES, 5, 'multi');
  const R = sb.EpirusRules;
  /* 归属一律走 `audit-lib.landShareOf`（单一来源）——
   * ⚠️ 别自己写 `max(landByKey)/landedTotal`：`landByKey` 含**非卡键**（"终局收缩"…）而 landedTotal 是过滤后的，
   *    我第一版就这么算出过 **44900%**（`v7teach-32`）。 */
  const ls = landShareOf(sb, mh);
  const by = mh.landByKey || {};
  const keys = Object.keys(by).filter(function (k) { return R.byKey[k]; })
    .sort(function (a, c) { return by[c] - by[a]; });
  const tot = mh.landedTotal || 0;
  const shares = keys.map(function (k) { return [k, tot ? by[k] / tot : 0]; });
  return { mh: mh, tot: tot, shares: shares, maxShare: ls.share, maxKey: ls.key,
    landedKeys: mh.landedKeys, effSkillsLand: mh.effSkillsLand, drawRate: mh.drawRate, filtered: mh.landedFiltered };
}

function costlyProfile(file) {
  const r = spawnSync(process.execPath, ['tools/probe-ep-reach.mjs', '--json', '--games=' + RGAMES, '--fields=pool', '--pack=' + file],
    { encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 24 });
  if (r.status !== 0) return { error: 'probe-ep-reach exit=' + r.status + ' ' + String(r.stderr || '').slice(0, 120) };
  /* JSON 抽取（v1.5.227 第三版）：该量具 `--json` 会印**不止一段** JSON（§A 的 fields 与 §B 的 sweep），
   * 所以"从后往前取第一段能 parse 的"会拿到 sweep 那段（里面没有 `costly`）⇒ 8/20 被误判成"量具版本不对"。
   * 做法：把**每一段**独立的 JSON 都试出来，取**含 `costly` 的那一段**。 */
  const s = String(r.stdout || '');
  let found = null;
  for (let i = 0; i < s.length && !found; i++) {
    if (s[i] !== '{') continue;
    for (let k = s.length - 1; k > i; k--) {
      if (s[k] !== '}') continue;
      let o = null;
      try { o = JSON.parse(s.slice(i, k + 1)); } catch (e) { continue; }
      const f = o && o.fields ? o.fields.find(function (x) { return x.field === 'pool'; })
        : (Array.isArray(o) && o[0] && o[0].field === 'pool' ? o[0] : null);
      const cy2 = (f && f.costly) || (o && o.costly);
      if (cy2) { found = { cy: cy2 }; break; }
      break;   // 这段 parse 成功但没 costly ⇒ 换下一个起点，别在它身上耗
    }
  }
  if (!found) return { error: 'JSON 里没有 costly 字段（量具版本不对？）' };
  const cy = found.cy;
  return { cy: cy, reach: cy.n ? cy.ok / cy.n : 0, take: cy.n ? cy.bought / cy.n : 0, takeWhenOk: cy.ok ? cy.bought / cy.ok : 0 };
}

console.log('=== 新 G 三轴（产品口径 ε=0.2/top5/soft） · 每场 ' + GAMES + ' 局镜像 · 高价层用 ' + RGAMES + ' 局 pool ===');
console.log('    塌缩线 = 单卡落地份额 > ' + (COLLAPSE_LINE * 100) + '% · 宽度线 = 打上血的卡 ≥ ' + WIDTH_LINE + ' 种\n');
console.log('包'.padEnd(34) + '落地种  最大单卡     份额    高价层可达  可达时成交  ①塌缩 ②宽度 ③高价层');
const rows = [];
for (const p of packs) {
  const L = landingProfile(p), C = costlyProfile(p);
  const name = p.replace(/^.*[\\/]/, '').replace(/\.bak$/, '');
  if (L.error || C.error) { console.log(name.padEnd(34) + '✗ ' + (L.error || C.error)); continue; }
  const v1 = L.maxShare > COLLAPSE_LINE ? '✗塌缩' : 'ok';
  const v2 = L.landedKeys >= WIDTH_LINE ? 'ok' : '✗窄';
  const v3 = (C.cy.ok === 0) ? '✗不可达' : (C.cy.bought === 0 ? '✗可达不选' : 'ok');
  console.log(name.padEnd(34) + String(L.landedKeys).padStart(5) + '  ' + String(L.maxKey).padEnd(11) +
    (L.maxShare * 100).toFixed(1).padStart(5) + '%  ' + pct(C.cy.ok, C.cy.n).padStart(9) + '  ' +
    pct(C.cy.bought, Math.max(1, C.cy.ok)).padStart(9) + '   ' + v1.padEnd(6) + v2.padEnd(6) + v3);
  rows.push({ name: name, landedKeys: L.landedKeys, maxShare: L.maxShare, maxKey: L.maxKey, reach: C.reach, take: C.take, cy: C.cy });
}

/* ===== 判别力自评（**这一段才是本量具存在的理由**）=====
 * 一个判据有用 ⇒ 它在样本上必须**有散布**、且散布方向与"这包好不好"一致。
 * 全样本都落在同一侧（例如所有包 maxShare 都 >0.9）⇒ 它没有判别力，不该立成门。 */
if (rows.length >= 3) {
  const f = function (x) { return (100 * x).toFixed(1) + '%'; };
  const q = function (arr, p) { const s = arr.slice().sort(function (a, b) { return a - b; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const ms = rows.map(function (r) { return r.maxShare; });
  const rn = rows.map(function (r) { return r.cy.ok / Math.max(1, r.cy.n); });
  const tk = rows.map(function (r) { return r.cy.bought / Math.max(1, r.cy.n); });
  console.log('\n=== 判别力自评（n=' + rows.length + ' 粒）===');
  console.log('  最大单卡份额   min ' + f(Math.min.apply(null, ms)) + ' · 中位 ' + f(q(ms, 0.5)) + ' · max ' + f(Math.max.apply(null, ms)) +
    '  ⇒ 超过塌缩线(' + (COLLAPSE_LINE * 100) + '%)的：' + ms.filter(function (x) { return x > COLLAPSE_LINE; }).length + '/' + rows.length);
  console.log('  高价层可达率   min ' + f(Math.min.apply(null, rn)) + ' · 中位 ' + f(q(rn, 0.5)) + ' · max ' + f(Math.max.apply(null, rn)) +
    '  ⇒ 可达率为 0 的：' + rn.filter(function (x) { return x === 0; }).length + '/' + rows.length);
  console.log('  高价层成交率   min ' + f(Math.min.apply(null, tk)) + ' · 中位 ' + f(q(tk, 0.5)) + ' · max ' + f(Math.max.apply(null, tk)));
  console.log('  落地种数       min ' + Math.min.apply(null, rows.map(function (r) { return r.landedKeys; })) +
    ' · 中位 ' + q(rows.map(function (r) { return r.landedKeys; }), 0.5) +
    ' · max ' + Math.max.apply(null, rows.map(function (r) { return r.landedKeys; })));
}
