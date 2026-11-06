/* DS 2P 单挑矩阵的独立复跑（scratch，不新尺）：用 arena2 的固定打法构造 + 同 oneGameN 协议，
 * 只验关键几对（drain vs bigT/gun/reflect/guard/snipe；bigT vs guard/proto/snipe/transfer）。
 * DS 表：drain vs bigT 0/100；vs gun/sword/tank/railgun 100/0；vs snipe 65/35；vs reflect/guard 100% 和。
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy;
const ref = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
if (typeof T.setBigTPush === 'function') T.setBigTPush(12);
const A = createArena2(W, { refParams: ref, temp: 0.15 });
const G = Number((process.argv.find((x) => x.startsWith('--games=')) || '--games=40').slice(8)) || 40;
function duel(aKey, bKey) {
  const sa = A.fixed(aKey), sb = A.fixed(bKey);
  let aw = 0, bw = 0, dr = 0, bad = 0;
  for (let i = 0; i < G; i++) {
    const aSeat = i % 2;                       /* 换边公平：偶数局 a 坐 0，奇数局 a 坐 1 */
    const seed = 3000000 + i * 7919 + aKey.length * 31 + bKey.length * 17;
    const ch = aSeat === 0 ? [sa, sb] : [sb, sa];
    const rm = T.oneGameN(ch, seed, 2, { regen: 0, mode: 'multi' });
    if (rm.winner === 'draw') dr++;
    else if (rm.winner === aSeat) aw++;
    else if (rm.winner === 1 - aSeat) bw++;
    else bad++;
  }
  return { a: aKey, b: bKey, aw: 100 * aw / G, bw: 100 * bw / G, dr: 100 * dr / G, bad };
}
const PAIRS = [['drain', 'bigT'], ['drain', 'gun'], ['drain', 'sword'], ['drain', 'tank'], ['drain', 'snipe'], ['drain', 'reflect'], ['drain', 'guard'], ['bigT', 'guard'], ['bigT', 'proto'], ['bigT', 'snipe'], ['bigT', 'transfer']];
console.log('# DS 2P 单挑复跑 ‖ ' + G + ' 局/对（换边各半）‖ multi/hp3');
for (const [a, b] of PAIRS) {
  const r = duel(a, b);
  console.log(r.a.padEnd(10) + ' vs ' + r.b.padEnd(10) + ' ‖ a胜 ' + r.aw.toFixed(0) + '% ‖ b胜 ' + r.bw.toFixed(0) + '% ‖ 平 ' + r.dr.toFixed(0) + '%' + (r.bad ? ' ‖ ⚠ bad ' + r.bad : ''));
}
process.exit(0);
