import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* §E152 · 把"该怎么打"交给引擎：**固定别人本回合的动作，只替换被测方那一手，重放结算** ⇒ 得到每手的真值，
   于是"打错了"不再是我写的散文规则，而是 = `max_c V(c) − V(选了的那手)`（regret，单位=血量差）。

   装配口径（与 `js/core/play.js:43-77 autoGameN` 逐字同构，一处不同都让 regret 失去意义）：
     · 快照点 = 被测席 chooser 被调用那一刻 ⇒ 在 `startTurn` 之后、本回合任何 `attemptAction` 之前（`state.actions` 还空）
     · 重放 = 按 pid 升序把**记录下来的**四席对手动作原样 `attemptAction` 回去，只把被测席换成候选 c
     · 结算 = `resolveActions(st)` + `endTurn(st)`（含回合末的雷倒计时/架势清空/下回合收入等），不额外加"下一回合"的推断 ⇒ **1-ply**
     ⚠ `S.cloneState` 把 `rng` 按引用带走（`state.js:236`：`c.rng = s.rng`）⇒ 分支之间会互相推进随机流。
        所以每个分支都换成**同一条按决策定种**的新流 `T.mulberry32(决策号)`：同一决策内所有候选可比（这才是 regret 要的），
        代价是重放出来的那一回合与真实发生的未必逐字相同 ⇒ regret 只在**决策内**有效，跨决策只比均值。

   价值函数 V（两条一起报，免得结论挂在我挑的那一条上）：
     V1 = 20·存活 + 自己血 − 其他活人平均血      V2 = 20·存活 + 自己血 − 其他活人最高血
   参照：`argmax V` 的 regret 按构造 = 0（天花板）‖ 均匀随机选候选 = 地板 ⇒ **地板不为 0 才说明这一维有钱可赚**。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACKS = argv.filter(a => !a.startsWith('--'));
const TABLES = Number(arg('tables', 12));
const GAMES = Number(arg('games', 6));
const SEED = Number(arg('seed', 77000));
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

const V1 = st => { const me = st.p[0]; const o = st.p.filter((p, i) => i !== 0 && p.hp > 0);
  const avg = o.length ? o.reduce((a, p) => a + p.hp, 0) / o.length : 0;
  return 20 * (me.hp > 0 ? 1 : 0) + me.hp - avg; };
const V2 = st => { const me = st.p[0]; const o = st.p.filter((p, i) => i !== 0 && p.hp > 0);
  const mx = o.length ? Math.max(...o.map(p => p.hp)) : 0;
  return 20 * (me.hp > 0 ? 1 : 0) + me.hp - mx; };

function loadParams(file) {
  const mm = readFileSync(REPO + file, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  const pr = P.unpack(JSON.parse(mm[1]), true);
  if (!pr) { console.error('⛔ 包不兼容 ' + file); process.exit(1); }
  return pr;
}
function replay(snap, seed, picks) {
  const st = S.cloneState(snap);
  /* `state.rng` 是**对象** `{ next() }`（`state.js:68`、判定的用法在 `resolve.js:126 state.rng.next()`），
     不是函数 ⇒ 这里必须换成一个包了 next 的对象，否则 judge() 当场炸。 */
  st.rng = { next: T.mulberry32(seed) };
  for (let pid = 0; pid < picks.length; pid++) {
    const pk = picks[pid]; if (!pk) continue;
    const p = st.p[pid]; if (!p || p.hp <= 0) continue;
    S.attemptAction(st, pid, pk.key, {
      bead: pk.bead || (p.elec > p.boom ? 'boom' : 'elec'),
      target: pk.target, target2: pk.target2
    });
  }
  X.resolveActions(st); X.endTurn(st);
  return st;
}
function runPack(file) {
  const params = loadParams(file);
  const acc = { n: 0, r1: 0, r2: 0, best: 0, rnd1: 0, rnd2: 0, rndN: 0, deadEnd: 0, cand: 0, hist: [] };
  const rr = T.mulberry32(SEED + 5);
  let decIdx = 0;
  for (let t = 0; t < TABLES; t++) {
    const r0 = T.mulberry32(SEED + t * 7919);
    const pick = []; while (pick.length < 4) { const n = NAMES[Math.floor(r0() * NAMES.length)]; if (pick.indexOf(n) < 0) pick.push(n); }
    for (let g = 0; g < GAMES; g++) {
      const st = S.createState('multi', { next: T.mulberry32(SEED + t * 104729 + g) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(SEED + t * 104729 + g);
      let snap = null, use = null, decSeed = 0, chosen = null;
      const subject = function (s, pid, legal) {
        /* 快照：此刻本回合还没有任何人 attemptAction（play.js 先收齐 picks 再统一登记） */
        snap = S.cloneState(s); snap.rng = s.rng; decSeed = (decIdx * 2654435761) >>> 8; decIdx++;
        const v7 = legal.filter(l => l.affordable);
        use = v7.length ? v7 : [{ key: R.SK.JI, affordable: true }];
        const cands = P.candidatesFor(s, pid, use, { lockTarget: false });
        const f = P.forwardCands(s, pid, cands, params, { temp: 1 });
        let bi = 0; for (let i = 1; i < f.probs.length; i++) if (f.probs[i] > f.probs[bi]) bi = i;
        chosen = cands[bi];
        return { key: chosen.key, target: chosen.target == null ? null : chosen.target, target2: chosen.target2, bead: chosen.bead };
      };
      const rec = [null, null, null, null, null];
      const wrapOthers = i => function (s, pid, legal) { const r = asChooser(FN[pick[i - 1]])(s, pid, legal); rec[pid] = { key: r.key, target: r.target, target2: r.target2, bead: r.bead }; return r; };
      /* 被测席每回合的 pick 也要落进 rec（重放需要它当"别人的动作不变"的那一份） */
      const subjectWrap = function (s, pid, legal) { const r = subject(s, pid, legal); rec[pid] = { key: r.key, target: r.target, target2: r.target2, bead: r.bead }; return r; };
      Play.autoGameN(st, [subjectWrap, wrapOthers(1), wrapOthers(2), wrapOthers(3), wrapOthers(4)]);
      /* —— 重放评估放在整局跑完后另行一遍（见 scoreRound），这里先把每回合的原料攒下来 —— */
      void rr;
    }
  }
  return acc;
}
/* 上面那个循环只负责"把每回合的原料收下来"，真正的 regret 在 collect() 里算：
   这样重放时别人的动作是**那一局真发生的**，符合"固定他人、只换我"的反事实定义。 */
function collect(file) {
  const params = loadParams(file);
  const rows = [];
  let decIdx = 0;
  for (let t = 0; t < TABLES; t++) {
    const r0 = T.mulberry32(SEED + t * 7919);
    const pick = []; while (pick.length < 4) { const n = NAMES[Math.floor(r0() * NAMES.length)]; if (pick.indexOf(n) < 0) pick.push(n); }
    for (let g = 0; g < GAMES; g++) {
      const st = S.createState('multi', { next: T.mulberry32(SEED + t * 104729 + g) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(SEED + t * 104729 + g);
      let snap = null, use = null, decSeed = 0, decCands = null;
      const subjectWrap = function (s, pid, legal) {
        snap = S.cloneState(s); snap.rng = s.rng;
        decSeed = ((++decIdx) * 2654435761) >>> 6;
        const v7 = legal.filter(l => l.affordable);
        use = v7.length ? v7 : [{ key: R.SK.JI, affordable: true }];
        const cands = P.candidatesFor(s, pid, use, { lockTarget: false });
        decCands = cands;
        const f = P.forwardCands(s, pid, cands, params, { temp: 1 });
        let bi = 0; for (let i = 1; i < f.probs.length; i++) if (f.probs[i] > f.probs[bi]) bi = i;
        const c = cands[bi];
        const r = { key: c.key, target: c.target == null ? null : c.target, target2: c.target2, bead: c.bead };
        pend[0] = r; return r;
      };
      const pend = [null, null, null, null, null];
      const others = [];
      const mk = i => function (s, pid, legal) {
        const r = asChooser(FN[pick[i]])(s, pid, legal);
        pend[pid] = { key: r.key, target: r.target, target2: r.target2, bead: r.bead };
        return r;
      };
      /* 每回合在被测席决策点处抓一次"原料"：快照 + 候选表 + 该局稍后真发生的对手动作（延迟到回合结束再回填） */
      const onTurn = function () {
        if (!snap || !use || !decCands) return;
        /* ⚠ 候选表必须在**决策点当场**存下来，不许在回合末重算：
           `candidatesFor` 会消耗 `state.rng`（目标枚举要抽珠/打散并列），而快照的 rng 是按引用带过来的 ⇒
           重算出来的表与当时那张**不是同一张**，于是"我原来那一手"找不到、整批被判跳过 ⇒ regret 假 0。
           （这就是第一版全零的真因；与 §E150d 那两个"假 0"同族，都是量具自己空转。） */
        const cands = decCands;
        const mine = pend[0];
        const picks = pend.slice();
        if (mine) rows.push({ snap: snap, decSeed: decSeed, cands: cands, mine: mine, picks: picks });
        snap = null; use = null; pend[0] = pend[1] = pend[2] = pend[3] = pend[4] = null;
        others.length = 0;
      };
      Play.autoGameN(st, [subjectWrap, mk(0), mk(1), mk(2), mk(3)], onTurn, null);
    }
  }
  return { params, rows };
}
console.log('# §E152 引擎重放式 regret（固定他人本回合动作，只换被测方那一手） ‖ 桌=' + TABLES + ' × 局=' + GAMES + ' ‖ 模式=multi/5 人');
const out = [];
for (const file of PACKS.length ? PACKS : ['js/bundled-champion-3p.js']) {
  const { rows } = collect(file);
  const params = loadParams(file);
  let n = 0, r1 = 0, r2 = 0, hit1 = 0, hit2 = 0, pct1 = 0, pct2 = 0, candSum = 0, skipped = 0, withSpread = 0;
  for (const row of rows) {
    const cs = row.cands; if (!cs || cs.length < 2) { skipped++; continue; }
    const vals = [];
    for (let ci = 0; ci < cs.length; ci++) {
      const picks = row.picks.slice();
      picks[0] = { key: cs[ci].key, target: cs[ci].target == null ? null : cs[ci].target, target2: cs[ci].target2, bead: cs[ci].bead };
      const st = replay(row.snap, row.decSeed + ci * 7919, picks);
      vals.push({ v1: V1(st), v2: V2(st) });
    }
    const mx1 = Math.max(...vals.map(v => v.v1)), mx2 = Math.max(...vals.map(v => v.v2));
    const at = cs.findIndex(c => c.key === row.mine.key && (c.target == null ? null : c.target) === row.mine.target && c.bead === row.mine.bead);
    if (at < 0) { skipped++; continue; }
    n++; candSum += cs.length;
    r1 += mx1 - vals[at].v1; r2 += mx2 - vals[at].v2;
    if (vals[at].v1 >= mx1 - 1e-9) hit1++;
    if (vals[at].v2 >= mx2 - 1e-9) hit2++;
    /* 百分位（并列取中位）：**随机按构造 = 50**，所以它是比"抽样随机地板"干净的刻度。 */
    const pctl = (v, key) => {
      let lo = 0, eq = 0;
      for (const x of vals) { if (x[key] < v - 1e-9) lo++; else if (Math.abs(x[key] - v) <= 1e-9) eq++; }
      return 100 * (lo + eq / 2) / vals.length;
    };
    const p1 = pctl(vals[at].v1, 'v1'), p2 = pctl(vals[at].v2, 'v2');
    pct1 += p1; pct2 += p2;
    if (mx1 - Math.min(...vals.map(v => v.v1)) > 1e-9) withSpread++;
  }
  out.push({ file: (file.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '')), n, avg: candSum / Math.max(1, n),
    reg1: r1 / Math.max(1, n), reg2: r2 / Math.max(1, n), hit: 100 * hit1 / Math.max(1, n), hit2: 100 * hit2 / Math.max(1, n),
    pct1: pct1 / Math.max(1, n), pct2: pct2 / Math.max(1, n), spreadPct: 100 * withSpread / Math.max(1, n), skipped });
}
console.log('\n  包                   决策  候选/决策  regretV1  regretV2  打到最优V1  百分位V1  百分位V2  有价差%   跳过');
for (const o of out) {
  console.log('  ' + o.file.padEnd(20) + String(o.n).padStart(5) + String(o.avg.toFixed(1)).padStart(9) +
    o.reg1.toFixed(3).padStart(10) + o.reg2.toFixed(3).padStart(10) + (o.hit.toFixed(1) + '%').padStart(11) +
    o.pct1.toFixed(1).padStart(10) + o.pct2.toFixed(1).padStart(10) + o.spreadPct.toFixed(1).padStart(10) + String(o.skipped).padStart(8));
}
console.log('\n  刻度：百分位 = 被选中那手在本决策全部候选里的名次（并列取中位）⇒ **随机按构造 50、贪心上界按构造 100**，包落在中间才是可训练空间。');
console.log('    `有价差%` 是这个决策的候选之间 V1 是否真的有区别（没有区别 ⇒ 该决策不该记分，也是"包为什么常显得与随机同层"的分母解释）。');
console.log('\n  读法：`打到最优` 是命中率（并列算命中），regret 的单位是"血量优势"；**地板(随机) 那列是这一维有钱可赚的证据**——');
console.log('    若地板与包差不多 ⇒ 包在"给定他人本回合动作"的 1-ply 尺度上已接近随机同层，接适应度才有意义；若地板远大于 0 而包也远大于 0，才是可训练空间。');
console.log('  ⚠ 1-ply + 他人动作固定 ⇒ 这是"回合内贪心最优"，不是 Nash；用它当适应度会把策略推向贪心，需与胜负分一起看（§E153 的"只记录不判决"就是为这一步设的）。');
