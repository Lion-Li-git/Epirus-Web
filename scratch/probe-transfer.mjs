#!/usr/bin/env node
/* probe-transfer.mjs — GA-broad-s41 的转移伤害是否"有效"（11-01 · 用户命题）
 * 有效性定义：转移是"本回合所受可转移伤害转给目标"（resolve.js:468）⇒
 *   有效 = 出手的当回合真的有伤害被转走（有 `transfer` 事件）；空转 = 出了手但当回合没人打你（2ジ 白花）。
 * 对局面 = 转移的前置条件提供者（focusfire 集火/minespam 铺雷）各配一桌 × 60 局；
 *   同一探针顺带量 champion（它的分布里转移=0，当阴性对照）。
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { readFileSync } from 'node:fs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
function balancedJson(s, at) {
  const i = s.indexOf("{", at); if (i < 0) return null;
  let d = 0, inS = false, esc = false;
  for (let k = i; k < s.length; k++) { const c = s[k];
    if (inS) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === "\"") inS = false; continue; }
    if (c === "\"") { inS = true; continue; }
    if (c === "{") d++; else if (c === "}") { d--; if (!d) return s.slice(i, k + 1); } }
  return null;
}
function readPack(path) {
  const src = readFileSync(path, "utf8");
  const at = src.indexOf("EPIRUS_CHAMPION_3P ");
  const j = at >= 0 ? balancedJson(src, at) : null;
  const raw = j ? JSON.parse(j) : null;
  if (raw && raw.dims) {
    const got = packCfgExit(raw, path);
    installArch2(W, got.cfg);
    if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
    return Float64Array.from(P.unpack(raw, true));
  }
  return Float64Array.from(loadChamp(W, path));
}
const CHAMP = readPack("js/bundled-champion-3p.js");   /* 必须先读：readPack(2.0) 会把 unpack 换成 arch2 版，v7 包就再也读不出了 */
const S41 = readPack("scratch/ga-arms/GA-broad-s41.js");

const FACES = {};
for (const nm of Object.keys(B).filter((k) => k.startsWith('pick'))) {
  const f = B[nm];
  if (typeof f === 'function') FACES[nm.replace('pick', '')] = [f, f, f, f];
}
const GAMES = 20;
for (const [faceName, opps] of Object.entries(FACES)) {
  for (const [pkName, params] of [["s41", S41]]) {
    let casts = 0, redirects = 0, dmgSaved = 0, bigSaves = 0, dmgTakenNoRedirect = 0, rounds = 0, wins = 0, firstCastRound = [];
    for (let g = 0; g < GAMES; g++) {
      const choosers = [T.policyChooserN(params, 0.15)].concat(opps.map((f) => f));
      const rm = T.oneGameN(choosers, 71000 + g, 5, { regen: 0, mode: "multi" });
      const st = rm.state;
      rounds += st.round;
      if (st.winner === 0) wins++;
      const evs = st.events || [];
      let castThisGame = 0;
      for (const e of evs) {
        if (e && e.type === "action" && e.pid === 0 && e.key === R.SK.TRANSFER) { casts++; castThisGame++; }
        if (e && e.type === "transfer" && e.to === 0) { redirects++; dmgSaved += e.amt || 1; if ((e.amt || 1) >= 2) bigSaves++; }
        if (e && e.type === "damage" && e.to === 0 && e.via !== "shrink") dmgTakenNoRedirect += e.amt || 0;
      }
      if (castThisGame) {
        let r = 1; const seen = new Set();
        for (const e of evs) { if (e.type === "action") { if (seen.has(e.pid)) { r++; seen.clear(); } seen.add(e.pid); }
          if (e.type === "action" && e.pid === 0 && e.key === R.SK.TRANSFER) { firstCastRound.push(r); break; } }
      }
    }
    console.log("[" + faceName + "] " + pkName.padEnd(5) +
      " 转移出手=" + casts + "（" + (casts / GAMES).toFixed(2) + "/局）" +
      " ‖ 真转走=" + redirects + " 次（命中率 " + (casts ? (100 * redirects / casts).toFixed(0) : "0") + "%）" +
      " ‖ 挡下伤害=" + dmgSaved + "（" + (dmgSaved / GAMES).toFixed(2) + "/局，≥2伤大挡 " + bigSaves + "）" +
      " ‖ 自身承伤=" + (dmgTakenNoRedirect / GAMES).toFixed(2) + "/局" +
      " ‖ 胜率=" + (100 * wins / GAMES).toFixed(0) + "%" +
      " ‖ 局长=" + (rounds / GAMES).toFixed(1) +
      (firstCastRound.length ? " ‖ 首次转移回合中位=" + firstCastRound.sort((a, b) => a - b)[firstCastRound.length >> 1] : ""));
  }
}
