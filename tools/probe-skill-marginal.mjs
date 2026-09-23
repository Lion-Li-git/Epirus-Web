/* tools/probe-skill-marginal.mjs —— 技能**边际价值**的第三套口径：机会式 ε 注入（qoder 0923 夜 · §N22）
 *
 * 为什么需要它（`tools/skill-report.mjs` 的两套口径各自量不到什么）：
 *  · **mono-spam Δ**（100% 强迫这一手）：对辅助/防御卡**结构性为负** —— 每回合只防不攻当然输，
 *    那个 −70pt 是口径的价，不是卡的价（实测：反弹 −69 / 八卦 −79 / 贴贴 −82 / 天火 −82）。
 *  · 同一套强迫对**需要铺垫的卡**直接失效：电磁炮强制命中 4%、摄魂 6%、激光眼 0% ⇒ 判"实验未生效（Δ 不可读）"，
 *    原因是"每回合都打它"= 永远不许先备珠/永远等不到 HP 窗口 ⇒ **强迫自己反而把它逼没了**。
 *  · **消融 Δ_lost**（从可选集拿掉）只在冠军**本来就在用**时有意义；从来不用的一律 Δ=0 ⇒ 同样测不出。
 *
 * 本工具改判"愿不愿意用"：每回合以概率 ε **在该卡合法且买得起时**替换冠军自己的一手，其余全照冠军打法
 * ⇒ 铺垫仍然由冠军自己做（珠会备、窗口会等），测的是"**多这一手的意愿值多少胜率**"，即边际价值。
 * 每卡另报 **机会/局**（合法且可负担的回合数）与 **注入/局**（真替换出去的回合数）
 * ⇒ "测不出"从此有两种：机会≈0（结构性不可测，要改的是配方不是口径）vs 机会够但样本不足（加局数就行）。
 *
 * ⚠️ 读 `--rich=card` 那一档的人注意两件事（都是实测，不是免责套话）：
 *   ① 它是**每回合持续垫**（不是"给一次钱"）⇒ 所以 Δ1st 读的是「在一个从不缺这笔钱的世界里，愿意多用这一手值多少」，
 *      不是原生世界里的价值。这正是"光垫钱"列存在的理由：cmin4 在 long 下 光垫钱 = +41~46pt、电磁炮那一档 +87.5pt
 *      ⇒ 世界本身差得很远，Δ 只配当方向，不配当判据。
 *   ② 补贴对**基线臂也生效**（两臂同垫）⇒ 广度和胜负都可能被钱推着走，别用它论证"这卡该练"。
 *
 * 用法：node tools/probe-skill-marginal.mjs [--pack=js/bundled-champion-3p.js] [--mode=long] [--n=5]
 *        [--games=80] [--eps=0.25] [--only=miniT,bigT,...] [--json]
 * 口径：冠军出手 = `policyChooserN(params, 0.15)`（与 `mirrorHealth`/门禁同源同参）；对手 = 固定脚本池，
 *       受评席位每局轮换；base 与各注入臂**同种子同对手**（配对复现，不是两次独立抽样）。
 * 只读：不写任何产物、不换包。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const arg = function (k, d) {
  const h = process.argv.find(function (a) { return a.indexOf('--' + k + '=') === 0; });
  return h ? h.split('=')[1] : d;
};
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const MODE = arg('mode', 'long');
const N = Number(arg('n', 5));
const GAMES = Number(arg('games', 80));
/* v1.5.172（§N36）：目标配对 SE（pt）——只影响"需多少局"这句**价码**怎么报，不影响任何 Δ 读数 */
const TARGET_SE = Number(arg('target-se', 3));
const EPS = Number(arg('eps', 0.25));
const ONLY = arg('only', '');
const SEED0 = Number(arg('seed', 20260923));
/* 补贴档（口径②）：每回合把**受评席**的 ep 抬到 RICH 并给满两种珠 ⇒ 回答「这手卡**付得起时**值多少胜率」。
 * ⚠️ 只能当**读价值的显微镜**，不许当上线判据 —— 本仓前例：补贴 = 白来的 ep 会造出「只在补贴下成立」的幻影目标
 *   （`evo.js` 的 `makeEconChooser`/v1.5.99 与「承诺局一分不进 fit」都是为躲这个坑）。base 与注入**同补**，Δ 只在同口径内比。 */
const RICH_RAW = arg('rich', '0');
const RICH_CARD = (RICH_RAW === 'card');                                  // 定向：只为被测的那张卡垫到刚够（两臂同垫 ⇒ Δ = 纯粹的意愿边际）
const RICH_EP = RICH_CARD ? 0 : Number(RICH_RAW);                         // 数字 = 无差别补贴（会把基线打进天花板，只作对照用）
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
const R = sb.window.EpirusRules, S = sb.window.EpirusState, T = sb.window.EpirusTrainer,
  P = sb.window.EpirusPolicy, B = sb.window.EpirusBots;
const packObj = /window\.EPIRUS_CHAMPION_3P\s*=/.test(readFileSync(PACK, 'utf8')) ? sb.window.EPIRUS_CHAMPION_3P : sb.window.EPIRUS_CHAMPION;
const params = P.unpack(packObj, true);
if (!params) { console.error('⛔ 冠军包解不开（读不出 v7 参数）：' + PACK); process.exit(2); }

/* 对手池：9 条性质不同的脚本线，与 `skill-diag`/门禁同一批；不含冠军自己 */
const POOL = [B.pickAggro, B.pickBalanced, B.pickDefend, B.pickWall, B.pickFarmer,
  B.pickMix, B.pickBeadBurst, B.pickComboCounter, B.pickRandom];
const POOLN = ['aggro', 'balanced', 'defend', 'wall', 'farmer', 'mix', 'beadburst', 'combocounter', 'random'];

function baseSel() { return T.policyChooserN(params, 0.15); }

/* 每回合记 4 个数（自己的 ep / elec / boom / hp）⇒ 事后按卡推"为什么这手不合法"：
 * 缺钱（ep < 需求）· 缺珠（电磁炮要电珠、首次激光眼要爆珠）· 缺条件（摄魂要自己 HP≤窗口）· 冷却。
 * 需求量的推法与 `state.js:computeCost` 对齐（过载炮两阶段、激光眼续招 2ジ），不另写一份规则：
 * 只在"解释为什么不可测"这一格近似，不参与任何判据。 */
function needOf(k, st, pid) {
  const p = st.p[pid], def = R.byKey[k];
  if (!def) return null;
  let ep = def.cost, bead = null, cond = null;
  if (k === R.SK.RING) ep = p.ringStreak === 0 ? 3 : 0;
  if (k === R.SK.CANNON) {
    const ph = (p.cannonCount % 3) + 1;
    ep = ph === 1 ? 2 : p.ep; if (ph === 3) cond = '第3次自损1血';
  }
  if (k === R.SK.LASER_EYE) { if (p.lastSkill === R.SK.LASER_EYE) { ep = 2; } else { ep = 1; if (!p.boom) bead = 'boom'; } }
  if (k === R.SK.RAILGUN && !p.elec) bead = 'elec';
  if (k === R.SK.DRAIN && p.hp > ((st.mode && st.mode.drainHpMax) || 1)) cond = '需自己HP≤' + ((st.mode && st.mode.drainHpMax) || 1);
  return { ep: ep, bead: bead, cond: cond, cd: (p.cooldown[k] || 0) > 0 };
}

/* 跑一组配对局：injectKey=null ⇒ 基线；否则以 ε 概率在该卡合法时替换受评席的一手 */
function run(injectKey, eps, games, seedBase, rich, cardSub) {
  const stat = { first: 0, dealt: 0, rounds: 0, chance: 0, hit: 0, dead: 0, perGame: [] };
  const why = {};   // 卡 → {money, bead, cond, cd, ok}
  const noteWhy = function (st, seat) {
    for (const e of st.mode.skills) {
      const k = (typeof e === 'string') ? e : e.key;
      const w = why[k] || (why[k] = { money: 0, bead: 0, cond: 0, cd: 0, ok: 0, n: 0 });
      w.n++;
      if (!S.canUseSkillInMode(st, k)) { w.cond++; continue; }
      if ((st.p[seat].cooldown[k] || 0) > 0) { w.cd++; continue; }
      const q = needOf(k, st, seat);
      if (!q) { w.cond++; continue; }
      if (q.bead) { w.bead++; continue; }
      if (q.ep > st.p[seat].ep) { w.money++; continue; }
      w.ok++;
    }
  };
  for (let g = 0; g < games; g++) {
    const seed = seedBase + g * 7919;
    const seat = g % N;
    const rnd = T.mulberry32((seed ^ 0x5bf03635) >>> 0);
    const bs = baseSel();
    const sel = function (state, pid, legal) {
      if (eps === 0 && state.p[pid].hp > 0) noteWhy(state, pid);   // 基线臂与"同垫不注入"的对照臂都采样"为什么这手不合法"
      if (injectKey) {
        const l = legal.find(function (x) { return x.key === injectKey && x.affordable; });
        if (l) {
          stat.chance++;
          if (rnd() < eps) {
            stat.hit++;
            const t = T.pickTargetN(state, pid, injectKey);
            return t == null ? { key: injectKey } : { key: injectKey, target: t };
          }
        }
      }
      return bs(state, pid, legal);
    };
    const ch = [];
    for (let pid = 0; pid < N; pid++) {
      if (pid === seat) ch.push(sel);
      else ch.push((function (bot) { return function (state, p2, legal) { return bot(state, p2, legal); }; })(POOL[(g * 3 + pid) % POOL.length]));
    }
    /* 补贴必须挂在**回合开始钩子**上，不能挂在 chooser 里：合法表（`Play.legalActions`）在 chooser 被调用
     * 之前就算好了，决策时才补 ep/珠 ⇒ 那手卡根本没进 legal，注入永远打不出来。
     * （第一版就犯了这个错：合法率报 90% 而机会/局只有 0.27，两列一对照就露馅。） */
    const richHook = (rich > 0 && !cardSub) ? function (st2) {
      const q = st2.p[seat]; if (!q || q.hp <= 0) return;
      if (q.ep < rich) { q.epDelta = (q.epDelta || 0) + (rich - q.ep); q.ep = rich; }
      if (!q.elec) q.elec = 1;
      if (!q.boom) q.boom = 1;
    } : (cardSub && injectKey ? function (st2) {
      /* 定向垫：只把"这一张卡"补到刚够（ep 与珠），其余经济原封不动 ⇒ 基线不会被打进天花板。
       * 两臂（注入 / 不注入）**同样垫** ⇒ Δ 读的是"愿意用这一手"值多少；另外与全局基线之比 = "光有钱"值多少。 */
      const q = st2.p[seat]; if (!q || q.hp <= 0) return;
      const need = needOf(injectKey, st2, seat); if (!need) return;
      if (need.ep != null && q.ep < need.ep) { q.epDelta = (q.epDelta || 0) + (need.ep - q.ep); q.ep = need.ep; }
      if (need.bead === 'elec' && !q.elec) { q.elec = 1; q.epDelta = (q.epDelta || 0); }
      if (need.bead === 'boom' && !q.boom) q.boom = 1;
    } : undefined);
    const r = T.oneGameN(ch, seed, N, { mode: MODE, onRoundStart: richHook });
    const me = r.state.p[seat];
    const won = r.state.winner === seat;
    stat.first += won ? 1 : 0;
    stat.perGame.push(won ? 1 : 0);
    let dealt = 0;
    for (const e of r.state.events) if (e.type === 'damage' && e.source === seat) dealt += (e.amt || 0);
    stat.dealt += dealt;
    stat.rounds += r.state.round;
    if (me && me.hp <= 0) stat.dead++;
  }
  return { first: stat.first / games, dealt: stat.dealt / games, rounds: stat.rounds / games, chance: stat.chance / games, hit: stat.hit / games, perGame: stat.perGame, why: why };
}

/* 噪声地板：基线换一批种子再跑一次 ⇒ 两个独立基线之差 = 本口径的固有噪声（任何 Δ 小于它都不许读） */
const base0 = run(null, 0, GAMES, SEED0, RICH_EP, false);
const baseNull = run(null, 0, GAMES, SEED0 + 7000000, RICH_EP, false);
const NOISE = Math.abs(base0.first - baseNull.first);

const cards = (ONLY ? ONLY.split(',') : Object.keys(R.byKey || {}));
const list = [];
for (const k of cards) {
  const def = (R.byKey || {})[k];
  if (!def) continue;
  const t = run(k, EPS, GAMES, SEED0, RICH_EP, RICH_CARD);
  const a = run(k, 0, GAMES, SEED0, RICH_EP, RICH_CARD);   // 同垫不注入 = 该卡的对照基线
  /* 配对 SE：对每局的胜负差（−1/0/+1）取 std/√n —— 同种子同对手，所以这是**配对**方差，比两次独立抽样灵敏得多 */
  const d = a.perGame.map(function (x, i) { return t.perGame[i] - x; });
  const md = d.reduce(function (x, y) { return x + y; }, 0) / Math.max(1, d.length);
  const vd = d.reduce(function (x, y) { return x + (y - md) * (y - md); }, 0) / Math.max(1, d.length - 1);
  const se = Math.sqrt(vd / Math.max(1, d.length));
  const d1 = (t.first - a.first) * 100, seP = se * 100;
  const subOnly = (a.first - base0.first) * 100;   // 光垫钱（不注入）值多少：非零 = 该臂有幻影，读数要打折
  const w = a.why[k] || base0.why[k] || { money: 0, bead: 0, cond: 0, cd: 0, ok: 0, n: 1 };
  const pc = function (x) { return x / Math.max(1, w.n); };
  let blocker = '—';
  if (!a.why[k] && !base0.why[k]) blocker = '不在本模式卡池（无从谈可测）';
  else if (pc(w.money) >= 0.5) blocker = '缺ジ（' + (100 * pc(w.money)).toFixed(0) + '% 的回合买不起）';
  else if (pc(w.bead) >= 0.3) blocker = '缺珠（' + (100 * pc(w.bead)).toFixed(0) + '%）';
  else if (pc(w.cd) >= 0.3) blocker = '冷却（' + (100 * pc(w.cd)).toFixed(0) + '%）';
  else if (pc(w.cond) >= 0.3) blocker = '条件/模式（' + (100 * pc(w.cond)).toFixed(0) + '%）';
  else if (pc(w.ok) < 0.05) blocker = '几乎从不合法（合计 ' + (100 * (pc(w.money) + pc(w.bead) + pc(w.cd) + pc(w.cond))).toFixed(0) + '% 被挡住）';
  let verdict, need = 0;
  if (t.chance < 0.5) verdict = '机会≈0（结构性不可测 ⇒ 先看右列缺什么）';
  else if (seP === 0 || Math.abs(d1) <= Math.max(NOISE * 100, 2 * seP)) {
    /* "读不出"必须有**价码**，否则它只是一句免责声明。配对 SE 随 √n 缩 ⇒ 要把 SE 压到 TARGET_SE，
     * 需要 `GAMES × (se/TARGET_SE)²` 局；顺手报"当前能分辨的最小效应 ≈ 2.8·SE"（α=.05 + 80% power）。 */
    need = seP > 0 ? Math.ceil(GAMES * Math.pow(seP / TARGET_SE, 2)) : 0;
    verdict = '噪声内（当前只能分辨 ≥' + (2.8 * seP).toFixed(1) + 'pt · 要 SE→' + TARGET_SE + 'pt 需 ~' + need + ' 局）';
  }
  else verdict = (d1 > 0 ? '可测 · 正边际' : '可测 · 负边际');
  list.push({ key: k, name: def.name, cost: def.cost, chance: t.chance, hit: t.hit, d1: d1, subOnly: subOnly, se: seP, need: need, dd: (t.dealt - base0.dealt), okRate: pc(w.ok), blocker: blocker, verdict: verdict });
}
list.sort(function (a, b) { return b.d1 - a.d1; });

console.log('# 技能边际价值（机会式 ε 注入）· 包=' + PACK + ' 模式=' + MODE + ' n=' + N +
  ' 局数=' + GAMES + ' ε=' + EPS + (RICH_CARD ? ' 【定向垫钱：只为被测卡垫到刚够 · 两臂同垫】' : (RICH_EP ? ' 【无差别补贴 ep=' + RICH_EP + '+双珠 · 会打进天花板，只作对照】' : '')) + ' 基线1st=' + (base0.first * 100).toFixed(1) + '%' +
  ' 噪声地板=' + (NOISE * 100).toFixed(1) + 'pt');
console.log('# 卡名         费用  机会/局 注入/局   Δ1st(pt)   ±配对SE  Δ伤害/局  合法率  光垫钱  判定  ‖ 为什么这手不可测/不合法');
for (const r of list) {
  console.log('  ' + String(r.name).padEnd(10) + String(r.cost).padStart(3) + '  ' +
    r.chance.toFixed(2).padStart(6) + '  ' + r.hit.toFixed(2).padStart(6) + '  ' +
    ((r.d1 >= 0 ? '+' : '') + r.d1.toFixed(1)).padStart(8) + '  ' + r.se.toFixed(1).padStart(6) + '  ' +
    ((r.dd >= 0 ? '+' : '') + r.dd.toFixed(2)).padStart(8) + '  ' + (100 * r.okRate).toFixed(0).padStart(5) + '%  ' +
    ((r.subOnly >= 0 ? '+' : '') + r.subOnly.toFixed(1)).padStart(6) + 'pt  ' +
    r.verdict + '  ‖ ' + r.blocker);
}
const measurable = list.filter(function (r) { return r.verdict.indexOf('可测') === 0; }).length;
const zeroChance = list.filter(function (r) { return r.verdict.indexOf('机会≈0') === 0; }).length;
console.log('# 合计 ' + list.length + ' 张卡：可测 ' + measurable + ' · 噪声内 ' + (list.length - measurable - zeroChance) + ' · 机会≈0 ' + zeroChance);
/* ===== v1.5.190（Q-10）：把"读不出来"拆成两种病，因为它们的治疗方式完全相反 =====
 * `机会≈0` 的判据是 `chance < 0.5`（**每局几次机会**）—— 这是个与局数无关的量 ⇒ **加算力救不了它**，
 * 只有换口径（`--rich=card`：只为被测卡垫到刚够、两臂同垫）才动得它；
 * 而 `噪声内` 才是算力问题（SE∝1/√n），所以这里顺手报"全部辨到 TARGET_SE 需要几局"。
 * 实测（现役包 · 30 张 · 80→250 局）：原生口径 可测 3→2（long）/0→4（multi）——**翻三倍算力基本没动**；
 * 换定向垫钱口径 10→14（long）/10→12（multi），且 `机会≈0` 直接归零 ⇒ 瓶颈是钱墙，不是算力。 */
const noiseRows = list.filter(function (r) { return r.verdict.indexOf('噪声内') === 0; });
const zeroMoney = list.filter(function (r) { return r.verdict.indexOf('机会≈0') === 0 && /缺ジ|缺珠/.test(r.blocker); }).length;
const maxNeed = noiseRows.reduce(function (m, r) { return Math.max(m, r.need || 0); }, 0);
console.log('# 病因拆开：机会≈0 的 ' + zeroChance + ' 张里 **' + zeroMoney + ' 张是钱/珠买不起** ⇒ `chance` 与局数无关 ⇒ 加算力救不了，要换 `--rich=card`；' +
  '噪声内的 ' + noiseRows.length + ' 张才是算力问题' +
  (maxNeed ? '（全部辨到 ' + TARGET_SE + 'pt ⇒ 最多需 ' + maxNeed + ' 局 = 当前的 ×' + (maxNeed / GAMES).toFixed(1) + '）' : '') +
  (RICH_CARD ? '【本口径已是定向垫钱 ⇒ 这一栏的"机会≈0"不再由钱造成】' : ''));
if (arg('json', '')) console.log(JSON.stringify({ pack: PACK, mode: MODE, games: GAMES, eps: EPS, base: base0.first, noise: NOISE, rows: list }));
