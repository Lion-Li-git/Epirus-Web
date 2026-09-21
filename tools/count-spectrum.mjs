/* #22 人数谱：93(现役) / v7press3-91(前任) / 2P冠军(内置) 在 N=2/3/5 席的胜率 + 2P 正面对决 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = 'D:/code/Epirus-Web/';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/train/trainer.js',
  'js/bundled-champion-3p.js', 'js/bundled-champion.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const S = sb.window.EpirusState, Play = sb.window.EpirusPlay, T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots;
function load3p() { return P.unpack(sb.window.EPIRUS_CHAMPION_3P, true); }
function load2p() { return P.unpack(sb.window.EPIRUS_CHAMPION, true); }
function loadBak(f) {
  const s = readFileSync(REPO + f, 'utf8');
  const b = s.indexOf('{"v":');   // 包体从 {"v": 开始（meta 也在文件里，不能用首个 {）
  const e = s.indexOf('};', b);
  return P.loadAny(JSON.parse(s.slice(b, e + 1))).params;
}
const SCRIPTS = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
function fieldWin(params, N, mode, G, seed0) {
  const ch = T.policyChooserN(params, 0.15, 0); let w = 0;
  for (let g = 0; g < G; g++) {
    const seat = g % N;
    const st = S.createState(mode, { next: T.mulberry32(seed0 + g * 997) }, N);
    st.slotSalt = (seed0 + g * 2246822519) >>> 0;
    const cs = []; for (let i = 0; i < N; i++) cs.push(i === seat ? ch : SCRIPTS[(i + g) % SCRIPTS.length]);
    Play.autoGameN(st, cs); if (st.winner === seat) w++;
  }
  return (100 * w / G).toFixed(0);
}
/* 2P 标准对决：冠军席 vs 2P 冠军席（脚本对照线：只枪压制） */
function duel(pA, pB, G, seed0) {
  const a = T.policyChooserN(pA, 0.15, 0), b = T.policyChooserN(pB, 0.15, 0);
  let wa = 0, wb = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState('standard', { next: T.mulberry32(seed0 + g * 77) }, 2);
    const A0 = g % 2;
    const cs = []; for (let i = 0; i < 2; i++) cs.push(i === A0 ? a : b);
    Play.autoGameN(st, cs);
    if (st.winner === A0) wa++; else if (st.winner === 1 - A0) wb++;
  }
  return wa + '-' + wb;
}
const p93 = load3p(), pOld = loadBak('docs/artifacts/v7press3-91.bak'), p2p = load2p();
console.log('== 1冠军席 vs (N-1)脚本席 · 每点 60 局 · seat轮转 · mode按人数(multi/2人standard) ==');
for (const [nm, p] of [['v7n1-93(现役)', p93], ['v7press3-91(前任3P)', pOld], ['2P内置冠军', p2p]]) {
  console.log(nm.padEnd(18), 'N2:', fieldWin(p, 2, 'standard', 60, 4100), ' N3:', fieldWin(p, 3, 'multi', 60, 4100), ' N5:', fieldWin(p, 5, 'multi', 60, 4100));
}
console.log('== 2P 标准正面对决（93-旧2P，各120局）==');
console.log('93 vs 2P冠军:', duel(p93, p2p, 120, 880), '  93 vs 前任3P:', duel(p93, pOld, 120, 880));
