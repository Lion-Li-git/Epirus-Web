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
rejectUnknownFlags(argv, ['arm', 'champion', 'games', 'gamemode', 'ks'], 'probe-ring-curve');
const flag = (n, d) => { for (let i = 0; i < argv.length; i++) { if (argv[i] === '--' + n) return argv[i + 1]; const p = '--' + n + '='; if (argv[i].startsWith(p)) return argv[i].slice(p.length); } return d; };
const CHAMPS = String(flag('champion', 'js/bundled-champion-3p.js')).split(',').filter(Boolean);
const GAMES = Number(flag('games', 200));
const GAMEMODE = flag('gamemode', 'long');
const KS = String(flag('ks', '1,2,3,4')).split(',').map(Number);
/* arm=streak（默认）：连开 K 手环 ‖ arm=ji：开环之后连攒 K 手ジ（**对照臂**，回答"收益来自环还是来自多攒一手"）
 * arm=start：在"攒够 3 ep 且上一回合没挨打"时**主动开环**（回答"该不该主动起手"）。 */
const ARM = String(flag('arm', 'streak'));
const W = sandbox(ROOT);
const T = W.EpirusTrainer, Play = W.EpirusPlay, S = W.EpirusState, B = W.EpirusBots, R = W.EpirusRules;
const SCRIPTS = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
const RING = R.SK.RING, JIKEY = R.SK.JI;
function run(packPath, K, seedBase) {
  let params; try { params = loadChamp(W, join(ROOT, packPath)); } catch (e) { return null; }
  if (!params) return null;
  let wins = 0, started = 0, forced = 0;
  /* v1.7.123：环的**连击长度分布**（自然对局里它自己连几手）—— 回答"起手了为什么不多连"。 */
  let cur = 0; const runs = [];
  for (let g = 0; g < GAMES; g++) {
    const seat = g % 5;
    const st = S.createState(GAMEMODE, { next: mulberry32(seedBase + g * 997) }, 5);
    st.slotSalt = (seedBase + g * 2246822519) >>> 0;
    const chooser = T.policyChooserN(params, 0.15, 0, 5, GAMEMODE);
    let forceLeft = 0, lastIdx = 0;
    const wrapped = function (state, pid, legal) {
      const pick = chooser(state, pid, legal);
      if (pid === seat) {
        /* 上一回合挨没挨打（事件派生，供 arm=start 用） */
        if (ARM === 'start') {
          let hit = false;
          const ev = state.events || [];
          for (let j = lastIdx; j < ev.length; j++) { const e = ev[j]; if (e.type === 'action' && e.pid === seat) { if (j !== lastIdx) break; continue; } if (e.type === 'damage' && e.to === seat) hit = true; }
          lastIdx = ev.length;
          const canRing = legal.some(function (l) { return l.key === RING && l.affordable; });
          if (!hit && canRing && state.p[pid].hp > 1 && (!pick || pick.key !== RING)) { started++; return { key: RING, target: null, target2: null }; }
        }
        if (forceLeft > 0) {
          const wantKey = (ARM === 'ji') ? JIKEY : RING;
          const r = (wantKey === JIKEY) ? { key: JIKEY, affordable: true } : legal.find(function (l) { return l.key === RING && l.affordable; });
          if (r) { forceLeft--; forced++; return { key: wantKey, target: null, target2: null }; }
          forceLeft = 0;
        } else if (pick && pick.key === RING && K > 1) { started++; forceLeft = K - 1; }
      }
      return pick;
    };
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(i === seat ? wrapped : T.wrapBotN(SCRIPTS[(i + g) % SCRIPTS.length]));
    Play.autoGameN(st, cs);
    if (st.winner != null && st.winner === seat) wins++;
    /* 局末把这一局的环连击段收进分布 */
    for (const e of st.events || []) {
      if (e.type === 'action' && e.pid === seat) { if (e.key === RING) cur++; else { if (cur) runs.push(cur); cur = 0; } }
    }
    if (cur) { runs.push(cur); cur = 0; }
  }
  const avgRun = runs.length ? (runs.reduce((a, b) => a + b, 0) / runs.length) : 0;
  const longRuns = runs.filter(function (x) { return x >= 3; }).length;
  return { win: 100 * wins / GAMES, started: started, forced: forced, segs: runs.length, avgRun: avgRun, longFrac: runs.length ? 100 * longRuns / runs.length : 0 };
}
console.log('pack\tK=1\tK=2\tK=3\tK=4\t连击段数\t平均长度\t≥3 手段占比');
for (const p of CHAMPS) {
  const out = [];
  let st2 = null;
  for (const K of KS) { const r = run(p, K, 20261020); if (K === KS[0]) st2 = r; out.push(r ? r.win.toFixed(1) + '%' : '—'); }
  console.log(p.split('/').pop().replace(/\.(bak|js)$/, '') + '\t' + out.join('\t') + '\t' +
    (st2 ? st2.segs + '\t' + st2.avgRun.toFixed(2) + '\t' + st2.longFrac.toFixed(0) + '%' : '-'));
}