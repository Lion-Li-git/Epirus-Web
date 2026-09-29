import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pairedDiff } from 'file:///D:/code/Epirus-Web/tools/routing-gain-lib.mjs';

/* §E152b · 分水岭实验：`V1`（1-ply 血量优势）到底是好目标还是坏目标？
   §E152 量到现役包在"1-ply 贪心"这把刻度上只有百分位 54.5（随机按构造 = 50），但那**不能**读成"还有 1.2 血可拿"：
   这游戏的正解常常是"现在拿 1 ジ / 蓄一颗珠"，一个长程策略在近视刻度上本来就该像随机。
   ⇒ 唯一的了断办法是让"照 V1 打"的贪手真的去上桌，和现役比**夺冠率**：
       贪手赢得更多 ⇒ V1 是真目标，§E153 可以把它接进适应度；
       贪手赢不过现役（甚至不如随机） ⇒ V1 是坏目标，§E153 直接砍掉，别再造第 N 把近视尺。
   三臂：`pack`（现役包 argmax，ε=0）‖ `greedy`（每决策枚举候选 + 重放，取 V1 最大）‖ `rand`（候选里定种随机一手）
   配对口径：同一张桌（同 4 个脚本 + 同座位序）× 同一批局号 ⇒ **逐桌配对**，`pairedDiff` 给 95%CI。
   ⚠ 被测席**一律不碰 `state.rng`**（贪手/随机手都用按决策定种的本地流）⇒ 三臂面对的对手流逐字相同，配对才成立。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const TABLES = Number(arg('tables', 10));
const GAMES = Number(arg('games', 10));
const SEED = Number(arg('seed', 77000));
const ARMS = arg('arms', 'pack,greedy,rand').split(',');
const { OPP_SPECS } = await import('file://' + REPO + 'server/opp-pool.mjs');
const { makeAsChooser } = await import('file://' + REPO + 'tools/bot-chooser-lib.mjs');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots, Play = W.EpirusPlay, X = W.EpirusResolve;
const asChooser = makeAsChooser({ T: T, R: R });
const NAMES = OPP_SPECS.map(o => o.name).concat(['focusfire', 'minespam', 'cursestorm']);
const FN = {}; for (const o of OPP_SPECS) FN[o.name] = Bots[o.fn];
FN.focusfire = Bots.pickFocusFire; FN.minespam = Bots.pickMineSpam; FN.cursestorm = Bots.pickCurseStorm;
const mm = readFileSync(REPO + PACK, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('⛔ 包不兼容'); process.exit(1); }

const V1 = st => { const me = st.p[0]; const o = st.p.filter((p, i) => i !== 0 && p.hp > 0);
  return 20 * (me.hp > 0 ? 1 : 0) + me.hp - (o.length ? o.reduce((a, p) => a + p.hp, 0) / o.length : 0); };
function replay(snap, seed, picks) {
  const st = S.cloneState(snap);
  st.rng = { next: T.mulberry32(seed) };
  for (let pid = 0; pid < picks.length; pid++) {
    const pk = picks[pid]; if (!pk) continue;
    const p = st.p[pid]; if (!p || p.hp <= 0) continue;
    S.attemptAction(st, pid, pk.key, { bead: pk.bead || (p.elec > p.boom ? 'boom' : 'elec'), target: pk.target, target2: pk.target2 });
  }
  X.resolveActions(st); X.endTurn(st);
  return st;
}
const norm = c => ({ key: c.key, target: c.target == null ? null : c.target, target2: c.target2, bead: c.bead });

/* §E152b-补 · 在线"信念表"：**只用可观测面**（对手的钱/是否有珠/上一手）预测他这一手做什么。
   训练信号来自同一局内真实发生的 (决策点签名 → 那一手)，跨局累积 ⇒ 不碰脚本策略、不问珠的类型。
   这就是那 44pt 里"可推断"的那一块到底有多大。 */
const BELIEF = new Map();
const sig = p => [Math.min(5, p.ep >> 1), p.ep >= 5 ? 1 : 0, (p.elec || p.boom) ? 1 : 0, p.lastSkill || '-'].join('/');
/* 信念表：签名 → {动作键 → 次数}；只用可观测面，不问脚本策略、不知道珠的类型 */
function predict2(k) {
  const m = BELIEF.get(k); if (!m) return R.SK.JI;
  let best = R.SK.JI, bv = -1;
  for (const key in m) if (m[key] > bv) { bv = m[key]; best = key; }
  return best;
}
function train(sigAt, actual) {
  for (let i = 1; i < 5; i++) {
    if (!sigAt || !sigAt[i] || !actual[i]) continue;
    let m = BELIEF.get(sigAt[i]); if (!m) { m = {}; BELIEF.set(sigAt[i], m); }
    m[actual[i].key] = (m[actual[i].key] || 0) + 1;
    belTot++; if (predict2(sigAt[i]) === actual[i].key) belHit++;
  }
}
let belTot = 0, belHit = 0;
let sigAt = null, actual = [null, null, null, null, null];

function runArm(arm, pick, seedBase) {
  const rows = [];
  /* 信念表**每臂从零学起**：留着上一臂的表 = 让臂之间互相污染（轨迹不同，学到的分布也不同） */
  BELIEF.clear(); belTot = 0; belHit = 0;
  let decIdx = 0, greedyCalls = 0;
  for (let t = 0; t < TABLES; t++) {
    const r0 = T.mulberry32(SEED + t * 7919);
    const pk4 = []; while (pk4.length < 4) { const n = NAMES[Math.floor(r0() * NAMES.length)]; if (pk4.indexOf(n) < 0) pk4.push(n); }
    let first = 0, rounds = 0;
    for (let g = 0; g < GAMES; g++) {
      const st = S.createState('multi', { next: T.mulberry32(seedBase + t * 104729 + g) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seedBase + t * 104729 + g);
      /* ⚠⚠ 第三处量具陷阱（前两处见 §E150d 的 memo）：`pack` 臂**必须**用引擎自己的 `T.policyChooserN(params, 0.15)`，
         不能自己拿 `forwardCands` 重搓一个 argmax —— 因为 `policyChooserN` 里还住着**用户裁定的规则**
         （ep<2 不蓄能、铺垫卡要 3ep、贴贴后的优先级、`lockTarget` 等，见 `evo.js:420/524` 一带）。
         我第一版手搓 argmax ⇒ 那是个被削过的包，50pt 里有一部分是这么来的（本仓"两份同构实现必漂移"的第四次）。 */
      const sel = T.policyChooserN(params, 0.15);
      sigAt = null; actual = [null, null, null, null, null];
      const subject = function (s, pid, legal) {
        const ds = ((++decIdx) * 2654435761) >>> 6;
        const v7 = legal.filter(l => l.affordable);
        const use = v7.length ? v7 : [{ key: R.SK.JI, affordable: true }];
        const cands = P.candidatesFor(s, pid, use, { lockTarget: false });
        if (arm === 'pack') return sel(s, pid, legal);
        if (arm === 'rand') return norm(cands[ds % cands.length]);
        /* 三种"对手下一手从哪来"，用来把 `greedy` 那 50pt 拆成两半：
             greedy          = 当场**问脚本策略**（含珠的类型/目标 ⇒ 这是游戏故意藏的信息，v1.5.15 就当泄漏修掉了）
             greedy-hist     = 只用可观测历史：把他这一手预测成**上一手做过的**
             greedy-belief   = 只用可观测面的**在线频次表**（签名 = 钱档/有没有珠/上一手 ⇒ 下一手的分布），跨局累积
           ⇒ `greedy − greedy-hist` = "策略知识值多少"；`greedy-belief − greedy-hist` = "**从可观测行为能推断回多少**"，
             这一格才是决定"要不要为它换指纹重训"的数。 */
        const predict = arm === 'greedy' ? 'policy' : (arm === 'greedy-belief' ? 'belief' : (arm === 'greedy-none' ? 'none' : 'history'));
        const oppPicks = [null];
        sigAt = [null, null, null, null, null];
        for (let i = 1; i < 5; i++) {
          if (s.p[i].hp <= 0) { oppPicks.push(null); continue; }
          sigAt[i] = sig(s.p[i]);
          if (predict === 'none') {
            /* 空模型：只假设"对手会拿 1 ジ"⇒ 这一臂与前几臂的差**全部来自前瞻本身**，不含任何对手建模 */
            oppPicks.push({ key: R.SK.JI, target: null, target2: null, bead: null });
          } else if (predict === 'history') {
            const k = s.p[i].lastSkill || R.SK.JI;
            oppPicks.push({ key: k, target: (s.p[i].lastTarget == null ? null : s.p[i].lastTarget), target2: null, bead: null });
          } else if (predict === 'belief') {
            /* 只预测"做哪张卡"，目标交给引擎按默认解析 ⇒ 不去猜那些同样被藏起来的东西 */
            oppPicks.push({ key: predict2(sigAt[i]), target: null, target2: null, bead: null });
          } else {
            const q = S.cloneState(s); q.rng = { next: T.mulberry32(ds) };
            const lg = Play.legalActions(q, i).filter(l => l.affordable);
            const rr = asChooser(FN[pk4[i - 1]])(q, i, lg.length ? lg : [{ key: R.SK.JI, affordable: true }]);
            oppPicks.push(norm(rr));
          }
        }
        let best = cands[0], bv = -1e9;
        for (let ci = 0; ci < cands.length; ci++) {
          const picks = [norm(cands[ci])].concat(oppPicks.slice(1));
          const v = V1(replay(s, ds + ci * 7919, picks));
          greedyCalls++;
          if (v > bv + 1e-9) { bv = v; best = cands[ci]; }
        }
        return norm(best);
      };
      /* 记录对手真实动作（给 belief 臂在线学习用），并照原样返回 ⇒ 除"多记一份"外与旧口径逐字相同 */
      const mk = i => function (s, pid, legal) { const r = asChooser(FN[pk4[i]])(s, pid, legal); actual[pid] = norm(r); return actual[pid]; };
      /* 回合末（`resolveActions` + `endTurn` 之后）用"决策前的可观测签名 → 真做的动作"更新信念表 */
      const onTurn = function () { if (arm === 'greedy-belief') train(sigAt, actual); sigAt = null; };
      Play.autoGameN(st, [subject, mk(0), mk(1), mk(2), mk(3)], onTurn, null);
      if (st.winner === 0) first++;
      rounds += st.round;
    }
    rows.push({ table: pk4.join(','), first: first, g: GAMES, rounds: rounds / GAMES });
  }
  return { rows: rows, calls: greedyCalls, belAcc: belTot ? (100 * belHit / belTot).toFixed(1) + '% / n=' + belTot : '—' };
}
console.log('# §E152b 三臂配对：现役包 vs 1-ply 贪手 vs 随机一手 ‖ 桌=' + TABLES + ' × 局=' + GAMES + ' ‖ 包=' + PACK);
const res = {};
for (const a of ARMS) res[a] = runArm(a, null, SEED);
const tot = {};
for (const a of ARMS) tot[a] = 100 * res[a].rows.reduce((x, r) => x + r.first, 0) / (TABLES * GAMES);
console.log('\n  臂            夺冠率      平均回合   V1 重放次数   信念表预测命中率');
for (const a of ARMS) {
  const rd = res[a].rows.reduce((x, r) => x + r.rounds, 0) / TABLES;
  console.log('  ' + a.padEnd(14) + tot[a].toFixed(2).padStart(7) + '%' + rd.toFixed(1).padStart(11) + String(res[a].calls).padStart(12) + '   ' + res[a].belAcc);
}
const mean = x => x.rows.reduce((s, r) => s + r.first / r.g, 0) / TABLES;
for (const a of ARMS) for (const b of ARMS) {
  if (a >= b) continue;
  const d = pairedDiff(res[a].rows.map(r => r.first / r.g), res[b].rows.map(r => r.first / r.g), 1.96);
  console.log('  配对差 ' + a + ' − ' + b + ' = **' + (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']**（逐桌 n=' + d.n + '）');
}
console.log('\n  自证：三臂用同一批桌子与同一批 seed，且被测席不消耗 `state.rng` ⇒ 差异只能来自"出招规则"本身。');
console.log('  ⚠ `greedy` 的"对手本回合动作"是**预测**的（真实游戏里那时对手还没出），所以它是"有限信息的贪心"，不是全知；这与 §E152 的 regret 口径有意不同，别再混引。');
