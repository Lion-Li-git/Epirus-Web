/* smoke-8p.mjs — 8 人局引擎健康冒烟（用户命题：v7 不支持 5 人以上，最终换新包 ⇒ 量 8P 现状）
 * 量四格：① 纯脚本 N=3/5/8 的墙钟与回合数；② 代 3 包在 8P 的行为与稳定性；③ v7 冠军在 8P 是崩还是瞎；④ 混代桌。 */
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
function readPack2(path) {
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
const CHAMP = readPack2("js/bundled-champion-3p.js");   /* 先读 v7（readPack2 装 arch2 后 v7 就读不出了） */
const S13 = readPack2("scratch/ga-arms/GA2R-sword-s13.js");
const G4 = readPack2("scratch/ga-arms/GATE4b-s13.js");

function timedGames(label, choosers, N, games, seed0) {
  const t0 = Date.now();
  let rounds = 0, wins = 0, draws = 0, err = null;
  for (let g = 0; g < games; g++) {
    try {
      const rm = T.oneGameN(choosers, seed0 + g, N, { regen: 0, mode: "multi" });
      rounds += rm.state.round;
      if (rm.state.winner === 0) wins++;
      if (rm.state.winner == null || rm.state.winner === "draw") draws++;
    } catch (e) { err = e.message; break; }
  }
  const ms = Date.now() - t0;
  console.log(label + " ‖ " + games + " 局 " + ms + "ms（" + (ms / games).toFixed(0) + "ms/局）" +
    " ‖ 局长=" + (rounds / games).toFixed(1) + (err ? " ‖ ⛔ " + err : " ‖ 首席胜率=" + (100 * wins / games).toFixed(0) + "% 平局=" + draws));
}
const scripts7 = [B.pickRandom, B.pickAggro, B.pickDefend, B.pickWall, B.pickFarmer, B.pickMix, B.pickGunSpam];
const scripts4 = [B.pickRandom, B.pickAggro, B.pickDefend, B.pickWall];
const scripts1 = [B.pickRandom, B.pickAggro];

console.log("== ① 纯脚本基线（引擎规则层） ==");
timedGames("N=3", [B.pickRandom, B.pickRandom, B.pickRandom], 3, 10, 80001);
timedGames("N=5", scripts4.concat([B.pickRandom]), 5, 10, 80001);
timedGames("N=8", scripts7.concat([B.pickRandom]), 8, 10, 80001);

console.log("== ② 代 3 包 @8P（1 席包 + 7 脚本） ==");
timedGames("GA2R-s13@8P", [T.policyChooserN(S13, 0.15)].concat(scripts7), 8, 10, 81001);
timedGames("GATE4b-s13@8P", [T.policyChooserN(G4, 0.15)].concat(scripts7), 8, 10, 81001);
timedGames("GA2R-s13@5P(参照)", [T.policyChooserN(S13, 0.15)].concat(scripts4, [B.pickRandom]), 5, 10, 81001);

console.log("== ③ v7 冠军 @8P（预期：瞎/不支持，看崩不崩） ==");
timedGames("champ(v7)@8P", [T.policyChooserN(CHAMP, 0.15)].concat(scripts7), 8, 5, 82001);
timedGames("champ(v7)@5P(参照)", [T.policyChooserN(CHAMP, 0.15)].concat(scripts4, [B.pickRandom]), 5, 5, 82001);

console.log("== ④ 混代桌 @8P（2 席代 3 + 6 脚本；v7 无 8P 能力不勉强） ==");
timedGames("s13+G4@8P", [T.policyChooserN(S13, 0.15), T.policyChooserN(G4, 0.15)].concat(scripts7.slice(0, 6)), 8, 10, 83001);
