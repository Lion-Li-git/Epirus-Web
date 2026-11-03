#!/usr/bin/node
/* ============================================================================
 * probe-round1-open.mjs —— 用户 09-29 上午的裁定请求：**首回合那手【防御】是谁选的？**
 *
 * 病（用户实机 `results/G08-71/`）：第 1 回合有 AI 摆【防御】，而那一回合**谁也没打谁**
 *   ⇒ 白站一晚上的架势，还少拿 1 ジ（防御与 ジ 都是 0 ジ 卡，同回合二选一）。
 *   用户的判断是"前端随机性注入太早"，并提出"让随机性在第 1~3 回合逐步提升"。
 *
 * 这条病**不是新病**：`js/ui/ui.js:464` 那行 `pickChampion(..., 0.15, 0.2, 5, 'soft')` 是 v1.5.139→141
 *   两次用户裁定叠出来的，而 v1.5.141 的 `soft` 已在结构上封死"探索凭空造一个防御"
 *   （`if (g.key===RING || gcat===DEFENSE) pick=g;` + 探索集 `pool=nonDef`）。
 *   ⇒ 所以**要么防御来自温度采样（softmax 0.15 自己抽的），要么来自贪心本身（包就是这么想的）**。
 *   两种归因的修法完全不同：前者只改 `js/ui/ui.js` 那一行（不在指纹里），后者要动 `policy.js`（⚠ 在指纹里）或换包。
 *
 * 用法：
 *   node tools/probe-round1-open.mjs --packs=<a.bak>,<b.bak> [--labels=现役,挑战者]
 *        [--games=400] [--draws=20000] [--n=5] [--seed=71]
 *        [--configs=ui,noeps,greedy,ramp_eps,ramp_all,ramp_notemp1] [--out=<tsv>]
 *
 * ⚠ 三条口径：
 *   1) **只读探针**：不改任何 js/、不碰门禁、不碰冠军槽；全部结论来自引擎里真跑。
 *   2) **装配逐字复刻页面**：`legal.filter(affordable)` → `pickChampion` → `finish()` 补目标
 *      （`DUAL_GUN/MIRROR` 的 t2 口径、`bead` 透传都照 `js/ui/ui.js:433-464`）⇒ 量到的就是页面里那台 AI。
 *   3) **A 段是"精确分布"不是对局估计**：第 1 回合各座位状态逐位相同（`ep=0`、无珠、无冷却、对手同构）
 *      ⇒ 首手分布与座位无关，只需在同一张初局面上换 rng 重抽。脚本自带 seat-invariance 自检，
 *      若各座位分布其实不同会**自己喊出来**，不会静默把口径用错。
 * ==========================================================================*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import vm from 'node:vm';
import { rejectUnknownFlags } from './audit-lib.mjs';   /* v1.5.323：输入消毒层（仓规：不认识的 -- 参数必须响亮失败） */
rejectUnknownFlags(process.argv.slice(2), ['configs', 'draws', 'filterfix', 'filterge2', 'games', 'instrument', 'labels', 'mirror', 'mirror-games', 'mmode', 'n', 'out', 'packs', 'seed'], 'probe-round1-open');   /* v1.5.323 */

const arg = function (k, d) { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').filter(Boolean);
const LABELS = String(arg('labels', '')).split(',').filter(Boolean);
const GAMES = Number(arg('games', 400));
const DRAWS = Number(arg('draws', 20000));
const N = Number(arg('n', 5));
const SEED = Number(arg('seed', 71));
const OUT = arg('out', '');
const MIRROR = arg('mirror', '0') === '1';
/* M 段的考场模式：`multi`=3 血（默认，与其余段同口径）；**`long`=5 血长程**，那才是 v1.5.139 记
 * "ε=0 ⇒ 104 回合 0% 决胜 / ε.4~.5 top5 ⇒ ~30 回合 100%"的原始夹具。要判"降低探索池会不会把镜像堵回去"，
 * 必须在这一档上量，3 血档两边都轻松决胜、没有判别力。 */
const MMODE = arg('mmode', 'multi');
const MGAMES = Number(arg('mirror-games', 300));
if (MIRROR && (!Number.isFinite(MGAMES) || MGAMES < 1 || Math.floor(MGAMES) !== MGAMES)) { console.error('--mirror-games 必须是 ≥1 整数'); process.exit(2); }

if (PACKS.length === 0) { console.error('用法：--packs=<包1>,<包2>（逗号分隔；探针不默认用出厂包，免得把"没指定"读成"现役"）'); process.exit(2); }
if (!Number.isFinite(GAMES) || GAMES < 1 || Math.floor(GAMES) !== GAMES) { console.error('--games 必须是 ≥1 整数（实测 `' + arg('games', '400') + '`）'); process.exit(2); }
if (!Number.isFinite(DRAWS) || DRAWS < 1 || Math.floor(DRAWS) !== DRAWS) { console.error('--draws 必须是 ≥1 整数（实测 `' + arg('draws', '20000') + '`）'); process.exit(2); }
if (!(N >= 3 && N <= 5)) { console.error('本探针按 3~5 人局装配（实测 --n=' + N + '）'); process.exit(2); }
for (const p of PACKS) if (!existsSync(p)) { console.error('--packs 里有文件不存在: ' + p); process.exit(2); }

/* ---------- 引擎沙箱（与 eval-5p / probe-5p-envfit 同一份文件清单）---------- */
/* ⚠ `--instrument=1` / `--filterge2=1` 会**改写 evo.js 的源码文本**再灌进沙箱（手法与
 *   `tools/probe-layer-caliber.mjs` 一致，门 D150 钉的就是那种"按字面量替换"）。
 *   ⇒ 这两档量的是"改后的那份"，不是仓库里的那份；每处替换都断言命中 1 次，命中数不对直接抛。
 *   ⇒ 进程只 boot 一次，所以两档各跑一个进程，不要在同一进程里混。 */
const INSTR = arg('instrument', '0') === '1';
/* ===== v1.5.304：方向翻转了，别再用旧旗标名 =====
 * 仓库默认现在**就是** `nonDef.length >= 1`（用户 09-29 下午委托裁定采纳），所以本探针的对照档
 * 变成"**把门槛退回 ≥2**"＝复现 v1.5.303 之前那扇门（§E145 量到"凭空防御"的那个根因）。
 * 旧名 `--filterfix` 已废弃并**响亮拒绝**：它的语义随默认值反了，留着会让人以为自己在测"改动后"，
 * 而实际上测的是改动前 —— 这是本仓那一族"旗标名与默认值脱钩"的错（同 D202 ⑥ 的字段名病）。 */
if (process.argv.some(a => a.indexOf('--filterfix') === 0)) {
  console.error('⛔ `--filterfix` 已废弃：仓库默认自 v1.5.304 起就是 nonDef.length >= 1。' +
    '要测**旧行为**请用 `--filterge2=1`（把门槛退回 ≥2 做对照）。');
  process.exit(2);
}
const FILTERGE2 = arg('filterge2', '0') === '1';
const PATCHES = [];
if (FILTERGE2) {
  PATCHES.push({
    find: 'if (nonDef.length >= 1) pool = nonDef;',
    to: 'if (nonDef.length >= 2) pool = nonDef;',
    why: '把"剔掉防御键"的门槛从 ≥1 退回 ≥2 ⇒ nonDef 只剩 ジ 一张时剔除**不生效**，探索池里放回防御键，' +
         'ε 又能"凭空摆一个架势"。（这是 §E145 定位到的那扇门的**旧档**，现在是对照组）'
  });
}
if (INSTR) {
  PATCHES.push({
    find: '          pick = cands[keyIdx[top[Math.floor(state.rng.next() * top.length)]]];',
    to: '          { const I = globalThis.EPIRUS_INSTR || (globalThis.EPIRUS_INSTR = { fire: {}, poolw: {}, topdef: {}, epick: {} });' +
        ' const r = state.round; I.fire[r] = (I.fire[r] || 0) + 1; I.poolw[r] = (I.poolw[r] || 0) + top.length;' +
        ' let nd = 0; for (let ti = 0; ti < top.length; ti++) { if (R.byKey[top[ti]] && R.byKey[top[ti]].cat === R.CAT.DEFENSE) nd++; }' +
        ' if (nd) I.topdef[r] = (I.topdef[r] || 0) + 1; }\n' +
        '          pick = cands[keyIdx[top[Math.floor(state.rng.next() * top.length)]]];\n' +
        '          { const I = globalThis.EPIRUS_INSTR; if (R.byKey[pick.key] && R.byKey[pick.key].cat === R.CAT.DEFENSE) I.epick[state.round] = (I.epick[state.round] || 0) + 1; }',
    why: '按回合数记：ε 开火次数 / 池宽 / 池内含防御键的次数 / ε 实际抽到防御键的次数'
  });
}
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  let srcTxt = readFileSync(f, 'utf8');
  if (f === 'js/train/evo.js' && PATCHES.length) {
    for (const p of PATCHES) {
      const hits = srcTxt.split(p.find).length - 1;
      if (hits !== 1) { console.error('evo.js 补丁命中数 = ' + hits + '（要求恰为 1）：' + p.find + '\n⇒ 源码形状变了，补丁会静默少覆盖，拒绝出数'); process.exit(2); }
      srcTxt = srcTxt.replace(p.find, p.to);
    }
  }
  vm.runInNewContext(srcTxt, sb, { filename: f });
}
const W = sb.window, S = W.EpirusState, R = W.EpirusRules, X = W.EpirusResolve, Play = W.EpirusPlay;
const T = W.EpirusTrainer, Bots = W.EpirusBots, P = W.EpirusPolicy;
if (!T || typeof T.pickChampion !== 'function' || typeof T.mulberry32 !== 'function' || !Play || typeof Play.legalActions !== 'function') {
  console.error('沙箱里缺 EpirusTrainer.pickChampion/mulberry32 或 EpirusPlay.legalActions ⇒ 装配失败，拒绝继续'); process.exit(2);
}
if (MIRROR && !R.MODES[MMODE]) { console.error('--mmode 不是真模式（可选 ' + Object.keys(R.MODES).join(',') + '，实测 `' + MMODE + '`）⇒ 镜像段会跑在一台不存在的考场上'); process.exit(2); }

function loadPack(path) {
  const src = readFileSync(path, 'utf8');
  const mm = /window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  if (!mm) { console.error('包里找不到冠军外壳（EPIRUS_CHAMPION[_3P]）: ' + path); process.exit(2); }
  const json = JSON.parse(mm[1]);
  const params = P.unpack(json, true);
  if (!params) { console.error('包不兼容（维度/版本）: ' + path + ' ' + JSON.stringify(P.checkPack(json))); process.exit(2); }
  return params;
}

/* ---------- 配置：现役那一行的四元组 + 三种"回合斜坡"（用户提的方向）---------- */
const RAMPS = {
  /* 只坡 ε：第 1 回合零探索、第 2 半量、第 3 起满量（温度维持 .15） */
  ramp_eps: function (round) { return { eps: round <= 1 ? 0 : (round === 2 ? 0.1 : 0.2) }; },
  /* ε 与温度一起坡：第 1 回合等于纯贪心 */
  ramp_all: function (round) { return { temp: round <= 1 ? 0.001 : (round === 2 ? 0.075 : 0.15), eps: round <= 1 ? 0 : (round === 2 ? 0.1 : 0.2) }; },
  /* 只把第 1 回合的温度压死，其余回合与现役逐字相同（最小的那一刀） */
  ramp_notemp1: function (round) { return { temp: round <= 1 ? 0.001 : undefined }; }
};
const CFGS = {
  ui: { temp: 0.15, eps: 0.2, epsK: 5, epsMode: 'soft', ramp: null },
  noeps: { temp: 0.15, eps: 0, epsK: 5, epsMode: 'soft', ramp: null },
  greedy: { temp: 0.001, eps: 0, epsK: 5, epsMode: 'soft', ramp: null },
  ramp_eps: { temp: 0.15, eps: 0.2, epsK: 5, epsMode: 'soft', ramp: RAMPS.ramp_eps },
  ramp_all: { temp: 0.15, eps: 0.2, epsK: 5, epsMode: 'soft', ramp: RAMPS.ramp_all },
  ramp_notemp1: { temp: 0.15, eps: 0.2, epsK: 5, epsMode: 'soft', ramp: RAMPS.ramp_notemp1 },
  /* ⭐ 机制反证（预注册在这段注释里）：若首手防御是"ε 在 top-K 键里均匀抽"造成的，那么把 K 改小就
   * 必须**按比例**改变防御率，而不是把它归零。第 1 回合只有 4 张可付卡（ジ + 3 张 0 ジ 防御）⇒
   *   K=5/4 → 探索池 = 全部 4 键（防御占 3/4）→ 预测防御率 = ε·0.75 = 15.0%
   *   K=3 → 池 = ジ + 概率最高的 2 张防御 → 预测 = ε·(2/3) = 13.3%
   *   K=2 → 池 = ジ + 概率最高的那 1 张防御 → 预测 = ε·0.5 = 10.0%，**且那一张防御必须由包的权重决定**
   * ⇒ K=2 那格同时回答两件事：① 机制是不是"均匀抽键"；② 首手选**哪种**防御才是包说了算的。
   * （`policyChooserN` 里 `top = pool.slice(0, Math.max(2, epsK||5))` ⇒ K=1 会被夹到 2，所以不做 K=1。） */
  ui_k3: { temp: 0.15, eps: 0.2, epsK: 3, epsMode: 'soft', ramp: null },
  ui_k2: { temp: 0.15, eps: 0.2, epsK: 2, epsMode: 'soft', ramp: null }
};
const CFG_NAMES = String(arg('configs', 'ui,noeps,greedy,ui_k3,ui_k2,ramp_eps,ramp_all,ramp_notemp1')).split(',').filter(Boolean);
for (const c of CFG_NAMES) if (!CFGS[c]) { console.error('未知 --configs 项: ' + c + '（可选 ' + Object.keys(CFGS).join(',') + '）'); process.exit(2); }

/* ---------- 复刻页面的 chooser ---------- */
function uiChooser(params, cfg) {
  return function (state, pid, legal) {
    let temp = cfg.temp, eps = cfg.eps;
    if (cfg.ramp) { const q = cfg.ramp(state.round); if (q.temp != null) temp = q.temp; if (q.eps != null) eps = q.eps; }
    const aff = legal.filter(function (l) { return l.affordable; });
    const legalForAI = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    const res = T.pickChampion(state, pid, legalForAI, params, temp, eps, cfg.epsK, cfg.epsMode);
    const key = (typeof res === 'string') ? res : (res && res.key);
    const t1 = (res && typeof res === 'object' && res.target != null) ? res.target : T.pickTargetN(state, pid, key);
    let t2 = null;
    if (key === R.SK.DUAL_GUN || key === R.SK.MIRROR) {
      const rest = S.opponentsOf(state, pid).filter(function (o) { return o !== t1; });
      t2 = rest.length ? rest[0] : null;
    }
    return { key: key, target: t1, target2: t2, bead: (res && typeof res === 'object' && (res.bead === 'elec' || res.bead === 'boom')) ? res.bead : null };
  };
}

const catOf = function (key) { const d = R.byKey[key]; return d ? d.cat : '?'; };
const isDef = function (key) { return catOf(key) === R.CAT.DEFENSE; };

/* =============== A 段：首手的精确分布（同一张初局面，只换 rng） =============== */
function freshRound1State(seed, n) {
  const st = S.createState('multi', { next: T.mulberry32(seed) }, n);
  if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
  X.startTurn(st);                     // 与 autoGameN 同序：startTurn 之后才问 legal
  return st;
}

function openDist(params, cfg, draws, seedBase) {
  const cnt = {}, def = {}; let tot = 0, seatMismatch = 0, keys = null;
  for (let d = 0; d < draws; d++) {
    const st = freshRound1State(seedBase + d, N);
    if (!keys) keys = Play.legalActions(st, 0).filter(function (l) { return l.affordable; }).map(function (l) { return l.key; });
    const pick = uiChooser(params, cfg)(st, 0, Play.legalActions(st, 0));
    if (d < 40) {                       // seat-invariance 自检（见头注 3）
      for (let k = 1; k < N; k++) {
        const st2 = freshRound1State(seedBase + d, N);
        if (uiChooser(params, cfg)(st2, k, Play.legalActions(st2, k)).key !== pick.key) { seatMismatch++; break; }
      }
    }
    cnt[pick.key] = (cnt[pick.key] || 0) + 1;
    if (isDef(pick.key)) def[pick.key] = (def[pick.key] || 0) + 1;
    tot++;
  }
  return { cnt: cnt, def: def, tot: tot, keys: keys, seatMismatch: seatMismatch };
}

/* =============== B 段：真跑整局，按回合窗口记账 =============== */
function runGames(params, cfg, games, seedBase, seat0) {
  const A = {
    games: 0, aiSeats: N - 1, turns: { r1: 0, r2: 0, r3: 0, r4: 0 }, defCnt: { r1: 0, r2: 0, r3: 0, r4: 0 },
    r1Keys: {}, r1DamageEvents: 0, r1Blocked: 0, r1GamesWithDamage: 0, r1DefSeatGames: 0, r1DefSeatsTotal: 0,
    ep2Def: 0, ep2DefN: 0, ep2Ji: 0, ep2JiN: 0,
    defBlockedEver: 0, defCastsEver: 0, aiWins: 0, humanWins: 0, noWinner: 0, rounds: 0,
    winArr: [], roundArr: [], defArr: []          // 逐局记录 ⇒ 跨包/跨配置**按局号配对**（种子只由 g 决定）
  };
  for (let g = 0; g < games; g++) {
    const seed = seedBase + g * 977;
    const st = S.createState('multi', { next: T.mulberry32(seed) }, N);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seed);
    let round = 0, cursor = 0;
    const r1def = {};
    const win = function (r) { return r <= 1 ? 'r1' : (r === 2 ? 'r2' : (r === 3 ? 'r3' : 'r4')); };
    const book = function (pid) {
      return function (state, id, legal) {
        const pick = uiChooser(params, cfg)(state, id, legal);
        const w = win(round);
        A.turns[w]++;
        if (isDef(pick.key)) {
          A.defCnt[w]++; A.defCastsEver++;
          if (w === 'r1') { r1def[pid] = true; }
        }
        if (w === 'r1') A.r1Keys[pick.key] = (A.r1Keys[pick.key] || 0) + 1;
        return pick;
      };
    };
    const onRoundStart = function (s) {
      const seg = s.events.slice(cursor);
      if (s.round === 2) {                       // 这段就是"第 1 回合内"发生的全部事件
        let dmg = 0, blk = 0;
        for (const e of seg) { if (e.type === 'damage' && e.to != null) dmg++; if (e.type === 'blocked') blk++; }
        A.r1DamageEvents += dmg; A.r1Blocked += blk;
        if (dmg > 0) A.r1GamesWithDamage++;
        const ds = Object.keys(r1def);
        if (ds.length) { A.r1DefSeatGames++; A.r1DefSeatsTotal += ds.length; }
        for (let pid = 1; pid < N; pid++) {
          if (r1def[pid]) { A.ep2Def += s.p[pid].ep; A.ep2DefN++; } else { A.ep2Ji += s.p[pid].ep; A.ep2JiN++; }
        }
      }
      cursor = s.events.length; round = s.round;
    };
    const choosers = [seat0];
    for (let pid = 1; pid < N; pid++) choosers.push(book(pid));
    Play.autoGameN(st, choosers, undefined, onRoundStart);
    A.games++; A.rounds += st.round;
    if (st.winner == null) A.noWinner++; else if (st.winner === 0) A.humanWins++; else A.aiWins++;
    A.winArr.push(st.winner != null && st.winner !== 0 ? 1 : 0);
    A.roundArr.push(st.round);
    A.defArr.push(Object.keys(r1def).length / (N - 1));
    /* 防御"挡到了东西"的总账（不限回合）：blocked 事件 by 防御/反弹/八卦阵/金刚盾 */
    for (const e of st.events) if (e.type === 'blocked' && ['防御', '反弹', '八卦阵', '金刚盾'].indexOf(e.by) >= 0) A.defBlockedEver++;
  }
  return A;
}

/* =============== M 段：镜像破局（`--mirror=1`）==============
 * 为什么必须补这一段：`--filterge2` 的反方向（把"探索池剔掉防御键"的门槛从 ≥2 降到 ≥1）能把**所有回合**的
 * 凭空防御一次清干净，看起来比"回合斜坡"更彻底。但 ε 当初被请进来的理由（v1.5.139 用户裁定）不是审美，
 * 是**破对称**：`docs` 记的是"2 席长程镜像 ε=0 ⇒ 104 回合 0% 决胜；ε.4~.5 top5 ⇒ ~30 回合 100%"。
 * 而在 ep=0 的回合里，非防御可付卡只剩 ジ 一张 ⇒ 门槛降到 ≥1 后探索池={ジ}⇒ **ε 退化成空操作**，
 * 那条"靠随机摆个架势把镜像打散"的出路就被一起堵掉了。⇒ 采纳这一档**之前**先把镜像破局量一遍（本节就是那次）：
 * 装配 = 2 席同包（谁也不让谁），判据 = 决胜率 + 平均回合数。历史读数（ε=0 ⇒ 不分胜负）是这条的**对照**。
 * ⚠ **v1.5.304 实测已把这一档付掉的代价记死**（现役包 · 长程镜像 · 300 局）：平均 24.6→**31.3** 回合、僵死 0/300→**2/300**
 *   ⇒ 门仍留着破对称的能力、只是慢一拍，用户裁定"值"（页面侧换来的是第 3 回合防御 18.57%→8.26%、第 4+ 4.84%→1.29%）。
 *   现在默认就是 ≥1，所以本段跑的是**仓库档**；要复现旧行为请加 `--filterge2=1`。 */
function runMirror(params, cfg, games, seedBase, modeKey) {
  const M = { games: 0, rounds: 0, decisive: 0, cap: 0 };
  for (let g = 0; g < games; g++) {
    const st = S.createState(modeKey, { next: T.mulberry32(seedBase + g * 977) }, 2);
    if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seedBase + g * 977);
    const ch = uiChooser(params, cfg);
    Play.autoGameN(st, [ch, ch]);
    M.games++; M.rounds += st.round;
    if (st.winner != null) M.decisive++;
    if (st.round >= 100) M.cap++;
  }
  return M;
}

/* ---------- 0 号位替身：页面里坐在那儿的是用户本人，这里用最接近"普通对手"的平衡脚本 ---------- */
function humanStandIn(state, pid, legal) {
  const aff = legal.filter(function (l) { return l.affordable; });
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  const k = Bots.pickBalanced(state, pid, base);
  const key = (typeof k === 'string') ? k : (k && k.key) || R.SK.JI;
  const t1 = T.pickTargetN(state, pid, key);
  return { key: key, target: t1, target2: T.pickTarget2N(state, pid, key, t1), bead: null };
}

const pc = function (n, d) { return d ? (100 * n / d).toFixed(2) + '%' : '—'; };
const binomSE = function (x, n) { if (!n) return 0; const q = x / n; return 100 * Math.sqrt(q * (1 - q) / n); };
const nm = function (k) { return R.byKey[k] ? R.byKey[k].name : k; };

/* 仪器读数（只在 --instrument=1 下有值）：按回合窗口累加 ε 开火/池宽/池含防御/抽到防御 */
function instrSnap() { return sb.EPIRUS_INSTR ? JSON.parse(JSON.stringify(sb.EPIRUS_INSTR)) : null; }
function instrDelta(a, b) {
  if (!b) return null;
  if (!a) return b;
  const out = {};
  for (const kk of ['fire', 'poolw', 'topdef', 'epick']) {
    out[kk] = {};
    for (const r in b[kk]) out[kk][r] = (b[kk][r] || 0) - (a[kk][r] || 0);
    for (const r in a[kk]) if (!(r in out[kk])) out[kk][r] = -(a[kk][r] || 0);
  }
  return out;
}
function instrWindow(I, lo, hi) {
  if (!I) return null;
  const w = function (o) { let s = 0; for (const r in o) { const rn = Number(r); if (rn >= lo && rn <= hi) s += o[r]; } return s; };
  return { fire: w(I.fire), poolw: w(I.poolw), topdef: w(I.topdef), epick: w(I.epick) };
}
function instrLine(name, q, den) {
  if (!q || !q.fire) { console.log('        [仪器/' + name + '] ε 没开火（该窗口探索从未触发）'); return; }
  console.log('        [仪器/' + name + '] ε 开火 ' + q.fire + ' 次 ‖ 平均池宽 ' + (q.poolw / q.fire).toFixed(2) +
    ' ‖ **池里含防御键** ' + pc(q.topdef, q.fire) + ' ‖ ε 抽到防御 ' + q.epick + ' 次' +
    (den ? '（= 该窗口全部防御出手 ' + pc(q.epick, den) + ' ⇒ 其余是网络自己要的）' : ''));
}

const rows = [];
const RES = [];                      // RES[pi][cname] = {a, b} ⇒ 末尾做配对比较
const t0 = Date.now();
console.log('# probe-round1-open  n=' + N + '  games=' + GAMES + '  draws=' + DRAWS + '  seed=' + SEED);
console.log('# variant=' + (FILTERGE2 ? 'filterge2(旧档 nonDef>=2)' : 'repo(nonDef>=1，v1.5.304 起的默认)') + '  instrument=' + (INSTR ? 'on' : 'off') +
  (PATCHES.length ? '   ⚠ 本进程在沙箱里改写了 evo.js 的源码文本，仓库文件未动' : ''));
for (const p of PATCHES) console.log('#   补丁：' + p.why);
console.log('# packs=' + PACKS.join(' , '));
if (INSTR) console.log('# 仪器档：计数语句不消耗 rng ⇒ 本进程的 B 段读数应与不插桩时逐字相同（这是一条免费自检）');
for (let pi = 0; pi < PACKS.length; pi++) {
  RES.push({});
  const label = LABELS[pi] || PACKS[pi];
  const params = loadPack(PACKS[pi]);
  const legal1 = Play.legalActions(freshRound1State(SEED, N), 0).filter(function (l) { return l.affordable; });
  console.log('\n===== 包 `' + label + '` =====');
  console.log('  ' + PACKS[pi]);
  console.log('  第 1 回合可选（ep=0 ⇒ 只有 0 ジ 卡）：' + legal1.map(function (l) { return nm(l.key) + (isDef(l.key) ? '[防]' : ''); }).join(' / '));
  for (const cname of CFG_NAMES) {
    const cfg = CFGS[cname];
    const s0 = instrSnap();
    const a = openDist(params, cfg, DRAWS, SEED * 1000003 + 11);
    const s1 = instrSnap();
    const defSum = Object.keys(a.def).reduce(function (s, k) { return s + a.def[k]; }, 0);
    const order = Object.keys(a.cnt).sort(function (x, y) { return a.cnt[y] - a.cnt[x]; });
    /* 机制预测：首手只有 nKey 张可付卡，探索以 epsK（下限 2）为池宽均匀抽键 ⇒ 防御份额 = eps ×（池内防御键数/池宽）。
     * 池宽 = min(max(2,epsK), nKey)；池内防御键数：soft 会把防御剔出池，**剔完还剩不到 defGate 张才不过滤**。
     * v1.5.304：defGate 现在是**档位量**（仓库默认 = 1 ⇒ 只有 nonDef 为空时防御才留在池里；
     * `--filterge2=1` 复现旧行为 = 2 ⇒ 第 1 回合 nonDef 只有 ジ 一张时剔除失效、池 = 全部键，那才是 §E145 找到的那扇门）。
     * ⚠ 预测式必须跟着档位走：拿旧规则判新行为会把"机制吻合"这一栏读反。 */
    const nKey = legal1.length, nDefKey = legal1.filter(function (l) { return isDef(l.key); }).length;
    const width = Math.min(cfg.epsK == null ? 5 : Math.max(2, cfg.epsK), nKey);
    const defGate = FILTERGE2 ? 2 : 1;                            // soft 的"不过滤"分支门槛（随档位）
    const poolHasDef = (nKey - nDefKey) < defGate;
    /* 池内防御键数 = min(防御键总数, 池宽 − 1)：贪心/概率最高的那个键（首手=ジ）必占池里一格。 */
    const poolDef = Math.min(nDefKey, width - 1);
    const predDef = (cfg.eps && poolHasDef) ? cfg.eps * (poolDef / width) : 0;
    const predSE = Math.sqrt(Math.max(1e-9, predDef * (1 - predDef)) / a.tot);
    const predOk = Math.abs(defSum / a.tot - predDef) < 2.5 * predSE;
    console.log('  [A/' + cname + '] 首手分布：' + order.map(function (k) { return nm(k) + ' ' + pc(a.cnt[k], a.tot); }).join('  ') +
      '   ⇒ 防御合计 ' + pc(defSum, a.tot) + '   众数=' + nm(order[0]) +
      (a.seatMismatch ? '   ⚠座位不同分布 ' + pc(a.seatMismatch, 40) + '（头注 3 的"一次抽样"口径不成立）' : '   座位同分布 ✅'));
    console.log('        机制预测（只算 **ε 均匀抽 top-K 键**那一路的贡献；首手贪心=ジ，温度另计）：池宽 ' + width + '/可选 ' + nKey + ' 键，池内防御 ' + (poolHasDef ? poolDef : 0) + ' 张' + (poolHasDef ? '（soft 的"剔掉防御键"因 nonDef=' + (nKey - nDefKey) + ' <' + defGate + ' 而**没生效**）' : '（已被 soft 剔除）') +
      ' ⇒ 预测 ' + (predDef * 100).toFixed(2) + '% ‖ 实测 ' + (100 * defSum / a.tot).toFixed(2) + '% ‖ ±' + (2.5 * predSE * 100).toFixed(2) + '(2.5σ) ⇒ ' +
      (predOk ? '机制吻合' : '⚠机制不吻合，另有来源'));
    rows.push({ pack: label, cfg: cname, metric: 'A_def@r1', val: defSum / a.tot });
    rows.push({ pack: label, cfg: cname, metric: 'A_def@r1_predicted', val: predDef });
    if (INSTR) instrLine('A·首手 ' + cname, instrWindow(instrDelta(s0, s1), 1, 1), defSum);
    const b = runGames(params, cfg, GAMES, SEED * 1000003 + 7, humanStandIn);
    const s2 = s1, sB = instrSnap();
    const IB = instrDelta(s2, sB);
    RES[pi][cname] = { b: b };
    console.log('  [B/' + cname + '] 真跑 ' + b.games + ' 局（0 号位=平衡脚本，1~' + (N - 1) + ' 号位=本包）防御出现率：' +
      '第1回合 ' + pc(b.defCnt.r1, b.turns.r1) + ' ±' + binomSE(b.defCnt.r1, b.turns.r1).toFixed(2) +
      ' ‖ 第2 ' + pc(b.defCnt.r2, b.turns.r2) + ' ‖ 第3 ' + pc(b.defCnt.r3, b.turns.r3) + ' ‖ 第4+ ' + pc(b.defCnt.r4, b.turns.r4));
    console.log('            第 1 回合内：伤害事件 ' + b.r1DamageEvents + ' 条、有伤害的局 ' + b.r1GamesWithDamage + '/' + b.games +
      '、blocked 事件 ' + b.r1Blocked + ' 条 ⇒ 首手防御挡到的东西 = ' + (b.r1Blocked > 0 ? b.r1Blocked + ' 次（与"回合窗口"口径要复核）' : '**0，一无所挡**') +
      '（全局长账：防御出手 ' + b.defCastsEver + ' 次里挡到 ' + b.defBlockedEver + ' 次）');
    console.log('            第 2 回合开局 ep：站过防御 ' + (b.ep2DefN ? (b.ep2Def / b.ep2DefN).toFixed(2) : '—') + ' ジ（' + b.ep2DefN + ' 席）‖ 拿 ジ ' +
      (b.ep2JiN ? (b.ep2Ji / b.ep2JiN).toFixed(2) : '—') + ' ジ（' + b.ep2JiN + ' 席）⇒ 差额 ' +
      ((b.ep2DefN && b.ep2JiN) ? (b.ep2Ji / b.ep2JiN - b.ep2Def / b.ep2DefN).toFixed(2) : '—') + ' ジ/席');
    console.log('            AI 夺冠 ' + pc(b.aiWins, b.games) + ' ‖ 替身 ' + pc(b.humanWins, b.games) + ' ‖ 平/无胜 ' + pc(b.noWinner, b.games) +
      ' ‖ 平均 ' + (b.rounds / b.games).toFixed(1) + ' 回合 ‖ 首手 key：' +
      Object.keys(b.r1Keys).sort(function (x, y) { return b.r1Keys[y] - b.r1Keys[x]; }).slice(0, 5)
        .map(function (k) { return nm(k) + ' ' + pc(b.r1Keys[k], b.turns.r1); }).join(' '));
    rows.push({ pack: label, cfg: cname, metric: 'B_def@r1', val: b.defCnt.r1 / b.turns.r1 });
    if (INSTR && IB) {
      instrLine('B·' + cname + ' 第1回合', instrWindow(IB, 1, 1), b.defCnt.r1);
      instrLine('B·' + cname + ' 第2回合', instrWindow(IB, 2, 2), b.defCnt.r2);
      instrLine('B·' + cname + ' 第3回合', instrWindow(IB, 3, 3), b.defCnt.r3);
      instrLine('B·' + cname + ' 第4+回合', instrWindow(IB, 4, 999), b.defCnt.r4);
    }
    rows.push({ pack: label, cfg: cname, metric: 'B_r1_damage_events', val: b.r1DamageEvents });
    rows.push({ pack: label, cfg: cname, metric: 'B_r1_blocked', val: b.r1Blocked });
    rows.push({ pack: label, cfg: cname, metric: 'B_ep2_gap', val: (b.ep2JiN && b.ep2DefN) ? (b.ep2Ji / b.ep2JiN - b.ep2Def / b.ep2DefN) : null });
    rows.push({ pack: label, cfg: cname, metric: 'B_ai_winrate', val: b.aiWins / b.games });
    rows.push({ pack: label, cfg: cname, metric: 'B_avg_rounds', val: b.rounds / b.games });
    if (MIRROR) {
      const m = runMirror(params, cfg, MGAMES, SEED * 1000003 + 29, MMODE);
      console.log('  [M/' + cname + '] 2 席同包镜像（mode=' + MMODE + '）' + m.games + ' 局：平均 ' + (m.rounds / m.games).toFixed(1) + ' 回合 ‖ 走到终局有胜者 ' +
        pc(m.decisive, m.games) + ' ‖ **拖到 ≥100 回合的僵死局** ' + pc(m.cap, m.games) + ' ⇒ 破对称看这一列' +
        '（v1.5.139 记的"ε=0 ⇒ 104 回合 0% 决胜"就是这一列 = 100%、平均 104 回合）');
      rows.push({ pack: label, cfg: cname, metric: 'M_decisive', val: m.decisive / m.games });
      rows.push({ pack: label, cfg: cname, metric: 'M_avg_rounds', val: m.rounds / m.games });
    }
  }
}

/* =============== C 段：配对比较（同种子 ⇒ 局号对齐；注意只保证"开局桌子一致"，不保证轨迹一致） =============== */
function paired(a, b, name) {
  const n = Math.min(a.length, b.length);
  if (!n) return null;
  let m = 0; const d = [];
  for (let i = 0; i < n; i++) { const x = a[i] - b[i]; d.push(x); m += x; }
  m /= n;
  let v = 0; for (let i = 0; i < n; i++) v += (d[i] - m) * (d[i] - m);
  v = n > 1 ? v / (n - 1) : 0;
  const se = Math.sqrt(v / n), z = 1.96;
  console.log('      ' + name.padEnd(22) + ' 配对差 ' + (m >= 0 ? '+' : '') + m.toFixed(4) +
    ' [' + (m - z * se).toFixed(4) + ', ' + (m + z * se).toFixed(4) + ']  n=' + n + (m - z * se > 0 ? '  ⇒ 差>0' : (m + z * se < 0 ? '  ⇒ 差<0' : '  ⇒ 跨 0（分不出）')));
  return { mean: m, lo: m - z * se, hi: m + z * se, n: n };
}
if (CFG_NAMES.indexOf('ui') >= 0) {
  for (let pi = 0; pi < PACKS.length; pi++) {
    const base = RES[pi].ui && RES[pi].ui.b; if (!base) continue;
    console.log('\n===== C1 · 包 `' + (LABELS[pi] || PACKS[pi]) + '`：各配置 **对现役 ui 的配对差**（局号对齐）=====');
    for (const cname of CFG_NAMES) {
      if (cname === 'ui') continue;
      const b = RES[pi][cname] && RES[pi][cname].b; if (!b) continue;
      console.log('  ' + cname + '：');
      paired(b.defArr, base.defArr, '首手防御席占比');
      paired(b.winArr, base.winArr, 'AI 夺冠(0/1)');
      paired(b.roundArr, base.roundArr, '对局长度(回合)');
    }
  }
  if (PACKS.length > 1) {
    console.log('\n===== C2 · 同配置下 **包对包**的配对差（第 2 粒 − 第 1 粒；这就是"页面里能不能看出差别"的口径）=====');
    for (const cname of CFG_NAMES) {
      const a = RES[0][cname] && RES[0][cname].b, b = RES[1][cname] && RES[1][cname].b;
      if (!a || !b) continue;
      console.log('  [' + cname + ']');
      paired(b.winArr, a.winArr, 'AI 夺冠(0/1)');
      paired(b.roundArr, a.roundArr, '对局长度(回合)');
      paired(b.defArr, a.defArr, '首手防御席占比');
    }
  }
}
console.log('\n耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
if (OUT) {
  const dir = dirname(OUT);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUT, ['pack', 'cfg', 'metric', 'val'].join('\t') + '\n' + rows.map(function (r) {
    return [r.pack, r.cfg, r.metric, r.val == null ? '' : (typeof r.val === 'number' ? r.val.toFixed(6) : r.val)].join('\t');
  }).join('\n') + '\n');
  console.log('TSV → ' + OUT);
}
