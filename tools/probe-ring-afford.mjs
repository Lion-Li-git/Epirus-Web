/* 环到底值不值得学 —— 两个决定性实验
 * E1 强制环反事实：把在位包包装成"只要付得起就打环"（另加"永不打环"作对照），
 *    在 4 类对手场里量胜率。若强制环 ⇒ 胜率明显更高 ⇒ 是真机会、网络估错了；
 *    若强制环 ⇒ 胜率明显更低 ⇒ 环在这个元游戏里本来就不划算，"让 AI 学会打环"这个目标要改写。
 * E2 概率裕度：在"环可负担"的那些决策点上读 forwardCands().probs ——
 *    区分"差一点点"（该动奖励/权重）与"差非常多"（该动表征）。
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
const N = Number(process.env.GAMES || 80);
const PACK = process.env.PACK || 'live';
function mb(s) { let a = s >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function loadBak(f) { const t = readFileSync(REPO + f, 'utf8'); return P.loadAny(JSON.parse(t.slice(t.indexOf('{"v":'), t.lastIndexOf('}') + 1))).params; }
const LIVE = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
const ARMA = loadBak('docs/artifacts/v7ringA1-82.bak');
const PARAMS = { live: LIVE, ringA1: ARMA }[PACK];
const ch = p => T.policyChooserN(p, 0.15);
const ringAff = (lg) => lg.some(l => l.key === A.RING && l.affordable);

/* ---- E1 包装：强制环 / 永不环 ---- */
function forceRing(inner) {
  return function (state, pid, legal) {
    if (ringAff(legal)) return { key: A.RING, target: null, target2: null, bead: null };
    return inner(state, pid, legal);
  };
}
function neverRing(inner) {
  return function (state, pid, legal) {
    const lg = legal.filter(l => l.key !== A.RING);
    return inner(state, pid, lg.length ? lg : legal);
  };
}
function duel(policy, field, mode, seed0) {
  let win = 0, draw = 0, epSum = 0, epMax = 0, ringN = 0, dmg = 0, rounds = 0, dead = 0;
  for (let g = 0; g < N; g++) {
    const seat = g % 5;
    const st = S.createState(mode, { next: mb(seed0 + g * 991) }, 5);
    st.slotSalt = h32(seed0 + g * 2246822519);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(i === seat ? policy : field(i === seat ? -1 : i));
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draw++; else if (st.winner === seat) win++;
    rounds += st.round;
    const me = st.p[seat];
    epSum += me.ep; if (me.ep > epMax) epMax = me.ep;
    for (const e of st.events) {
      if (e.type === 'action' && e.key === A.RING && e.outcome === 'ok' && !e.voided) ringN++;
      if (e.type === 'damage' && e.source === seat) dmg += e.amt || 1;
    }
    if (me.hp <= 0) dead++;
  }
  return { win: 100 * win / N, draw: 100 * draw / N, ep: epSum / N, epMax, ring: ringN / N, dmg: dmg / N, rounds: rounds / N, dead: 100 * dead / N };
}
const FIELDS = {
  '枪压(gunspam)': i => B.pickGunSpam,
  '憋大招(deepSaver)': i => B.pickDeepSaver,
  '在位包镜像': i => ch(PARAMS),
  '混场(枪压×2+狙击×2)': i => (i < 0 ? B.pickGunSpam : (i % 2 ? B.pickGunSpam : B.pickSnipeSpam)),
};
console.log(`=== E1 强制环反事实（包=${PACK}，${N} 局轮座；1 席被测 vs 4 席场；基线 20%）===`);
for (const mode of ['multi', 'long']) {
  console.log(`  [${mode}]`);
  for (const [fn, fm] of Object.entries(FIELDS)) {
    const rows = [
      ['强制环(付得起就打)', forceRing(ch(PARAMS))],
      ['永不环(对照)', neverRing(ch(PARAMS))],
      ['原样(在位行为)', ch(PARAMS)],
      ['脚本环(pickRingSpam)', B.wrapBotN ? B.wrapBotN(B.pickRingSpam) : T.wrapBotN(B.pickRingSpam)],
    ];
    const out = rows.map(([nm, p]) => {
      const r = duel(p, fm, mode, 314159);
      return `${nm}: 胜${r.win.toFixed(1)}%(和${r.draw.toFixed(0)}) 环${r.ring.toFixed(1)}/局 终ep${r.ep.toFixed(1)} 峰ep${r.epMax} 伤害${r.dmg.toFixed(0)} 回合${r.rounds.toFixed(0)} 死亡率${r.dead.toFixed(0)}%`;
    });
    console.log(`    vs ${fn}`);
    for (const o of out) console.log('      ' + o);
  }
}

/* ---- E2 概率裕度：环可负担时，网络给环多少概率 ---- */
console.log(`\n=== E2 环的概率裕度（在 5 席自对局里，凡"环可负担"的决策点统计 p(ring) vs p(argmax)）===`);
function margin(p, mode, label) {
  const inner = ch(p);
  let pts = 0, argmaxN = 0, prSum = 0, paSum = 0, ratioLe2 = 0, ratioLe1_5 = 0, gapHist = {};
  for (let g = 0; g < N; g++) {
    const st = S.createState(mode, { next: mb(7070 + g * 977) }, 5);
    st.slotSalt = h32(7070 + g * 2246822519);
    const cs = [];
    for (let i = 0; i < 5; i++) cs.push(function (s2, pid, legal) {
      const aff = legal.filter(l => l.affordable);
      const base = aff.length ? aff : [{ key: A.JI, affordable: true }];
      const cands = P.candidatesFor(s2, pid, T.econBase(s2, pid, base), {});
      const ringC = cands.filter(c => c.key === A.RING);
      if (ringC.length) {
        const f = P.forwardCands(s2, pid, cands, p, { temp: 0.15 });
        let pr = -1, ir = -1;
        for (let k = 0; k < cands.length; k++) if (cands[k].key === A.RING && f.probs[k] > pr) { pr = f.probs[k]; ir = k; }
        const pa = f.probs[f.argmax];
        pts++; prSum += pr; paSum += pa;
        if (ir === f.argmax) argmaxN++;
        const ratio = pa > 0 ? pa / Math.max(pr, 1e-9) : Infinity;
        if (ratio <= 2) ratioLe2++; if (ratio <= 1.5) ratioLe1_5++;
        const band = ratio <= 1.5 ? '≤1.5×' : ratio <= 3 ? '1.5–3×' : ratio <= 10 ? '3–10×' : ratio <= 100 ? '10–100×' : '>100×';
        gapHist[band] = (gapHist[band] || 0) + 1;
      }
      return inner(s2, pid, legal);
    });
    Play.autoGameN(st, cs);
  }
  console.log(`  [${label}/${mode}] 环可负担决策点 ${pts}（${N} 局）· 环=argmax 的比例 ${(100 * argmaxN / (pts || 1)).toFixed(1)}%`);
  console.log(`     平均 p(ring_best)=${(prSum / (pts || 1)).toFixed(3)} · 平均 p(argmax)=${(paSum / (pts || 1)).toFixed(3)} · 比值≤2 占 ${(100 * ratioLe2 / (pts || 1)).toFixed(0)}% · ≤1.5 占 ${(100 * ratioLe1_5 / (pts || 1)).toFixed(0)}%`);
  console.log(`     裕度分布：` + Object.entries(gapHist).map(([k, v]) => `${k}:${(100 * v / (pts || 1)).toFixed(0)}%`).join(' '));
}
for (const mode of ['multi', 'long']) { margin(PARAMS, mode, PACK); margin(LIVE, mode, 'live'); }
