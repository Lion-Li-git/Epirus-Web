/* behavior-batch.mjs — 一批包的行为读数（DS · 2026-10-30）
 * 每包 10 局 5P（arena2 v2 分层场、同一对手轮换），读：干净胜/夺1、非ジ单卡、防御占比、攻击占比、
 * 目标死磕（最长连打同一个人）、ジ⇄攻击交替率、挑衅违约次数。
 * 目的：把"这些冠军具体怎么打"从"逐局记录 + 眼睛"变成一列可比的数（记录仍在 results/ 下）。
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from 'file:///D:/code/Epirus-Web/tools/audit-lib.mjs';
import { install as installArch2, readPack2, packInstallCfg, packCfgExit } from 'file:///D:/code/Epirus-Web/tools/proto2/arch2.mjs';
import { createArena2 } from 'file:///D:/code/Epirus-Web/tools/proto2/arena2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const ref = loadChamp(W, 'js/bundled-champion-3p.js');
const A = createArena2(W, { refParams: Float64Array.from(ref), temp: 0.15, stratified: true, stratCap: '2', stratMix: '0.5' });
const N = 5, MODE = "multi", TEMP = 0.15;
const shapeIdx = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const SALT = 101;

function balancedJson(s, at) {
  const i = s.indexOf("{", at); if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const ch = s[k];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === "\"") inStr = false; continue; }
    if (ch === "\"") { inStr = true; continue; }
    if (ch === "{") depth++; else if (ch === "}") { depth--; if (depth === 0) return s.slice(i, k + 1); }
  }
  return null;
}
function loadPack(path) {
  /* ⚠️ installArch2 会把 P.unpack 挂钩到 2.0 容器 ⇒ 装过之后再 loadChamp(v7) 会返回 null。
   *   所以 v7 参照包直接用启动时读好的 ref；其它 v7 包本脚本不支持（scratch 诊断用）。 */
  if (/bundled-champion-3p\.js$/.test(path)) return { params: ref, is2: false };
  const v7 = loadChamp(W, path);
  if (v7 && v7.length) return { params: v7, is2: false };
  /* 代 2（v:91）：走唯一出口 readPack2 → packCfgExit → packInstallCfg（代 1 的包会被拒，这是故意的）。 */
  const raw = readPack2(path);
  packCfgExit(raw, path);
  installArch2(W, packInstallCfg(raw));
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return { params: Float64Array.from(P.unpack(raw, true)), is2: true };
}

const FOCUS = 0;
function play(packPath, g) {
  const { params } = loadPack(packPath);
  const pk = T.policyChooserN(params, TEMP);
  const choosers = [pk];
  for (let pid = 1; pid < N; pid++) {
    const gameSeq = 90000 + g;
    let ri = (gameSeq * 7 + pid * 11 + shapeIdx * 13 + SALT) % A.roster.length;
    let e = A.roster[ri];
    while (e.kind === "random") { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    choosers.push(e.sel);
  }
  return T.oneGameN(choosers, 900 + g, N, { regen: 0, mode: MODE });
}

function stats(packPath, games) {
  const acc = { n: 0, win: 0, clean: 0, rounds: 0, cat: {}, def: 0, atk: 0, acts: 0, tauntFail: 0, maxRun: 0, same: 0, pairs: 0, jiGun: 0 };
  const ATK = new Set(["gun", "sword", "snipe", "tank", "railgun", "bigT", "miniT", "drain", "curse", "firestorm", "transfer", "dualGun", "cannon", "laserEye", "mine"]);
  const DEF = new Set(["guard", "reflect", "bagua", "shift", "jinshield", "proto", "armor", "holo"]);
  for (let g = 0; g < games; g++) {
    const rm = play(packPath, g);
    const st = rm.state, evs = st.events || [];
    const keys = evs.filter((e) => e && e.type === "action" && e.pid === FOCUS && e.outcome === "ok").map((e) => e.key);
    acc.acts += keys.length;
    for (const k of keys) { acc.cat[k] = (acc.cat[k] || 0) + 1; if (DEF.has(k)) acc.def++; if (ATK.has(k)) acc.atk++; }
    for (let i = 1; i < keys.length; i++) { acc.pairs++; if ((keys[i] === "ji") !== (keys[i - 1] === "ji")) acc.jiGun++; }
    const tg = evs.filter((e) => e && e.source === FOCUS && (e.type === "damage" || e.type === "blocked" || e.type === "reflect")).map((e) => e.to);
    if (tg.length) { let run = 1; for (let i = 1; i < tg.length; i++) { if (tg[i] === tg[i - 1]) { run++; acc.same++; } else run = 1; acc.maxRun = Math.max(acc.maxRun, run); } acc.maxRun = Math.max(acc.maxRun, 1); }
    acc.tauntFail += evs.filter((e) => e && e.type === "damage" && e.to === FOCUS && e.reason && String(e.reason).indexOf("挑衅") >= 0).length;
    acc.n++; if (rm.winner === FOCUS) acc.win++; if (rm.winner === FOCUS && st.p[FOCUS].hp > 0) acc.clean++;
    acc.rounds += st.round;
  }
  let top = null;
  for (const k in acc.cat) if (k !== "ji" && (!top || acc.cat[k] > acc.cat[top])) top = k;
  const nonji = Object.keys(acc.cat).reduce((s, k) => s + (k === "ji" ? 0 : acc.cat[k]), 0);
  return {
    games: acc.n, cleanWin: acc.clean / acc.n, win: acc.win / acc.n, rounds: acc.rounds / acc.n, acts: acc.acts / acc.n,
    topKey: top, topShare: top ? acc.cat[top] / Math.max(1, nonji) : 0,
    defShare: acc.acts ? acc.def / acc.acts : 0, atkShare: acc.acts ? acc.atk / acc.acts : 0,
    alt: acc.pairs ? acc.jiGun / acc.pairs : 0, sameRate: acc.acts ? acc.same / Math.max(1, acc.acts) : 0, maxRun: acc.maxRun,
    tauntFail: acc.tauntFail,
  };
}

const PACKS = process.argv.slice(2);
console.log('pack | 干净胜 | 夺1 | 局 | 出手/局 | 非ジ单卡 | 防御占比 | 攻击占比 | ジ⇄攻击交替 | 最长连打 | 挑衅违约');
for (const p of PACKS) {
  try {
    const s = stats(p, 10);
    console.log(p.replace(/^.*[\\/]/, '') + ' | ' + (100 * s.cleanWin).toFixed(0) + '% | ' + (100 * s.win).toFixed(0) + '% | ' + s.games + ' | ' + s.acts.toFixed(1) + ' | ' + (s.topKey || '-') + ' ' + (100 * s.topShare).toFixed(0) + '% | ' + (100 * s.defShare).toFixed(0) + '% | ' + (100 * s.atkShare).toFixed(0) + '% | ' + (100 * s.alt).toFixed(0) + '% | ' + s.maxRun + ' | ' + s.tauntFail);
  } catch (e) { console.log(p + " | ERR " + String(e.message).slice(0, 60)); }
}