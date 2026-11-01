/* probe-obs3b-seats.mjs — 修正 11-01 凌晨的探针错位：上一版量的是 P.oppSlots（v7 面），
 * 本版直接走 gen-3 的真路径 obs3Scene（obs3.mjs scene()）+ arch2 forwardObs3，量观测集合在 2/3/5/8P 的实取席数。
 * 预期：scene 流式取全部存活席（无 5 席闸），8P = 自己 + 7 对手全进池子。 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { scene as obs3Scene } from '../tools/proto2/obs3.mjs';
import { readFileSync } from 'node:fs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
function balancedJson(s, at) {
  const i = s.indexOf("{", at); if (i < 0) return null;
  let d = 0, inS = false, esc = false;
  for (let k = i; k < s.length; k++) { const c = s[k];
    if (inS) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === "\"") inS = false; continue; }
    if (c === "\"") { inS = true; continue; }
    if (c === "{") d++; else if (c === "}") { d--; if (!d) return s.slice(i, k + 1); } }
  return null;
}
const src = readFileSync('scratch/ga-arms/GA2R-sword-s13.js', 'utf8');
const raw = JSON.parse(balancedJson(src, src.indexOf('EPIRUS_CHAMPION_3P ')));
const got = packCfgExit(raw, 'probe');
installArch2(W, got.cfg);
if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
const params = Float64Array.from(P.unpack(raw, true));
const Play = W.EpirusPlay;   /* legalActions 挂在 EpirusPlay（play.js），selftest2 同款取法 */

console.log('== ① obs3Scene 实取席（真路径，无 v7 帽子） ==');
for (const N of [2, 3, 5, 8]) {
  const st = W.EpirusState.createState('multi', { next: () => 0.5 }, N);
  const sc = obs3Scene(W, st, 0, 'obs3b');
  const opps = sc.seats.filter((s) => !s.isSelf).length;
  console.log(N + 'P：scene 席数=' + sc.seats.length + '（自己 1 + 对手 ' + opps + '）‖ alive=' + st.p.length +
    ' ‖ g 人数维=' + sc.g[0].toFixed(2) + '（/NMAX10）');
}

console.log('== ② 8P 真前向（forwardObs3 全链路稳定 + 候选打分 sane） ==');
const st8 = W.EpirusState.createState('multi', { next: () => 0.5 }, 8);
const legal = Play.legalActions(st8, 0);
const cands = P.candidatesFor(st8, 0, T.econBase ? T.econBase(st8, 0, legal) : legal, { lockTarget: false });
const fw = P.__arch2.forwardCands(st8, 0, cands, params, {});
console.log('8P 前向：候选=' + cands.length + ' ‖ argmax=' + (fw.cand ? fw.cand.key : '?') +
  ' ‖ maxProb=' + Math.max(...fw.probs).toFixed(3) + ' ‖ 池子=对手 ' + (obs3Scene(W, st8, 0, 'obs3b').seats.length - 1) + ' 席全进 mean/max');

console.log('== ③ 8P 打完一整局（训练桌形状预演，干预全关口径） ==');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);
console.log('干预档回读：bigT=' + T.bigTPushOn() + ' drain=' + T.drainPushOn() + ' curse=' + T.cursePushOn() + ' support=' + T.supportPriorOn());
const scripts7 = [W.EpirusBots.pickRandom, W.EpirusBots.pickAggro, W.EpirusBots.pickDefend, W.EpirusBots.pickWall, W.EpirusBots.pickFarmer, W.EpirusBots.pickMix, W.EpirusBots.pickGunSpam];
const rm = T.oneGameN([T.policyChooserN(params, 0.15)].concat(scripts7), 91001, 8, { regen: 0, mode: 'multi' });
console.log('8P 一局：rounds=' + rm.state.round + ' winner=' + rm.state.winner + '（包席=0，存活到 ' + (rm.state.p[0].hp > 0 ? '终局' : '中途') + '）');
