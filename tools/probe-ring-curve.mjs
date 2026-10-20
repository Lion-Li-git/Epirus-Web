/* probe-ring-curve.mjs —— 「聚能环连开几手才回本」的**实测**曲线（DS 10-20）
 *
 * 解析曲线（`docs/research/FINDING-2026-10-20-ring-payoff-ds.md`）：首手 3 ep 成本、之后免费；
 *   收益 g = min(streak,3) ⇒ 净 −2 / +2 / +3 / +3… ⇒ **回本在第 2 手末、赚钱在第 3 手起**。
 * 这里做**实测**：一旦这枚包自己决定开环（`ringStreak===0` 且选了环），强制它**连开 K 手**（K=1 即原样），
 *   看 K 变大时胜率怎么走。干预只在 chooser 外层，**不碰 js/core、不碰训练**。
 *
 * 用法：node tools/probe-ring-curve.mjs --champion=<a>,<b> [--games=200] [--gamemode=long] [--ks=1,2,3,4]
 */
import { sandbox, loadChamp, mulberry32, rejectUnknownFlags } from './audit-lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['champion', 'games', 'gamemode', 'ks'], 'probe-ring-curve');
const flag = (n, d) => { for (let i = 0; i < argv.length; i++) { if (argv[i] === '--' + n) return argv[i + 1]; const p = '--' + n + '='; if (argv[i].startsWith(p)) return argv[i].slice(p.length); } return d; };
const CHAMPS = String(flag('champion', 'js/bundled-champion-3p.js')).split(',').filter(Boolean);
const GAMES = Number(flag('games', 200));
const GAMEMODE = flag('gamemode', 'long');
const KS = String(flag('ks', '1,2,3,4')).split(',').map(Number);
const W = sandbox(ROOT);
const T = W.EpirusTrainer, Play = W.EpirusPlay, S = W.EpirusState, B = W.EpirusBots, R = W.EpirusRules;
const SCRIPTS = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
const RING = R.SK.RING;
function run(packPath, K, seedBase) {
  let params; try { params = loadChamp(W, join(ROOT, packPath)); } catch (e) { return null; }
  if (!params) return null;
  let wins = 0, started = 0, forced = 0;
  for (let g = 0; g < GAMES; g++) {
    const seat = g % 5;
    const st = S.createState(GAMEMODE, { next: mulberry32(seedBase + g * 997) }, 5);
    st.slotSalt = (seedBase + g * 2246822519) >>> 0;
    const chooser = T.policyChooserN(params, 0.15, 0, 5, GAMEMODE);
    let forceLeft = 0;
    const wrapped = function (state, pid, legal) {
      const pick = chooser(state, pid, legal);
      if (pid === seat) {
        if (forceLeft > 0) {
          const r = legal.find(function (l) { return l.key === RING && l.affordable; });
          if (r) { forceLeft--; forced++; return { key: RING, target: null, target2: null }; }
          forceLeft = 0;
        } else if (pick && pick.key === RING && K > 1) { started++; forceLeft = K - 1; }
      }
      return pick;
    };
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(i === seat ? wrapped : T.wrapBotN(SCRIPTS[(i + g) % SCRIPTS.length]));
    Play.autoGameN(st, cs);
    if (st.winner != null && st.winner === seat) wins++;
  }
  return { win: 100 * wins / GAMES, started: started, forced: forced };
}
console.log('pack\tK=1\tK=2\tK=3\tK=4');
for (const p of CHAMPS) {
  const out = [];
  for (const K of KS) { const r = run(p, K, 20261020); out.push(r ? r.win.toFixed(1) + '%' : '—'); }
  console.log(p.split('/').pop().replace(/\.(bak|js)$/, '') + '\t' + out.join('\t'));
}