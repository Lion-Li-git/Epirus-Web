#!/usr/bin/env node
/* ladder.mjs — **笨策略阶梯**：在同一套 arena（16 格 × N 局 × 同 temp）上，把"什么都不学"的几种固定打法摆成一排刻度
 * （千问 · 10-29 04:0x · §E824 V 波之后）
 *
 * 为什么今夜必须有它：V 波里 rollout 货币那五枚臂读出 **Δ夺1 +5.9 ~ +8.4pt**（五枚同号、过线），
 *   看起来像"稠密同向标签第一次兑现"。把它们的行为剖面拉出来一看：`族 d:99.5%`——**四枚不同 seed 的臂退化成同一只"只按架势"的笨蛋**
 *   （夺1 逐字节相同：26.8 / 26.8 / 26.8 / 26.6），而它们的留出 CE（2.13~2.18）**还高于平坦地板 ln n = 1.873**
 *   ⇒ 货币根本没给出梯度，涨的那 8pt 是"退化成固定一族的动作"在**这套 arena 里本来就值钱**。
 * ⇒ 所以"Δ vs 随机起点"这把尺缺一个下限锚：**得先知道一只从不学习的笨蛋能拿多少**，否则退化会被读成进步。
 *   这里摆五种：只按架势 ‖ 只开枪ジ ‖ 只蓄能 ‖ 均匀乱选合法候选 ‖ 参照包 v7（同场当上限刻度）。
 *
 * ⚠ 三条口径声明：
 *   ① 固定打法走的是**我这里的候选面**（`lockTarget:false`），与引擎比赛那条路的 `lastCancelOther` 目标锁不同 ⇒
 *      与 `profile2`/`mixprobe` 的臂行并排读**绝对值**时，把这半格差记住（mixprobe 第一次就栽在这里：q=1 差过 6.8pt）。
 *   ② `temp` 只影响 v7 那一行（其余是确定性/自带定标流），所以阶梯内可比、跨 temp 不可比。
 *   ③ 每个策略都跑**同一批局号**（`1000 + n*97 + idx + g*7919`）⇒ 分母逐字相等，不做"各自换一批桌"。
 * 用法：node tools/proto2/ladder.mjs [--games=120] [--temp=0.001] [--only=guard,ji,charge,rand,v7]
 */
import { sandbox, loadChamp } from '../audit-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Math.max(4, Number(arg('games', 120)) || 120);
const TEMP = Number(arg('temp', 0.001));
const ONLY = String(arg('only', 'guard,ji,charge,rand,v7')).split(',').filter(Boolean);
/* `--sweep=keys` ⇒ 把 30 个技能键**各当一条固定打法**跑一遍。
 *   动因（04:0x）：rollout 货币那批臂读出 Δ夺1 +8pt 而剖面是 `d:99.5%`——但"只按架势"这一条固定打法只有 6.8%，
 *   所以真正要问的是**"有没有哪一枚单技能固定打法本来就值 26%"**：有的话，那 8pt 就不是"标签教出来的"，是"退化成那一枚技能"。 */
const SWEEP = arg('sweep', '') === 'keys';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, Play = W.EpirusPlay;
let ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
if (!ref) { console.error('⛔ 参照包读不出'); process.exit(2); }
ref = Float64Array.from(ref);
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const POOL = (function () { const real = Math.random; try { Math.random = mulberry(20261029); return T.buildOpps(ref, 0.05); } finally { Math.random = real; } })();
const STYLES = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
const CELLS = [];
for (const n of [3, 5]) for (const nm of STYLES) { const i = POOL.findIndex((o) => o.name === nm); if (i >= 0) CELLS.push({ n, name: nm, idx: i }); }
const GUARD = R.GUARD_FAMILY || [];

function candsOf(state, pid, legal) {
  return P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
}
/* 各固定打法的"选哪一枚"规则（找不到目标动作就退回ジ） */
function pickBy(pred) {
  return function (state, pid, legal) {
    const cs = candsOf(state, pid, legal);
    if (!cs.length) return { key: R.SK.JI };
    for (const c of cs) if (pred(c)) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    const ji = cs.filter((c) => c.key === R.SK.JI)[0] || cs[0];
    return { key: ji.key, target: ji.target == null ? null : ji.target, target2: null, bead: null };
  };
}
const POLICIES = {
  guard: { label: '只按架势', sel: pickBy((c) => GUARD.indexOf(c.key) >= 0) },
  ji: { label: '只开枪ジ', sel: pickBy((c) => c.key === R.SK.JI) },
  charge: { label: '只蓄能', sel: pickBy((c) => c.key === R.SK.CHARGE) },
  reflect: { label: '只镜面反射', sel: pickBy((c) => c.key === 'reflect') },
  armor: { label: '只装甲', sel: pickBy((c) => c.key === 'armor') },
  rand: { label: '均匀乱选', sel: null },   /* 用这一格自己的定标流抽 */
  v7: { label: '参照包 v7', sel: T.policyChooserN(ref, TEMP) },
};
const SHOW_CELLS = argv.includes('--cells=1');
function playCell(selFn, cell, rstream) {
  let f = 0, t2 = 0, sv = 0, rd = 0, acts = 0, cat = {};
  const CAT = {}; R.skills.forEach((s) => { CAT[s.key] = s.cat; });
  for (let g = 0; g < GAMES; g++) {
    const seat = g % cell.n;
    const choosers = [];
    for (let pid = 0; pid < cell.n; pid++) {
      if (pid !== seat) { choosers.push(POOL[(cell.idx + 1 + pid) % POOL.length].sel); continue; }
      if (rstream) choosers.push(function (st, p, legal) {
        const cs = candsOf(st, p, legal);
        if (!cs.length) return { key: R.SK.JI };
        const c = cs[Math.floor(rstream() * cs.length)];
        return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
      });
      else choosers.push(selFn);
    }
    const rm = T.oneGameN(choosers, 1000 + cell.n * 97 + cell.idx + g * 7919, cell.n, { regen: 0, mode: 'multi' });
    const st = rm.state, myHp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    let ahead = 0;
    for (let i = 0; i < cell.n; i++) if (i !== seat) { const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0; if (h > myHp + 1e-9 || (Math.abs(h - myHp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++; }
    if (rm.winner === seat) f++;
    if (ahead <= 1) t2++;
    if (myHp > 0) sv++;
    rd += rm.rounds || 0;
    for (const e of (st.events || [])) if (e.type === 'action' && e.pid === seat) { acts++; const k = CAT[e.key] || '?'; cat[k] = (cat[k] || 0) + 1; }
  }
  return { f, t2, sv, rd, acts, cat };
}
console.log('# 笨策略阶梯 ‖ ' + CELLS.length + ' 格 × ' + GAMES + ' 局（同批局号）‖ temp=' + TEMP + ' ‖ 候选面 lockTarget:false（与引擎比赛那条路差半格，见文件头 ①）');
const tot = [];
for (const key of ONLY) {
  const pol = POLICIES[key];
  if (!pol) { console.log('  ⚠ 不认识的策略 `' + key + '`（可用：' + Object.keys(POLICIES).join(',') + '）'); continue; }
  let F = 0, T2 = 0, SV = 0, RD = 0, AC = 0, CT = {};
  for (let i = 0; i < CELLS.length; i++) {
    const rs = key === 'rand' ? mulberry(5150 + i * 7919) : null;
    const a = playCell(pol.sel, CELLS[i], rs);
    F += a.f; T2 += a.t2; SV += a.sv; RD += a.rd; AC += a.acts;
    for (const k in a.cat) CT[k] = (CT[k] || 0) + a.cat[k];
    if (SHOW_CELLS) {
      const share = (100 * ((CT.energy || 0) + (CT.attack || 0) + (CT.defense || 0) + (CT.special || 0)) / Math.max(1, a.acts));
      console.log('    · 格 ' + CELLS[i].name.padEnd(11) + ' n=' + CELLS[i].n + ' ‖ 夺1 ' + (100 * a.f / GAMES).toFixed(1) + '% ‖ 前2 '
        + (100 * a.t2 / GAMES).toFixed(1) + '% ‖ 活到终局 ' + (100 * a.sv / GAMES).toFixed(1) + '% ‖ 局长 ' + (a.rd / GAMES).toFixed(1)
        + (Number.isFinite(share) ? '' : ''));
    }
  }
  const G = CELLS.length * GAMES;
  const fam = ['energy', 'attack', 'defense', 'special'].map((k) => k[0] + ':' + (100 * (CT[k] || 0) / Math.max(1, AC)).toFixed(1) + '%').join(' ');
  console.log('  ' + pol.label.padEnd(9) + ' ‖ 局 ' + G + ' ‖ 夺1 ' + (100 * F / G).toFixed(1) + '% ‖ 前2 ' + (100 * T2 / G).toFixed(1)
    + '% ‖ 活到终局 ' + (100 * SV / G).toFixed(1) + '% ‖ 局长 ' + (RD / G).toFixed(1) + ' ‖ 出手/局 ' + (AC / G).toFixed(2) + ' ‖ 族 ' + fam);
  tot.push({ key, label: pol.label, win: 100 * F / G });
}
tot.sort((a, b) => b.win - a.win);
console.log('⇒ 阶梯（夺1 从高到低）：' + tot.map((t) => t.label + ' ' + t.win.toFixed(1) + '%').join('  ‖  '));
const lo = tot[tot.length - 1], hi = tot.filter((t) => t.key === 'v7')[0];
if (hi && lo) console.log('  ⇒ 这只尺的可用区间是 [' + lo.win.toFixed(1) + '%（' + lo.label + '） … ' + hi.win.toFixed(1) + '%（v7）]'
  + ' ‖ 任何臂落进这个带的**下半段**时，先问它是不是退化了，再问它学了什么');
if (SWEEP) {
  console.log('\n# 逐技能固定打法（每枚都跑同一批 16 格 × ' + GAMES + ' 局）');
  const res = [];
  for (const sk of R.skills) {
    const sel = pickBy((c) => c.key === sk.key);
    let F = 0;
    for (let i = 0; i < CELLS.length; i++) F += playCell(sel, CELLS[i], null).f;
    res.push({ key: sk.key, cat: sk.cat, win: 100 * F / (CELLS.length * GAMES) });
    console.log('  ' + sk.key.padEnd(10) + ' (' + sk.cat[0] + ') ‖ 夺1 ' + res[res.length - 1].win.toFixed(1) + '%');
  }
  res.sort((a, b) => b.win - a.win);
  console.log('⇒ 单技能阶梯（前 8）：' + res.slice(0, 8).map((r) => r.key + ' ' + r.win.toFixed(1) + '%').join('  ‖  '));
  console.log('   末 3：' + res.slice(-3).map((r) => r.key + ' ' + r.win.toFixed(1) + '%').join('  ‖  '));
  console.log('   ⚑ 用法：把某枚臂的 Δ夺1 与这条阶梯并排——**臂的读数若落在某枚单技能附近，就不能说"标签教出了强度"**，只能说"它退化成那一枚"。');
}
