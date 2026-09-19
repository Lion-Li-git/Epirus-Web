/* V2（"打整局"那根轴）的解剖 —— 回答用户那个要害问题：
 *   "会玩的人如果发现 AI 只是拿着基础技能、看着别人互殴，那不算可玩性。"
 * ⇒ V2 只是一个**结果量**（1 席被测 vs 4 席 pickBalanced 的每席位胜率），它不说明这个结果是怎么来的。
 *   两种来路完全不同：① 被测自己打死人（有攻击性、有配合应对）；② 对手互殴致死、被测捡最后一个人头（苟）。
 *   ② 在胜率上一样好看，但对真人玩家毫无可玩性。⇒ 这个探针把"来路"量出来。
 * 读数量：
 *   击杀归属   = 被测席**造成致死一击**的次数 ÷ 全场死亡数（其余是对手互杀 / 无来源伤害：地雷·天火）
 *   伤害归属   = 被测造成的伤害 ÷ 全场总伤害（含被测被抢走的部分另计）
 *   出手构成   = 被测按卡名统计的前几名 + ジ（基础蓄力）占比 + 防御族占比 + 有效出手种类数 exp(熵)
 *   以及平均回合数（苟到哨声的包会把回合数顶高、伤害顶低 —— 两个一起看才不会被单一数字骗）
 * 用法：node tools/probe-v2-anatomy.mjs [GAMES=80] [包...]（默认：线上包 + 今夜 V2 榜首与榜尾各几个）
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots, A = R.SK;
const argv = process.argv.slice(2);
const N = Number(argv[0] && /^\d+$/.test(argv[0]) ? argv.shift() : 80);
const FILES = argv.length ? argv : ['js/bundled-champion-3p.js', 'docs/artifacts/v7l2f-106.bak', 'docs/artifacts/v7l2f-82.bak',
  'docs/artifacts/v7l2c-103.bak', 'docs/artifacts/v7l2s-91.bak', 'docs/artifacts/v7l2c-82.bak', 'docs/artifacts/v7l2h-93.bak'];
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
const NAME = {}; for (const k in R.byKey) NAME[k] = R.byKey[k].name || k;
const CAT = {}; for (const k in R.byKey) CAT[k] = R.byKey[k].cat;
const GF = new Set(R.GUARD_FAMILY || [A.GUARD, A.REFLECT, A.BAGUA, A.SHIFT, A.JINSHIELD]);
const opp = (st, pid, lg) => B.pickBalanced(st, pid, lg);
console.log(`=== V2 装配的解剖（1 席被测 vs 4 席 pickBalanced · ${N} 局轮座 · multi）===`);
console.log('  包                每席胜%  击杀归属%  伤害归属%  平均回合  ジ占比%  防御族%  出手种类exp(熵)  前三张卡');
for (const f of FILES) {
  let params; try { params = load(f); } catch (e) { console.log('  跳过 ' + f + '：' + e.message); continue; }
  const me = T.policyChooserN(params, 0.15);
  let wins = 0, draws = 0, rounds = 0, deaths = 0, myKills = 0, srcNull = 0, dmgMe = 0, dmgAll = 0, acts = 0, ji = 0, def = 0;
  const used = {};
  for (let g = 0; g < N; g++) {
    const off = g % 5;
    const st = S.createState('multi', { next: mb(6161 + g * 977) }, 5);
    st.slotSalt = h32(6161 + g * 2246822519);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(i === off ? me : opp);
    /* 被测席的 chooser 包一层，用来记出手构成（注意：被测席位是轮转的 off，不是固定的 0 号位） */
    const meWrapped = function (st2, pid, lg) {
      acts++;
      const r = me(st2, pid, lg);
      if (r) {
        const k = typeof r === 'string' ? r : r.key;
        used[k] = (used[k] || 0) + 1;
        if (k === A.JI) ji++;
        if (GF.has(k)) def++;
      }
      return r;
    };
    const aliveBefore = [1, 1, 1, 1, 1];
    const lastHit = {}; let evPtr = 0;
    /* 自己推演（不能用 autoGameN：那拿不到"致死一击"的时刻）。st.events 是**累积**的 ⇒ 只扫新增段，别重复计。 */
    let guard = 0;
    const X = sb.window.EpirusResolve;
    while (!st.over && guard++ < 4000) {
      X.startTurn(st); if (st.over) break;
      const picks = [];
      for (let pid = 0; pid < 5; pid++) {
        if (st.p[pid].hp <= 0) { picks.push(null); continue; }
        const lg = Play.legalActions(st, pid);
        const raw = Play.normPick(pid === off ? meWrapped(st, pid, lg) : opp(st, pid, lg));
        const l = lg.find(x => x.key === raw.key);
        picks.push({ key: (l && l.affordable) ? raw.key : A.JI, target: raw.target, target2: raw.target2, bead: raw.bead });
      }
      for (let pid = 0; pid < 5; pid++) { if (!picks[pid]) continue; S.attemptAction(st, pid, picks[pid].key, { bead: picks[pid].bead, target: picks[pid].target, target2: picks[pid].target2 }); }
      X.resolveActions(st);
      for (; evPtr < st.events.length; evPtr++) {
        const e = st.events[evPtr];
        if (e.type === 'damage' && typeof e.to === 'number') {
          dmgAll += (e.amt || 1); if (e.source === off) dmgMe += (e.amt || 1);
          lastHit[e.to] = e.source;
        }
      }
      for (let pid = 0; pid < 5; pid++) {
        if (aliveBefore[pid] && st.p[pid].hp <= 0) {
          aliveBefore[pid] = 0; deaths++;
          const src = lastHit[pid];
          if (src === off) myKills++;
          else if (src == null) srcNull++;
        }
      }
      X.endTurn(st);
    }
    rounds += st.round;
    if (st.winner === 'draw') draws++; else if (st.winner === off) wins++;
  }
  const nm = f.split('/').pop().replace('.bak', '').replace('bundled-champion-3p.js', '线上包');
  const ent = Object.values(used).reduce((s, x) => s + x, 0);
  let H = 0; for (const k in used) { const p = used[k] / ent; if (p > 0) H -= p * Math.log(p); }
  const top3 = Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => NAME[k] + ' ' + (100 * v / ent).toFixed(0) + '%').join(' / ');
  console.log(`  ${nm.padEnd(17)}${(100 * wins / N).toFixed(1).padStart(6)}   ${(100 * myKills / Math.max(1, deaths)).toFixed(0).padStart(8)}%   ${(100 * dmgMe / Math.max(1, dmgAll)).toFixed(0).padStart(8)}%   ${(rounds / N).toFixed(1).padStart(7)}   ${(100 * ji / Math.max(1, acts)).toFixed(0).padStart(6)}   ${(100 * def / Math.max(1, acts)).toFixed(0).padStart(7)}    ${Math.exp(H).toFixed(2).padStart(9)}     ${top3}`);
}
console.log('\n  读法：**击杀归属低 + 每席胜率高** = 靠对手互杀捡人头（苟），胜率数字不代表可玩性；');
console.log('        **击杀归属高 + 出手种类高 + ジ占比低** 才是"真的会跟人打"。平均回合数顶高而伤害归属低的，是在拖哨声。');
