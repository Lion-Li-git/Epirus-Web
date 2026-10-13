/* price-ladder.mjs —— 按**珠价**分桶数出手（10-13 早班 · 给"1 珠防御整类都不出"那条归因做对照）
 *
 * 为什么要这一台：`docs/research/CARD-VALUE-2026-10-13.md` §5-c 说"要花钱的防御整类都不出"，
 *   但这句话有两种读法，只有把**所有卡按 cost 分桶**才分得开：
 *     读法 A（归因于价）：AI 根本不在 1 珠这一档买东西 ⇒ 防御只是顺带躺枪；
 *     读法 B（归因于类）：AI 照样把珠花在攻击/特殊上，**只有 1 珠的防御**不出 ⇒ "宁可用免费的半防御，也不花珠买全防御"。
 *   两者的修法完全不同（A 是"珠的经济没进目标"，B 是"防御的回报在混战里不值一颗珠"）。
 *
 * 口径：与 `usage-probe` / 训练侧 `mirrorHealth` 同一套装配（5 席全是被测包自己 · `Play.autoGameN`），
 *   出手只认 `type==='action' && outcome==='ok'` 的事件；`cost`/`cat` 一律从 `EpirusRules.byKey` **现取**，不硬编码卡名单。
 *   报告里 ① 每局的 cost 分桶，② 同 cost 档里 defense 与非 defense 的比（**这一列才是 A/B 的判决位**）。
 *
 * 自检（`--self-test`，三格都是"必然移动分布"的强制 chooser，钉的是分桶接对了字段）：
 *   ① 必选**最便宜**的买得起卡 ⇒ cost=0 那一桶必须占绝对多数；
 *   ② 必选**最贵**的买得起卡 ⇒ 最高价桶必须 >10%，且 **cost=0 的占比必须比①低 10pt 以上**
 *      （用相对比较而不是"接近 0"：买不起高价位时兜底按 ジ 是真的，绝对阈值会把正常行为判成坏）；
 *   ③ 只在**买得起的防御**里挑最便宜 ⇒ defense 合计必须 >0 且落进 cost=0 那一桶（①②管不到 `cat` 有没有接错）。
 *   第一版栽过一次：`legal` 每项只有 `{key, affordable, loan, free}`、**没有 cost** ⇒ 强制 chooser 退化成"第一个买得起的"，
 *   两格读数全是 cost=0 的 ジ（看着像"AI 只按免费牌"）。修法：价从 `EpirusRules.byKey[key].cost` 现取。
 *
 * 用法：node docs/debug/price-ladder.mjs [--ids=T8-s114,K2 | --paths=f.js] [--games=40] [--eps=0] [--mode=multi]
 *       node docs/debug/price-ladder.mjs --self-test
 * 退出码：0 ‖ 2 = 名单空 / 装载失败 / 自检不过
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, rejectUnknownFlags } from '../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['ids', 'paths', 'games', 'eps', 'mode', 'seed', 'self-test'], 'price-ladder');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 40)) || 40;
const EPS = Number(arg('eps', 0));
const MODE = arg('mode', 'multi');

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
const SK = R.SK;
const BY = R.byKey || {};
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SEED = Number(process.env.EPIRUS_SEED || 20261013);

const COSTS = [...new Set(Object.keys(BY).map(k => BY[k].cost))].sort((a, b) => a - b);
const isDef = (k) => { const d = BY[k]; return !!d && d.cat === 'defense'; };

/* 跑一批局，返回 {games, byCost:{c:{all,def}}, def1:{key:手数}, topCost} */
function run(choose, G) {
  const o = { games: 0, byCost: {}, def1: {}, maxCostSeen: 0 };
  COSTS.forEach(c => { o.byCost[c] = { all: 0, def: 0 }; });
  for (let g = 0; g < G; g++) {
    const st = S.createState(MODE, { next: mulberry32(SEED + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const ch = []; for (let i = 0; i < 5; i++) ch.push(choose);
    Play.autoGameN(st, ch);
    o.games++;
    for (const e of st.events) {
      if (!e || e.type !== 'action' || e.outcome !== 'ok') continue;
      const d = BY[e.key]; if (!d) continue;
      const c = d.cost;
      if (!o.byCost[c]) { o.byCost[c] = { all: 0, def: 0 }; }
      o.byCost[c].all++;
      if (d.cat === 'defense') { o.byCost[c].def++; if (c === 1) o.def1[e.key] = (o.def1[e.key] || 0) + 1; }
      if (c > o.maxCostSeen) o.maxCostSeen = c;
    }
  }
  return o;
}
const total = (o, c) => o.byCost[c] ? o.byCost[c].all : 0;
const acts = (o) => Object.keys(o.byCost).reduce((s, c) => s + o.byCost[c].all, 0);

if (process.argv.includes('--self-test')) {
  /* ⚠ 引擎给的 `legal` 每项只有 `{key, affordable, loan, free}` —— **没有 cost**（10-13 实测打出来的：
   *   第一版写 `l.cost` 比大小时两格强制 chooser 都退化成"第一个买得起的"，读数全是 cost=0 那一桶 = ジ）。
   *   ⇒ 价一律从 `EpirusRules.byKey[key].cost` 现取，与下面统计用的是同一个源。 */
  const costOf = (l) => { const d = BY[l.key]; return d ? d.cost : 1e9; };
  const cheap = function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable); if (!aff.length) return SK.JI;
    let m = aff[0]; for (const l of aff) if (costOf(l) < costOf(m)) m = l; return m.key;
  };
  const pricey = function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable); if (!aff.length) return SK.JI;
    let m = aff[0]; for (const l of aff) if (costOf(l) > costOf(m)) m = l; return m.key;
  };
  /* 第三格专钉 **cat 归类**：只在"买得起的防御"里挑最便宜的一张 ⇒ 0 珠那三张必须落进 cost=0 的 defense 桶。
   *   （前两条只管"价"这条轴有没有接错，管不到 cat 有没有接错。） */
  const cheapDef = function (state, pid, legal) {
    const aff = legal.filter(l => l.affordable && isDef(l.key)); if (!aff.length) return SK.JI;
    let m = aff[0]; for (const l of aff) if (costOf(l) < costOf(m)) m = l; return m.key;
  };
  const a = run(cheap, 8), b = run(pricey, 8), d = run(cheapDef, 8);
  const zeroShare = (o) => (acts(o) ? total(o, 0) / acts(o) : 0);
  const defAll = (o) => Object.keys(o.byCost).reduce((s, c) => s + o.byCost[c].def, 0);
  let bad = [];
  if (!(acts(a) > 0 && acts(b) > 0 && acts(d) > 0)) bad.push('自检空转：三格有一格手数是 0（装配或事件字段接错）');
  if (!(zeroShare(a) > 0.5)) bad.push('自检①：必选最便宜之下 cost=0 只占 ' + (zeroShare(a) * 100).toFixed(1) + '%（应绝对多数）⇒ 分桶接错了 cost 字段');
  const hiC = String(b.maxCostSeen);
  if (!(total(b, b.maxCostSeen) / acts(b) > 0.1)) bad.push('自检②：必选最贵之下最高价(' + hiC + ')只占 ' +
    (total(b, b.maxCostSeen) / acts(b) * 100).toFixed(1) + '% ⇒ 价格排序反了或桶写错');
  /* 这条是**相对比较**（不是绝对阈值）：买不起高价位时兜底按 ジ 是真的，所以 cost=0 在"最贵"格里也会有量 ——
   *   但必须明显低于"最便宜"格，否则排序根本没作用到分布上。 */
  if (!(zeroShare(b) < zeroShare(a) - 0.1)) bad.push('自检②：必选最贵的 cost0 占比(' + (zeroShare(b) * 100).toFixed(1) +
    '%) 没有比必选最便宜(' + (zeroShare(a) * 100).toFixed(1) + '%)低 10pt 以上 ⇒ 价格这条轴没动分布，桶或排序是摆设');
  if (!(defAll(d) > 0)) bad.push('自检③：只挑防御的装配里 defense 合计 = 0 ⇒ `cat === \'defense\'` 归类接错（规则表里明明有 0 珠的防御/反弹/八卦阵）');
  if (!(d.byCost[0] && d.byCost[0].def > 0)) bad.push('自检③：defense 全都不在 cost=0 那桶 ⇒ 卡价表读错了（防御/反弹/八卦阵应当是 0 珠）');
  console.log('price-ladder 自检：①最便宜 cost0=' + (zeroShare(a) * 100).toFixed(1) + '% ‖ ②最贵 cost' + hiC + '=' +
    (total(b, b.maxCostSeen) / acts(b) * 100).toFixed(1) + '% · cost0=' + (zeroShare(b) * 100).toFixed(1) +
    '% ‖ ③只挑防御：defense 合计 ' + defAll(d) + ' 手，其中 cost0 ' + (d.byCost[0] ? d.byCost[0].def : 0) + ' 手');
  bad.forEach(x => console.error('  FAIL ' + x));
  process.exit(bad.length ? 2 : 0);
}

/* ---------- 名单（与 usage-probe 同一份 coords.tsv） ---------- */
const CO = readFileSync(join(ROOT, 'champion-map', 'coords.tsv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const h0 = Object.fromEntries(CO[0].split('\t').map((c, i) => [c, i]));
const rowsC = CO.slice(1).map(l => { const c = l.split('\t'); return { id: c[h0.id], path: c[h0.path] }; }).filter(e => e.id && e.path);
const IDS = String(arg('ids', 'T8-s114,K2,SHIPPED-Ldemo')).split(',').map(s => s.trim()).filter(Boolean);
const PATHS = String(arg('paths', '')).split(',').map(s => s.trim()).filter(Boolean);
let list = rowsC.filter(e => IDS.indexOf(e.id) >= 0);
if (PATHS.length) list = list.concat(PATHS.map(p => ({ id: p.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, ''), path: p })));
if (!list.length) { console.error('⛔ 名单是空的（--ids= / --paths=）'); process.exit(2); }

/* 卡表先印一遍（cost 与 cat 从规则现取）—— 免得读的人还要自己去数哪张卡几珠 */
const DEF1 = Object.keys(BY).filter(k => BY[k].cost === 1 && BY[k].cat === 'defense');
console.log('卡价表（`EpirusRules.byKey` 现取）：' + COSTS.map(c => {
  const ks = Object.keys(BY).filter(k => BY[k].cost === c);
  return c + ' 珠 ' + ks.length + ' 张[' + ks.filter(isDef).length + ' 防御]';
}).join(' ‖ '));
console.log('1 珠的防御是这 ' + DEF1.length + ' 张：' + DEF1.map(k => (BY[k].name || k) + '(' + k + ')').join(' ‖ '));
console.log('装配=' + MODE + ' · ε=' + EPS + ' · ' + GAMES + ' 局/枚（5 席镜像 · 出手只认 outcome===ok）\n');
console.log('包名'.padEnd(18) + COSTS.map(c => ('c' + c).padStart(7)).join('') + '   |  1 珠档：防御/全部');
let n = 0;
for (const e of list) {
  const p = isAbsolute(e.path) ? e.path : join(ROOT, e.path);
  if (!existsSync(p)) { console.error('  ⚠ ' + e.id + ' 文件不在 ⇒ 跳过'); continue; }
  let params; try { params = loadChamp(W, p, ROOT); } catch (x) { console.error('  ⚠ ' + e.id + ' 读包失败：' + String(x.message || x).split('\n')[0]); continue; }
  if (!params || !params.length) { console.error('  ⚠ ' + e.id + ' 读不出参数 ⇒ 跳过'); continue; }
  const o = run(T.policyChooserN(params, EPS), GAMES); n++;
  const A = acts(o);
  console.log(e.id.padEnd(18) + COSTS.map(c => (100 * total(o, c) / A).toFixed(1).padStart(7)).join('') +
    '   |  ' + (total(o, 1) ? (100 * o.byCost[1].def / total(o, 1)).toFixed(2) + '%' : '—') +
    '（' + o.byCost[1].def + '/' + total(o, 1) + ' 手）');
  /* 判决位：1 珠防御这一档**内部**是谁被买了。proto/shift 恒 0 而 armor/jinshield 有量 ⇒ 不是"整类不买"，是"这两张不买"。 */
  console.log('      ┖ 1 珠防御明细：' + DEF1.map(k => (BY[k].name || k) + ' ' + (o.def1[k] || 0)).join(' ‖ ') +
    '（各 0 起算，共 ' + o.byCost[1].def + ' 手）');
}
console.log('\n读法：左边每格是"该价卡占全部出手的 %"（分母=这一枚包这 ' + GAMES + ' 局里所有 ok 出手，含 5 席）。');
console.log('  要看的是**最后一列**：如果 1 珠这一档整体有量、而里面防御占 ≈0 ⇒ 病在"类"（防御不值那颗珠）；');
console.log('  如果 1 珠整档就是空的 ⇒ 病在"价"（AI 不在这档买东西），那 §5-c 那条归因要改写。');
if (!n) { console.error('⛔ 一枚都没装载成功'); process.exit(2); }
