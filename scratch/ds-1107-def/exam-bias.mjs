
/* 考卷偏进攻吗？—— 2026-11-07 DS 复核
 * 口径：与 tools/promote-champion2p.mjs 同一套沙箱/播种/选择器（temp 0.15，种子 20260207 + i*977）。
 * 输出：① 20 个基准各自的出手形状（攻/防占比）⇒ 考卷的构成
 *       ② 每个候选包对「进攻族 / 混合族 / 防守族」的分组胜率 ⇒ 考卷的评分偏好
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { extractJsonObject, humanPrototypes } from '../../tools/audit-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots, R = W.EpirusRules;
const SEED = 1;
(function seedSandbox(sbox, seed) {
  const M = Object.create(Math); let s = seed >>> 0 || 1;
  M.random = function () { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  sbox.Math = M;
})(sb, SEED);
if (P.setRng && T.mulberry32) P.setRng(T.mulberry32(SEED * 7919 + 13));

/* 与 p2-baselines 同一张表（顺序 = 种子输入，不许改） */
const NAMES = ['random','aggro','defend','balanced','breakdef','wall','reflectspam','guardspam','baguaspam',
  'combocounter','mix','tankline','heavyfire','guardgun','protowall','whiff','reflectmix','reflecttank',
  'defreflectgun','beadburst'];
const FNAME = { random:'pickRandom', aggro:'pickAggro', defend:'pickDefend', balanced:'pickBalanced',
  breakdef:'pickBreakDef', wall:'pickWall', reflectspam:'pickReflectSpam', guardspam:'pickGuardSpam',
  baguaspam:'pickBaguaSpam', combocounter:'pickComboCounter', mix:'pickMix', tankline:'pickTankLine',
  heavyfire:'pickHeavyFire', guardgun:'pickGuardGun', protowall:'pickProtoWall', whiff:'pickWhiff',
  reflectmix:'pickReflectMix', reflecttank:'pickReflectTank', defreflectgun:'pickDefReflectGun',
  beadburst:'pickBeadBurst' };

const DEF_KEYS = new Set([R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.PROTO, R.SK.HOLO]);
function tallyOf(counts) {
  let atk = 0, def = 0, tot = 0;
  for (const [k, n] of Object.entries(counts)) {
    tot += n;
    if (k === R.SK.GUARD || k === R.SK.REFLECT || k === R.SK.BAGUA || k === R.SK.PROTO) def += n;
    else if (k !== R.SK.JI && k !== R.SK.CHARGE && k !== R.SK.RING) atk += n;
  }
  return { atk: tot ? atk / tot : 0, def: tot ? def / tot : 0, tot };
}

/* ---------- ① 基准的形状（拿「基准 vs 随机」的出手计数，400 局） ---------- */
function shapeOf(name) {
  const fn = B[FNAME[name]];
  const counts = {};
  const wrapped = function (st, pid, legal) {
    const k = fn(st, pid, legal);
    const key = (typeof k === 'string') ? k : (k && k.key);
    if (key) counts[key] = (counts[key] || 0) + 1;
    return k;
  };
  const rnd = B.pickRandom;
  const r = T.correctedWinRate(T.wrapBotN(wrapped), rnd, 400, 555000);
  const s = tallyOf(counts);
  return { name, wr: r.wr, atk: s.atk, def: s.def, n: s.tot };
}

const shapes = NAMES.map(shapeOf);
shapes.forEach(function (s) {
  console.log(s.name.padEnd(14) + ' 攻 ' + (s.atk * 100).toFixed(0).padStart(3) + '%  防 ' + (s.def * 100).toFixed(0).padStart(3) + '%  局均出手 ' + (s.n / 400).toFixed(1) + '  对随机胜 ' + (s.wr * 100).toFixed(1) + '%');
});

/* 分族：防 ≥ 30% ⇒ 防守族；攻 ≥ 55% 且 防 < 20% ⇒ 进攻族；其余混合族 */
const fam = {};
for (const s of shapes) fam[s.name] = (s.def >= 0.60 ? 'DEF' : (s.def >= 0.25 ? 'HALF' : 'OFF'));
const groups = { OFF: [], HALF: [], DEF: [] };
for (const s of shapes) groups[fam[s.name]].push(s.name);
for (const g of Object.keys(groups)) groups[g] = groups[g].filter(function (x) { return x !== 'random'; });  // 随机不是形状，单列
console.log('\n族（按防御出手占比）：OFF=' + groups.OFF.length + ' [' + groups.OFF.join(',') + ']');
console.log('    HALF=' + groups.HALF.length + ' [' + groups.HALF.join(',') + ']');
console.log('    DEF=' + groups.DEF.length + ' [' + groups.DEF.join(',') + ']');

/* ---------- ② 各候选包对三族的胜率 ---------- */
/* 平衡括号扫描（`_META` 是同前缀，任何前缀式 marker 都会先撞上它；这里要求 `= {`）。 */
function packJsonOf(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const b = src.indexOf('{', i + marker.length);
  if (b < 0) return null;
  let d = 0, inStr = false, esc = false;
  for (let k = b; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(b, k + 1); }
  }
  return null;
}
function loadPack(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const j = packJsonOf(src, 'window.EPIRUS_CHAMPION_3P =');
  if (!j) throw new Error('读不出 EPIRUS_CHAMPION_3P：' + file);
  return P.unpack(JSON.parse(j));
}
function champSel(params, counts) {
  return function (st, pid, legal) {
    const aff = legal.filter(function (l) { return l.affordable; });
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    const pick = T.pickChampion(st, pid, base, params, 0.15);
    if (pick && pick.key && counts) counts[pick.key] = (counts[pick.key] || 0) + 1;
    return pick;
  };
}

const ARMS = process.argv.slice(2);
if (!ARMS.length) ARMS.push('docs/artifacts/CTRL2-s13-band2.bak','docs/artifacts/DEF-s13-band2.bak','docs/artifacts/DEF-s15-band2.bak','docs/artifacts/DEF-s16-band2.bak');
const GAMES = Number(process.env.G || 40);
console.log('\n=== 各臂 × 三族（' + GAMES + ' 局/基准，换边公平化，temp 0.15）===');
console.log('arm'.padEnd(22) + 'OFF'.padStart(8) + 'HALF'.padStart(8) + 'DEF'.padStart(8) + 'ALL'.padStart(8) + '  防% / 攻%');
for (const file of ARMS) {
  let params;
  try { params = loadPack(file); } catch (e) { console.log(file + '  读失败：' + e.message); continue; }
  const counts = {};
  const sel = champSel(params, counts);
  const per = {};
  for (let i = 0; i < NAMES.length; i++) {
    const nm = NAMES[i];
    per[nm] = T.correctedWinRate(sel, T.wrapBotN(B[FNAME[nm]]), GAMES, 20260207 + i * 977).wr;
  }
  const mean = function (ks) { return ks.length ? ks.reduce(function (a, k) { return a + per[k]; }, 0) / ks.length : 0; };
  const s = tallyOf(counts);
  const label = file.split('/').pop().replace('.bak', '');
  console.log(label.padEnd(22) + (mean(groups.OFF) * 100).toFixed(1).padStart(7) + '%'
    + (mean(groups.HALF) * 100).toFixed(1).padStart(7) + '%' + (mean(groups.DEF) * 100).toFixed(1).padStart(7) + '%'
    + (mean(NAMES) * 100).toFixed(1).padStart(7) + '%'
    + '  ' + (s.def * 100).toFixed(0) + '% / ' + (s.atk * 100).toFixed(0) + '%');
}
/* ---------- ③ 同一批臂 × 「人类形状」原型（含墙）：考卷排名 vs 墙排名 ---------- */
const protos = humanPrototypes(B).filter(function (p) { return typeof p[1] === 'function'; });
const WALL = process.env.WALL_GAMES ? Number(process.env.WALL_GAMES) : 200;
console.log('\n=== 各臂 × 人类形状原型（' + WALL + ' 局/原型，换边公平化）===');
console.log('arm'.padEnd(22) + protos.map(function (p) { return p[0].slice(0, 6).padStart(8); }).join('') + '  原型均值');
const rows2 = [];
for (const file of ARMS) {
  let params;
  try { params = loadPack(file); } catch (e) { continue; }
  const sel = champSel(params, null);
  const vals = protos.map(function (p, i) { return T.correctedWinRate(sel, T.wrapBotN(p[1]), WALL, 770000 + i * 131).wr; });
  const m = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  rows2.push({ label: file.split('/').pop().replace('.bak', ''), vals: vals, mean: m });
  console.log(file.split('/').pop().replace('.bak', '').padEnd(22) + vals.map(function (v) { return (v * 100).toFixed(1).padStart(7) + '%'; }).join('') + '  ' + (m * 100).toFixed(1) + '%');
}
console.log('\n原型顺序：' + protos.map(function (p) { return p[0]; }).join(' ‖ '));
