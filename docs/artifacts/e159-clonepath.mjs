import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E159 · 证明/否证我在 README 里写的那句"浏览器这条路不通"
 * 页面形状（`ui.js:286/542/613`）：AI 拿到的是 **`preState = S.cloneState(B.state)`**，不是活对象。
 * v1.5.305 的信念表挂在活对象的**非枚举**槽上 ⇒ JSON 往返丢槽 ⇒ 每次决策从空表开始 ⇒ 预测恒等于默认 ジ
 *   ⇒ 理论上应退化成 §E152c 的 `greedy-none`（比现役包还差 10.50pt 那一臂）。
 * 这台就是把那个形状在仪器里复现出来：**同一套搜索、同一个 seed，只改"喂活对象还是喂克隆"**。
 *   若 B 档 ≈ 空模型档而 A 档 ≈ §E154 的 78.50%，那句 README 就是**实测结论**而不是推论。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const TABLES = Number(arg('tables', 40));
const GAMES = Number(arg('games', 10));
const SEED = Number(arg('seed', 77000));

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Play = W.EpirusPlay;
const { OPP_SPECS } = await import('file://' + REPO + 'server/opp-pool.mjs');
const Bots = W.EpirusBots, FN = {}; for (const o of OPP_SPECS) FN[o.name] = Bots[o.fn];
const NAMES = OPP_SPECS.map(o => o.name).concat(['focusfire', 'minespam', 'cursestorm']);
FN.focusfire = Bots.pickFocusFire; FN.minespam = Bots.pickMineSpam; FN.cursestorm = Bots.pickCurseStorm;
const { makeAsChooser } = await import('file://' + REPO + 'tools/bot-chooser-lib.mjs');
const asChooser = makeAsChooser({ T: T, R: R });
const mm = readFileSync(REPO + 'js/bundled-champion-3p.js', 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
const erFor = r => (r <= 1 ? 0 : r === 2 ? 0.1 : 0.2);

/* 三种"页面会怎么把 state 交到 chooser 手上"：
     live   = `autoGameN` 的形状（我的门禁与所有仪器今天都在用这个）
     clone  = `ui.js` 的形状（每次决策现克隆）
     nullmod= 参照物：明知是空模型的搜索（§E152c 的 `greedy-none`），用来判断"退化到哪儿" */
function run(mode) {
  const rows = [];
  for (let t = 0; t < TABLES; t++) {
    const r0 = T.mulberry32(SEED + t * 7919);
    const pk4 = []; while (pk4.length < 4) { const n = NAMES[Math.floor(r0() * NAMES.length)]; if (pk4.indexOf(n) < 0) pk4.push(n); }
    let first = 0, rounds = 0;
    for (let g = 0; g < GAMES; g++) {
      const seed = SEED + t * 104729 + g;
      const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
      /* ⚠ 两档都必须**每个决策现建 chooser**：`policyChooserBelief` 的 ε 是在构造时定死的，
         而页面的形状本来就是"每次决策调一次 `pickChampion`"（`ui.js:489`）。
         我第一版在 A 档把 chooser 建在局首 ⇒ ε 被冻在第 1 回合的 0，等于拿"无探索"的那一档去比"有探索"的那一档
         （读出来的 4.25pt 差根本不是克隆的代价）。修仪器不修结论：B−C 那一行两档都是每决策新建，本来就成立。 */
      const subject = function (s, pid, legal) {
        const bf = legal.filter(l => l.affordable);
        const lfa = bf.length ? bf : [{ key: R.SK.JI, affordable: true }];
        if (mode === 'clone') {
          const q = S.cloneState(s);          /* 页面就是这么干的（`ui.js:286`） */
          return T.policyChooserBelief(params, 0.15, erFor(q.round), 5, 'soft')(q, pid, lfa);
        }
        if (mode === 'nullmod') {
          /* 空模型参照：只假设对手拿 ジ，再做同样的 1-ply 重放搜索 */
          const cands = P.candidatesFor(s, pid, lfa, { lockTarget: false });
          const picks = [null, { key: R.SK.JI }, { key: R.SK.JI }, { key: R.SK.JI }, { key: R.SK.JI }];
          let best = cands[0], bv = -1e18;
          for (let ci = 0; ci < cands.length; ci++) {
            const q = S.cloneState(s); q.rng = { next: T.mulberry32((g * 7919 + ci * 13 + 1) >>> 0) };
            picks[0] = { key: cands[ci].key, target: cands[ci].target, target2: cands[ci].target2, bead: cands[ci].bead };
            for (let i = 0; i < 5; i++) { const pk = picks[i]; if (!pk || q.p[i].hp <= 0) continue; S.attemptAction(q, i, pk.key, { bead: pk.bead, target: pk.target, target2: pk.target2 }); }
            W.EpirusResolve.resolveActions(q); W.EpirusResolve.endTurn(q);
            const o = q.p.filter((p, i) => i !== 0 && p.hp > 0);
            const v = 20 * (q.p[0].hp > 0 ? 1 : 0) + q.p[0].hp - (o.length ? o.reduce((a, p) => a + p.hp, 0) / o.length : 0);
            if (v > bv + 1e-9) { bv = v; best = cands[ci]; }
          }
          return { key: best.key, target: best.target == null ? null : best.target, target2: best.target2, bead: best.bead };
        }
        return T.policyChooserBelief(params, 0.15, erFor(s.round), 5, 'soft')(s, pid, lfa);
      };
      const mk = i => function (s, pid, legal) { return asChooser(FN[pk4[i]])(s, pid, legal); };
      Play.autoGameN(st, [subject, mk(0), mk(1), mk(2), mk(3)], null, null);
      if (st.winner === 0) first++;
      rounds += st.round;
    }
    rows.push({ t: t, first: first, g: GAMES, rounds: rounds / GAMES });
  }
  return rows;
}
const { pairedDiff } = await import('file://' + REPO + 'tools/routing-gain-lib.mjs');
console.log('# §E159 信念表活得过 `cloneState` 吗（页面的形状 vs 仪器的形状） ‖ 桌=' + TABLES + ' × 局=' + GAMES);
const A = run('live'), B = run('clone'), C = run('nullmod');
const mean = x => 100 * x.reduce((s, r) => s + r.first, 0) / (TABLES * GAMES);
console.log('  A 喂**活对象**（`autoGameN`／门禁与仪器的形状）  夺冠 ' + mean(A).toFixed(2) + '%   平均回合 ' + (A.reduce((s, r) => s + r.rounds, 0) / TABLES).toFixed(1));
console.log('  B 喂**克隆**（`ui.js:286` 页面的形状）           夺冠 ' + mean(B).toFixed(2) + '%   平均回合 ' + (B.reduce((s, r) => s + r.rounds, 0) / TABLES).toFixed(1));
console.log('  C 空模型 + 同样的搜索（参照物）                  夺冠 ' + mean(C).toFixed(2) + '%   平均回合 ' + (C.reduce((s, r) => s + r.rounds, 0) / TABLES).toFixed(1));
const d1 = pairedDiff(A.map(r => r.first / r.g), B.map(r => r.first / r.g), 1.96);
console.log('  配对差 A − B = **' + (100 * d1.m).toFixed(2) + 'pt [' + (100 * d1.lo).toFixed(2) + ', ' + (100 * d1.hi).toFixed(2) + ']**（逐桌 n=' + d1.n + '）');
const d2 = pairedDiff(B.map(r => r.first / r.g), C.map(r => r.first / r.g), 1.96);
console.log('  配对差 B − C = ' + (100 * d2.m).toFixed(2) + 'pt [' + (100 * d2.lo).toFixed(2) + ', ' + (100 * d2.hi).toFixed(2) + ']  ← **B 与"空模型"分不开，就等于说页面的形状下信念表根本没在工作**');
console.log('\n  判读：A≫B 且 B≈C ⇒ README 那句"浏览器这条路不通"是**实测**；B≈A ⇒ 我的读码推论错了，槽位其实活得下来（那就删掉那句）。');
