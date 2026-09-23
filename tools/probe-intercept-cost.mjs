/* 拦截代价表（v1.5.191 · 只读，不写任何产物、不换包）
 *
 * 要回答的是用户那句判断：**"当前的线上包技能广度太差 —— 它为了防止技能被拦截、降低 Geff，倾向于完全不用可能被拦截的技能。"**
 * 这句话里有两件事混在一起，必须拆开：
 *   ① 这张卡**真的**会被挡吗？挡它的成本是多少（花的 ep / 弹回来的血 / 白扔的一手）？
 *   ② 在"会防的场"与"不会防的场"里，强制用它各是赚还是亏？
 *      ⇒ 只有 **两场都赚却仍不用** 才叫惰性（该动探索/经济）；
 *        若 **会防场亏、不防场赚**，那"不用它"是**理性** ⇒ 该动的是"先清防再打"的能力（判据层），逼它用只会更差。
 *
 * 判读规则（跑之前写死；**中途改过两次，两次都是我自己判错的，理由记在下面**）：
 *   - `U 未测到`优先于一切：强制场里出手 < 0.5 次/局 ⇒ "被挡率 0%"不是证据
 *     （第一版我就差点把"4 个对手猛攻 ⇒ 受评席 4 回合就死 ⇒ 轮不到出手"读成"拦截不成立"——本仓门 L2 那句原话）
 *   - `C`：三个场的基线都贴 0%/100% ⇒ 该场无分辨空间，不硬判
 *   - `N 拦截解释不成立`：混合场被挡率 < 10%
 *   - `R 理性回避`：被挡率 ≥ 10% 且**两场符号翻转**（会防场显著亏 · 不防场显著赚）
 *     ⇒ 该动的是"先清防再打"的能力（判据层），逼它用只会更差
 *   - `L 惰性回避`：被挡率高、但 **Δ混合 > 0** ⇒ 在会防的场里强制用它仍然比冠军自由发挥强
 *     ⇒ 它躲的不是被挡的事实，是"怕被挡"的印象 ⇒ 这才是奖励面/探索该管的事
 *   - 其余 ⇒ `?`；`拦截代价 = Δ混合 − Δ不防` 只当**机制列**（同卡同种子同惩罚 ⇒ 相减只剩拦截），不单独定判读
 *   ⚠️ 改过两次（都写进来防再犯）：
 *     ① 第一版拿 `Δ混合 < 0` 单独当"理性"证据 —— 但 ε=1 的"强制只用这一招"自带"只会一招"的惩罚，
 *        任何弱卡两场都为负（实测 ジ −47/−11、雷击之枪 −61/−25）⇒ 会把"单调"误读成"被挡"。⇒ 改成要求**符号翻转**。
 *     ② 第二版又把判读整个交给"交互项为负"，于是一张"会防场里仍然更赚"的卡（大雷）被判成"理性回避"——
 *        与它 Δ混合 = +32pt 直接矛盾 ⇒ 判读必须看**绝对水平**（Δ混合），交互项退回当机制列。
 *
 * 归因口径（先看发射端，别猜字段）：
 *   - 出手 = `action{pid:受评席, key, outcome:'ok'}`（`voided`/`insufficient` 一律不算，与 `countBigCards` 同口径）
 *   - 被挡 = `blocked{via:key}`，`by` 给的是**哪张防御卡**挡的（防御/反弹/藤甲/八卦阵/金刚盾/原型制御）
 *   - 被弹 = `reflect{via:key, from:受评席}`；弹回来的血 = `damage{to:受评席, via:key}`
 *   - ⚠️ `blocked` 事件**没有 `source`** ⇒ 想按"我这一手"归因，必须保证**场上只有我在用这张卡**：
 *     所以所有对手 chooser 的 `legal` 里都**剔掉被测卡**（两臂同剔 ⇒ Δ 仍然只反映"我用不用它"的差）。
 *
 * 用法：node tools/probe-intercept-cost.mjs [--pack=js/bundled-champion-3p.js] [--mode=multi] [--n=5]
 *        [--games=120] [--only=bigT,gun] [--json]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const arg = function (k, d) {
  const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; });
  return h ? h.split('=')[1] : d;
};
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const MODE = arg('mode', 'multi');
const N = Number(arg('n', 5));
const GAMES = Number(arg('games', 120));
const ONLY = String(arg('only', '')).split(',').filter(Boolean);
const SEED0 = Number(arg('seed', 20260923));
/* 定向垫钱（默认开）：两臂同垫到"刚够这张卡" ⇒ 钱相同，差别只在用不用它。
 * 关掉（`--grant=0`）就是纯原生经济 —— 那正是本探针要**避免**的口径：贵卡会因为"活不到有钱"而根本测不到，
 * 于是"被挡率 0%"读起来像"拦截解释不成立"，实际是**没测到**（本仓门 L2 那句原话）。 */
const GRANT_CARD = String(arg('grant', 'card')) !== '0';
const TEMP = 0.15;

const sb = {
  console: { log: function () { }, warn: function () { }, error: console.error },
  Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date
};
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
vm.runInNewContext(readFileSync(PACK, 'utf8'), sb, { filename: PACK });
const R = sb.window.EpirusRules, T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots;
const srcTxt = readFileSync(PACK, 'utf8');
const packObj = /window\.EPIRUS_CHAMPION_3P\s*=/.test(srcTxt) ? sb.window.EPIRUS_CHAMPION_3P : sb.window.EPIRUS_CHAMPION;
const params = P.unpack(packObj, true);
if (!params) { console.error('⛔ 冠军包解不开：' + PACK); process.exit(2); }

/* 防御族 = 规则表里的 `GUARD_FAMILY`（单一来源；本仓为"手写正则漏掉金刚盾"栽过一次，见 D117） */
const GUARD = R.GUARD_FAMILY;
const isGuard = function (k) { return GUARD.indexOf(k) >= 0; };
const SKILLS = (R.MODES[MODE].skills || R.AVAILABLE_MULTI).map(function (e) { return (typeof e === 'string') ? e : e.key; })
  .filter(function (k) { return !isGuard(k); });   // 防御卡自己不进这张表（它不会被自己挡）

/* 三种对手场：会防 / 不会防 / 只反弹（把"挡"与"弹"分开，它们的代价完全不同）
 * ⚠️ 两端场都会撞天花板/地板（实测：`nodef` 里基线就 100% 赢、`def` 里基线与强制臂一起 0% 赢）
 *   ⇒ 那种 Δ=0 不是"这张卡无所谓"，是**没有分辨空间**。所以加中间场 `mix`（一半席设防、一半席猛攻），
 *   并在判读里把"天花板/地板"单独记 **C**，不参与 R/L/N 的判断。 */
/* 进攻侧不许用"只会猛攻"的单一线：实测 `pickAggro` 当对手时基线 100% 赢 ⇒ Δ 只能 ≤0，
 * R/L 两类**结构上不可能出现**（这是设计错，不是结论）。换成与门禁/其它探针同批的轮换线池。 */
const ATK_POOL = [B.pickAggro, B.pickBalanced, B.pickMix, B.pickBeadBurst, B.pickComboCounter];
const defPick = function (legal) {
  const g = legal.filter(function (l) { return isGuard(l.key) && l.affordable; });
  return g.length ? { key: g[0].key } : null;
};
const atkPick = function (st, pid, legal) {
  const line = ATK_POOL[pid % ATK_POOL.length];
  return line(st, pid, legal.filter(function (l) { return !isGuard(l.key); })) || { key: 'ji' };
};
const FIELDS = [
  { id: 'def', label: '会防（每回合优先设防）', pick: function (st, pid, legal) { return defPick(legal) || atkPick(st, pid, legal); } },
  { id: 'mix', label: '混合（半数席设防·半数猛攻）', pick: function (st, pid, legal) {
    if (pid % 2 === 0) { const d = defPick(legal); if (d) return d; }
    return atkPick(st, pid, legal);
  } },
  { id: 'nodef', label: '不会防（永不设防，只打）', pick: function (st, pid, legal) { return atkPick(st, pid, legal); } },
  { id: 'reflect', label: '只反弹（reflect/armor 族）', pick: function (st, pid, legal) {
    const g = legal.filter(function (l) { return (l.key === R.SK.REFLECT || l.key === R.SK.ARMOR) && l.affordable; });
    if (g.length) return { key: g[0].key };
    const other = legal.filter(function (l) { return isGuard(l.key) && l.affordable; });
    if (other.length) return { key: other[0].key };
    return atkPick(st, pid, legal);
  } }
];

function baseSel() { return T.policyChooserN(params, TEMP); }

/* 跑一格：injectKey=null ⇒ 基线臂；否则受评席**只要合法且买得起就用这张卡**（ε=1 的强制口径）
 * 对手一律禁用被测卡（否则 `blocked` 没有 `source`，归因会混进别人的手）。
 * ⚠️ 可测性（第一版就栽在这上面）：4 个对手猛攻时受评席**平均 4 回合就死**，2 ジ 以上的卡一次都轮不到 ⇒
 *   只报"被挡率 0%"会把**没测到**误判成"拦截解释不成立"（本仓门 L2 那句原话）。所以：
 *   ① `--grant=card`（默认开）每回合把**受评席**的 ep 垫到刚够这张卡，**两臂同垫** ⇒ 钱相同，Δ 只反映用不用它；
 *   ② 记 `chance`（这卡合法且买得起的回合数）与 `rounds`（活了几回合）⇒ 出手太少时判"未测到"，不判方向。 */
function run(field, injectKey, games, seedBase) {
  const s = { first: 0, casts: 0, blocked: 0, reflected: 0, backDmg: 0, dealt: 0, epSpent: 0, rounds: 0, chance: 0, perGame: [], byWho: {} };
  const need = injectKey && R.byKey[injectKey] ? (R.byKey[injectKey].cost || 0) : 0;
  for (let g = 0; g < games; g++) {
    const seed = seedBase + g * 7919;
    const seat = g % N;
    const bs = baseSel();
    const hook = GRANT_CARD ? function (state) {
      const q = state.p[seat];
      if (q && q.hp > 0 && need > 0 && q.ep < need) q.ep = need;   // 两臂同垫：基线臂也垫，只是它不强制用
    } : undefined;
    const ch = [];
    for (let pid = 0; pid < N; pid++) {
      if (pid === seat) {
        ch.push(function (state, p2, legal) {
          if (!injectKey) return bs(state, p2, legal);
          const l = legal.find(function (x) { return x.key === injectKey && x.affordable; });
          if (!l) return bs(state, p2, legal);
          s.chance++;
          const t = T.pickTargetN(state, p2, injectKey);
          return t == null ? { key: injectKey } : { key: injectKey, target: t };
        });
      } else {
        ch.push(function (state, p2, legal) {
          const allowed = legal.filter(function (x) { return x.key !== injectKey; });
          const r = field.pick(state, p2, allowed);
          return (r && allowed.some(function (x) { return x.key === r.key; })) ? r
            : (allowed[0] ? { key: allowed[0].key } : { key: 'ji' });
        });
      }
    }
    const r = T.oneGameN(ch, seed, N, { mode: MODE, onRoundStart: hook });
    const evs = r.state.events;
    const cost = injectKey && R.byKey[injectKey] ? (R.byKey[injectKey].cost || 0) : 0;
    for (const e of evs) {
      if (e.type === 'action' && e.pid === seat && e.outcome === 'ok') {
        if (!injectKey || e.key === injectKey) { s.casts++; s.epSpent += (R.byKey[e.key] ? (R.byKey[e.key].cost || 0) : 0); }
      } else if (e.type === 'blocked' && (!injectKey || e.via === injectKey)) {
        s.blocked++; s.byWho[e.by] = (s.byWho[e.by] || 0) + 1;
      } else if (e.type === 'reflect' && (!injectKey || (e.via === injectKey && e.from === seat))) {
        s.reflected++; s.byWho['弹回:' + (e.by || '')] = (s.byWho['弹回:' + (e.by || '')] || 0) + 1;
      } else if (e.type === 'damage') {
        if (e.source === seat && (!injectKey || e.via === injectKey)) s.dealt += (e.amt || 0);
        if (e.to === seat && (!injectKey || e.via === injectKey) && e.source !== seat) s.backDmg += (e.amt || 0);
      }
    }
    s.rounds += r.state.round;
    const win = T.rankOf(r.state, seat, seed) === 1 ? 1 : 0;
    s.first += win; s.perGame.push(win);
  }
  return { first: s.first / games, games: games, wins: s.perGame, st: s };
}

/* 噪声地板：同口径换一批种子跑基线 ⇒ 两场各自的基线差 = 本表固有噪声（Δ 小于它不判方向） */
function paired(base, arm) {
  const n = Math.min(base.wins.length, arm.wins.length);
  let sm = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const d = arm.wins[i] - base.wins[i]; sm += d; s2 += d * d; }
  const mean = sm / n;
  const varr = n > 1 ? Math.max(0, (s2 - n * mean * mean) / (n - 1)) : 0;
  return { d: mean, se: n > 1 ? Math.sqrt(varr / n) : 0, n: n };
}

console.log('# 拦截代价表 · 包=' + PACK + ' 模式=' + MODE + ' n=' + N + ' 每格 ' + GAMES + ' 局 · 强制口径 ε=1（合法且买得起就用）' +
  ' · 对手一律禁用被测卡（否则 blocked 无 source，归因会混）');
const rows = [];
for (const fld of FIELDS) {
  const base = run(fld, null, GAMES, SEED0);
  for (const k of (ONLY.length ? SKILLS.filter(function (x) { return ONLY.indexOf(x) >= 0; }) : SKILLS)) {
    const arm = run(fld, k, GAMES, SEED0);
    const pd = paired(base, arm);
    const def = R.byKey[k] || {};
    rows.push({ field: fld.id, key: k, name: def.name || k, cost: def.cost,
      casts: arm.st.casts / GAMES, chance: arm.st.chance / GAMES, rounds: arm.st.rounds / GAMES,
      blockRate: arm.st.casts ? (arm.st.blocked + arm.st.reflected) / arm.st.casts : 0,
      dealt: arm.st.dealt / GAMES, backDmg: arm.st.backDmg / GAMES, ep: arm.st.epSpent / GAMES,
      d: pd.d, se: pd.se, who: arm.st.byWho, baseFirst: base.first });
  }
}
const byKey = {};
for (const r of rows) (byKey[r.key] = byKey[r.key] || {})[r.field] = r;
console.log('# 各场基线 1st（不注入 = 冠军自由发挥）：' + FIELDS.map(function (f) {
  const one = rows.filter(function (r) { return r.field === f.id; })[0];
  return f.id + '=' + (one ? (100 * one.baseFirst).toFixed(0) : '?') + '%';
}).join(' · ') + '  ⇒ 基线贴 0% 或 100% 的场，Δ 没有分辨空间（记 C）');

/* 判读（规则在文件头写死；主判场 = `mix`（半数设防），`def/nodef` 是机制对照） */
const out = [];
for (const k in byKey) {
  const m = byKey[k], def = m.def, nodef = m.nodef, mix = m.mix, refl = m.reflect;
  if (!mix || !nodef || !def) continue;
  const ceil = function (x) { return x.baseFirst >= 0.95 || x.baseFirst <= 0.05; };
  const sig = function (x) { return x.se > 0 && Math.abs(x.d) > 1.96 * x.se; };
  /* 判据（两条各管一半，缺一不可）：
   *   R 要求**两场符号翻转**（会防场显著亏 · 不防场显著赚）⇒ 这才把"只会一招的惩罚"与"被挡"分开：
   *     单调惩罚在两个场里都为负（实测 ジ −47/−11、雷击之枪 −61/−25 都是这种），只有真被挡的卡才会翻号。
   *   L 看 `Δ混合 > 0` —— 在**会防的场里**强制用它仍然比冠军自由发挥强 ⇒ 它躲的不是被挡的事实，是"怕被挡"的印象。
   * `拦截代价 = Δ混合 − Δ不防` 保留为**机制列**（同卡同种子同惩罚 ⇒ 相减只剩拦截），但它不单独定判读。 */
  const cost = mix.d - nodef.d;
  const costSe = Math.sqrt(mix.se * mix.se + nodef.se * nodef.se);
  const sigCost = costSe > 0 && Math.abs(cost) > 1.96 * costSe;
  let cls = '?';
  if (mix.casts < 0.5) cls = 'U';                                    // 未测到：强制场里根本没出手
  else if (ceil(mix) && ceil(def) && ceil(nodef)) cls = 'C';          // 三个场都贴边 ⇒ 无从分辨
  else if (mix.blockRate < 0.10) cls = 'N';                           // 拦截解释不成立（这张卡基本不被挡）
  else if (sig(mix) && sig(nodef) && mix.d < 0 && nodef.d > 0) cls = 'R';   // 理性回避：符号翻转才是挡造成的
  else if (sig(mix) && mix.d > 0) cls = 'L';                                  // 惰性回避：会防场里用它还是赚
  out.push({ key: k, name: def.name, cost: def.cost, blockRate: mix.blockRate,
    dMix: mix.d, dDef: def.d, dNodef: nodef.d, dRefl: refl ? refl.d : 0,
    interceptCost: cost, costSe: costSe, sigCost: sigCost,
    seMix: mix.se, seNodef: nodef.se, casts: mix.casts, chance: mix.chance, rounds: mix.rounds,
    dealt: mix.dealt, backDmg: mix.backDmg, ep: mix.ep, cls: cls, who: mix.who });
}
out.sort(function (a, b) { return b.blockRate - a.blockRate; });
console.log('# 卡名           费用  混合场被挡率  Δ混合  Δ会防  Δ不防  **拦截代价(Δ混合−Δ不防)**  出手/局  伤害/局  弹回自伤  判读');
for (const r of out) {
  console.log('  ' + (r.name + '          ').slice(0, 12).padEnd(12) + String(r.cost).padStart(3) + '      ' +
    (100 * r.blockRate).toFixed(0).padStart(4) + '%    ' +
    (100 * r.dMix >= 0 ? '+' : '') + (100 * r.dMix).toFixed(0).padStart(5) + ' ' +
    (100 * r.dDef >= 0 ? '+' : '') + (100 * r.dDef).toFixed(0).padStart(5) + ' ' +
    (100 * r.dNodef >= 0 ? '+' : '') + (100 * r.dNodef).toFixed(0).padStart(5) + '      ' +
    (100 * r.interceptCost >= 0 ? '+' : '') + (100 * r.interceptCost).toFixed(0).padStart(5) +
    (r.sigCost ? '*' : ' ') + '（±' + (196 * r.costSe).toFixed(0) + '） ' +
    r.casts.toFixed(1).padStart(5) + '  ' + r.dealt.toFixed(2).padStart(6) + '    ' + r.backDmg.toFixed(2).padStart(5) + '    ' + r.cls);
}
const cnt = { R: 0, L: 0, N: 0, U: 0, C: 0, '?': 0 };
for (const r of out) cnt[r.cls] = (cnt[r.cls] || 0) + 1;
console.log('# 判读合计：R 理性回避=' + cnt.R + ' · L 惰性回避=' + cnt.L + ' · N 拦截解释不成立=' + cnt.N +
  ' · U 未测到=' + cnt.U + ' · C 撞天花板/地板=' + cnt.C + ' · ? 读不出=' + cnt['?'] + '（* = 交互项过 1.96·SE）');
console.log('# 规则：R=被挡率≥10% 且**两场符号翻转**（会防场显著亏·不防场显著赚）⇒ "不用它"是理性，该动"先清防再打"（判据层），逼它用只会更差；' +
  'L=被挡率高但 Δ混合>0 ⇒ 在会防的场里用它仍然比冠军自由发挥强 ⇒ 不用它是**惰性**（躲的是"怕被挡"的印象，不是被挡的事实）；' +
  'N=被挡率<10%；U=出手<0.5/局（没测到）；C=基线贴边（无分辨空间）。`拦截代价`=Δ混合−Δ不防 是**机制列**（同卡同种子同惩罚 ⇒ 相减只剩拦截），不单独定判读');
if (process.argv.indexOf('--json') >= 0) console.log(JSON.stringify({ games: GAMES, mode: MODE, pack: PACK, rows: rows, judged: out }));
