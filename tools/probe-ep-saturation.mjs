/* E6 ep 特征饱和：网络到底"看不看得到"自己攥着 40 点 ep？
 * 读码：policy.js:202 `Math.min(me.ep, 12)/12`、:238 `(ep-maxEp)/12` 再夹 [-1,1]、:379 `(ep-cost)/12` 夹 [-1,1]
 *      ⇒ **ep>12 之后输入完全相同**（只有 ep>=2 / >=5 这类布尔旗标与候选表本身还在变）。
 * 实测：真局快照 + 只改 ep 成一阶梯（3/6/9/12/15/20/30/40），其它一律不动，看概率向量动不动。
 * 判据：若 p(JI) 在 ep≥12 一段是平的 ⇒ "攥着钱不花"这个病**在表征里不可见**，
 *      任何奖励塑形（环奖励/兑现奖励）都只是在猜一个网络测不到的量。
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  X = sb.window.EpirusResolve, T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, A = R.SK;
function mb(seed) { let a = seed >>> 0; return { next() { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }, save() { return a >>> 0; }, restore(v) { a = v >>> 0; } }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function loadBak(f) { const t = readFileSync(REPO + f, 'utf8'); return P.loadAny(JSON.parse(t.slice(t.indexOf('{"v":'), t.lastIndexOf('}') + 1))).params; }
const LIVE = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
const ARM = loadBak('docs/artifacts/v7ringA1-82.bak');
const ch = p => T.policyChooserN(p, 0.15);
function harvest(params, mode, want) {
  const inner = ch(params); const pool = []; let cur = 0, pg = 0;
  const mk = () => { const cs = []; for (let i = 0; i < 5; i++) cs.push(function (s2, pid, lg) {
    if (pid === 0 && s2.actions.every(a => a == null) && pg < 2 && s2.round >= 8 && s2.p[0].hp >= 2) { pool.push({ snap: S.cloneState(s2), round: s2.round, ep: s2.p[0].ep }); pg++; }
    return inner(s2, pid, lg);
  }); return cs; };
  for (let g = 0; g < 400 && pool.length < want; g++) {
    cur = g; pg = 0;
    const st = S.createState(mode, { next: mb(4242 + g * 977) }, 5); st.rng = mb(4242 + g * 977); st.slotSalt = h32(4242 + g * 2246822519);
    let guard = 0;
    while (!st.over && guard++ < 5000) {
      X.startTurn(st); if (st.over) break;
      const picks = [];
      for (let pid = 0; pid < 5; pid++) { if (st.p[pid].hp <= 0) { picks.push(null); continue; } const lg = Play.legalActions(st, pid); const raw = Play.normPick(mk()[pid](st, pid, lg)); const l = lg.find(x => x.key === raw.key); picks.push({ key: (l && l.affordable) ? raw.key : A.JI, target: raw.target, target2: raw.target2, bead: raw.bead }); }
      for (let pid = 0; pid < 5; pid++) { if (!picks[pid]) continue; S.attemptAction(st, pid, picks[pid].key, { bead: picks[pid].bead, target: picks[pid].target, target2: picks[pid].target2 }); }
      X.resolveActions(st); X.endTurn(st);
      if (pool.length >= want) break;
    }
  }
  return pool.slice(0, want);
}
const LADDER = [2, 3, 5, 8, 11, 12, 13, 16, 20, 30, 40];
/* 包名不写死：这里曾硬编码 `v7new5_005-31`，换包后这张表会指着错的包读（09-19 实测到 LIVE 已经是新包）。
 * EP_PROBE_BAK=逗号分隔的 .bak ⇒ 与线上包同引擎、同量具并排测（换包归因用）。 */
const LIVE_TAG = '线上包 payload#' + createHash('sha1').update(JSON.stringify(sb.window.EPIRUS_CHAMPION_3P)).digest('hex').slice(0, 8);
const EXTRA = (process.env.EP_PROBE_BAK || '').split(',').filter(Boolean).map(f => [f.replace(/^.*\//, '').replace('.bak', ''), loadBak(f)]);
for (const [label, params] of [['arm A (v7ringA1-82)', ARM], [LIVE_TAG, LIVE], ...EXTRA]) {
  const snaps = harvest(params, 'multi', 12);
  console.log(`\n=== ${label}：同一快照只改 ep，看网络的 p(JI) / p(最贵可负担攻击) 动不动（${snaps.length} 个快照 × 阶梯 ${LADDER.join('/')}）===`);
  const tab = {};
  for (const s of snaps) {
    for (const e of LADDER) {
      const st = S.cloneState(s.snap); st.rng = mb(5); st.p[0].ep = e;
      const lg = Play.legalActions(st, 0).filter(l => l.affordable);
      if (!lg.length) continue;
      const cands = P.candidatesFor(st, 0, T.econBase(st, 0, lg), {});
      const f = P.forwardCands(st, 0, cands, params, { temp: 0.15 });
      const byKey = {};
      for (let i = 0; i < cands.length; i++) { const k = cands[i].key; if (!(k in byKey) || f.probs[i] > byKey[k]) byKey[k] = f.probs[i]; }
      const atk = R.skills.filter(x => x.cat === R.CAT.ATTACK && (byKey[x.key] || 0) > 0);
      (tab[e] = tab[e] || { n: 0, ji: 0, ring: 0, atk: 0, arg: {} }).n++;
      tab[e].ji += byKey[A.JI] || 0; tab[e].ring += byKey[A.RING] || 0;
      tab[e].atk += Math.max(0, ...atk.map(x => byKey[x.key] || 0));
      let bk = null, bv = -1; for (const k in byKey) if (byKey[k] > bv) { bv = byKey[k]; bk = k; }
      tab[e].arg[bk] = (tab[e].arg[bk] || 0) + 1;
    }
  }
  console.log('   ep   p(ジ)   p(环)   p(最好的攻击)   出手人数占比   argmax 分布');
  for (const e of LADDER) {
    const t = tab[e]; if (!t || !t.n) { console.log(`   ${String(e).padStart(3)}  （该 ep 档位无候选/不可达）`); continue; }
    console.log(`   ${String(e).padStart(3)}  ${(t.ji / t.n).toFixed(3)}  ${(t.ring / t.n).toFixed(4)}  ${(t.atk / t.n).toFixed(3)}        ${(100 * (t.arg['ji'] || 0) / t.n).toFixed(0)}% 打ジ      ` + JSON.stringify(t.arg));
  }
}
