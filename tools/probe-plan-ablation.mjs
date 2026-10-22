#!/usr/bin/env node
/* ===== 计划线**逐线消融**（§E695 · 千问 10-23 夜 · 研究分支）=====
 * 承接 §E692：那张表把七条计划线的卡量到"可负担、在候选里、从不被选"这一类，但它只能对**冠军**那一侧说话；
 * 对**写脚本的那一侧**（杂货铺 `planPick`）它答不了用户 10-23 那一问：
 *   「杂货铺里各种计划都算得上是可以学习（当然不是必须学习）的长程规划方案」
 * ⇒ 要谈"哪条线值得学"，先得知道**哪条线在真桌面上挣得到分**。做法 = 逐线关掉，看这台脚本掉多少。
 *
 * 旋钮在 `js/train/bots.js`（`setPlanOff` / `planOffOn` / `countPlanOff` / `resetPlanOffStat`）：
 *   形状照本仓既有旋钮（`evo.js` 的 `setTrainEps/trainEps/countTrainEps/resetTrainEpsStat`）——**引擎内不读 process.env**，
 *   由调用方显式设置 ⇒ 默认空集，出厂行为逐字不变（判据 A4 实测这一点）。
 *   只关不加：按住一条分支后按原次序落到下一条/地板；**条件与分支体照原样求值**，所以 `rnd()` / `mpPickOne()`
 *   消耗的随机数与不关时相同（否则"关掉一条不触发的线"也会因随机流错位而改变整局，那个对照就废了）。
 *
 * 预注册（写在本文件跑任何一局**之前**，五条腿都是逐字比较，不看结果再定阈值）：
 *   A1 不变式：某臂 `按住计数合计 == 0` ⇒ 它的逐局出手 hash 必须与基线臂**逐字相同**；不同 ⇒ 开关有副作用 ⇒ 本批读数一律作废（exit 3）。
 *   A2 反向：  某臂 `计数 > 0` ⇒ hash 必须**变**（计数说"按住了 N 手"，出手流却一字未动 ⇒ 要么计数是假的、要么根本没挡住 `return`）。
 *              ⚠ 第一版把这条写成"hash 变 ⇒ 计数>0"，那与 A1 是**同一个判据的两种写法**（`(c==0 && h变)` 与 `(h变 && c==0)`），
 *                 等于白占一条腿；重写后两条分开测两种不同的坏法。
 *   A3 正对照：至少一臂必须"计数 >0 且 hash 变" ⇒ 若所有臂 hash 都不变，这个旋钮是装饰（exit 3）。
 *   A4 出厂无害：`setPlanOff('')` 那臂必须与"从不调 setter"的基线臂逐字相同（旋钮默认不改变产品）。
 *   A5 臂间不漏状态：出厂臂在**同一进程里**跑第二遍必须逐字相同（本仓 `bots.js` 的 `__mem` 是模块级、只在走到地板时自重置，
 *      §E209 记过一次；本尺第一批就是被它污染的 ⇒ 现在每局开头 `resetBotMem()`，并用这条腿钉住）。
 *   另加 A0：请求的 id 不在已知线清单 ⇒ exit 2 点名（不许把打错的 id 静默当成"这线没效果"）。
 *
 * 用法：node tools/probe-plan-ablation.mjs [--games=120] [--n=5] [--kit=1] [--seed=77000] [--arms=P0,P1,P4,P6,P7] [--quiet]
 * 只读：不落任何文件。 */
import { createHash } from 'node:crypto';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['games', 'n', 'kit', 'seed', 'arms', 'pack', 'mode', 'opp', 'quiet'], 'probe-plan-ablation');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 120)), N = Number(arg('n', 5)), KIT = Number(arg('kit', 1)), SEED0 = Number(arg('seed', 77000));
const MODE = arg('mode', 'multi');
const OPP = String(arg('opp', '')).split(/[^A-Za-z0-9]+/).filter(Boolean);
const QUIET = argv.includes('--quiet');
if (['standard', 'multi', 'multi4', 'long'].indexOf(MODE) < 0) {
  console.error('⛔ --mode 只认 standard/multi/multi4/long（实测 ' + MODE + '）'); process.exit(2);
}
if (!(GAMES >= 20 && GAMES <= 5000)) { console.error('⛔ --games 要在 20~5000（实测 ' + arg('games', 120) + '）'); process.exit(2); }
if (!(N >= 2 && N <= 5) || !(KIT >= 1 && KIT < N)) { console.error('⛔ 桌形要 2≤n≤5 且 1≤kit<n（实测 n=' + N + ' kit=' + KIT + '）'); process.exit(2); }

/* 已知线清单（行号 = 那一支的 `planSkipped(...)` 所在行，本次由 `grep -n "planSkipped("` 现抄，不是猜的） */
const KNOWN = {
  'P0': '攒钱纪律（珠不够就改按 ジ，在 pickToolKit 里不在 planPick，bots.js:575）',
  'P1a': '开环（首次 3 珠开聚能环，:495）',
  'P1b': '续环（开过之后每手免费，:489）',
  'P1': '聚能环整条线（开环 + 续环两支一起按）',
  'P2': '避雷针（对手蓄能或电珠在手，:507）',
  'P3': '大雷（5 珠后收人/打断/压领先，:477）',
  'P4a': '引爆（连贴满 3 手且场上 ≥2 枚点天火，:460）',
  'P4b': '连贴（上一手贴上了就补到 3 手，:470）',
  'P4c': '贴（渐进式入口，4 珠起五成试探一枚，:484）',
  'P4': '贴贴—引爆整条线（三支全按）',
  'P6': '过载炮三相位（:500-502）',
  'P7': '断环（对手连环到位用小雷断，:524）',
};
const want = String(arg('arms', 'P0,P1,P2,P3,P4,P6,P7')).split(/[^A-Za-z0-9]+/).filter(Boolean);
const bad = want.filter(function (x) { return !KNOWN[x]; });
if (bad.length) { console.error('⛔ A0 拦截：请求消融的 id 不在已知线清单 ⇒ ' + bad.join(',') + '\n   已知：' + Object.keys(KNOWN).join(' ‖ ')); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const K = R.SK;
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const USE_PACK = OPP.length === 0;
const raw = USE_PACK ? loadChamp(W, PACK) : null;
const params = USE_PACK ? Float64Array.from(raw || []) : null;
if (USE_PACK && (!raw || params.length !== W.EpirusPolicy.paramCount())) {
  console.error('⛔ 包读不出或维度不符：' + PACK + '（读出 ' + (raw ? raw.length : 'null') + ' ‖ paramCount=' + W.EpirusPolicy.paramCount() + '）');
  process.exit(2);
}
if (typeof B.setPlanOff !== 'function' || typeof B.countPlanOff !== 'function') {
  console.error('⛔ 旋钮没导出（`EpirusBots.setPlanOff`/`countPlanOff` 不存在）⇒ 这台量具的腿没接上，读数一律作废');
  process.exit(3);
}
/* 对手那一侧的两个来源（包 ‖ 脚本），**不许同时给**（同时给就变成"我到底在跟谁打"说不清）。
 *   脚本名不靠猜：从 `EpirusBots` 的导出里现扫 `pick*`，认不出来就 exit 2 点名（`eval-5p.mjs:212` 同一条纪律）。 */
if (OPP.length && arg('pack', null) !== null) { console.error('⛔ --opp= 与 --pack= 只能给一个（这一桌的对手必须只有一个来源）'); process.exit(2); }
const BOTFN = Object.keys(B).filter(function (k) { return /^pick[A-Z]/.test(k); });
const oppFns = OPP.map(function (tok) {
  const t = tok.toLowerCase().replace(/^pick/, '');
  const hit = BOTFN.filter(function (k) { return k.slice(4).toLowerCase() === t; });
  if (hit.length !== 1) { console.error('⛔ --opp= 里的 "' + tok + '" 认不出（匹配到 ' + hit.length + ' 个）⇒ 可用名（去 pick 前缀）：' + BOTFN.map(k => k.slice(4)).join(' ‖ ')); process.exit(2); }
  return { name: hit[0], fn: B[hit[0]] };
});

/* 每局一条**有序**的"该席出手流"（`key#target` 逐手，再带终局名次）⇒ 任何一处行为不同都会换 hash。
 * （写成"每局一个计数表"是不行的：两局换了出手次序会算成同一个串，那种差别恰恰是我们要看的。） */
function armRun(spec, callSetter) {
  if (callSetter) B.setPlanOff(spec);            // 基线臂**不调 setter**（A4 要比的正是"没调"与"调空串"）
  const sink = { kitKinds: {}, acts: 0, rounds: 0 };
  const seq = [];
  const winFlags = [];                            // 逐局 0/1（**该侧赢下这一局** = 任一杂货铺席是胜者）⇒ 与基线按局配对
  for (let g = 0; g < GAMES; g++) {
    /* 每局开头抹一次 bot 的跨回合记忆（`bots.js` 的模块级 `__mem`，§E209 那对 snapshot/restore 就是为它写的）。
     *   为什么这里必须抹：`noteOpp` 只在 `state.round === 1` 且**真走到地板**时才自重置 ⇒
     *   计划层在开局就答出来时地板没被调用，上一局（甚至上一臂）的 `lastDefRound` 会漏进这一局。
     *   实测就是这个：换成 `win-Ldemo.bak` 当对手包时，第二臂（空串）与第一臂（出厂）**稳定地**不同 ——
     *   不是 `Math.random`（连跑三次同一串 hash），是那份漏下来的记忆。A5 这条腿就是为它加的。 */
    B.resetBotMem();
    const st = S.createState(MODE, { next: T.mulberry32(SEED0 + g * 977) }, N);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const stream = [];
    const kitWrap = function (state, pid, legal) {
      const a = B.pickToolKit(state, pid, legal);
      const k = (typeof a === 'string') ? a : (a && a.key);
      if (k) { stream.push(pid + ':' + k + '#' + ((a && a.target != null) ? a.target : '-')); sink.acts++; sink.kitKinds[k] = 1; }
      return a;
    };
    const choosers = [];
    for (let i = 0; i < N; i++) {
      if (i < KIT) { choosers.push(kitWrap); continue; }
      choosers.push(USE_PACK ? T.policyChooserN(params, 0.15, 0.15) : oppFns[(i - KIT) % oppFns.length].fn);
    }
    Play.autoGameN(st, choosers);
    winFlags.push((st.winner !== 'draw' && st.winner != null && st.winner < KIT) ? 1 : 0);
    sink.rounds += st.round;
    seq.push(g + ':' + stream.join('>') + '=' + String(st.winner) + '/' + st.round);
  }
  const counts = B.countPlanOff();
  const hash = createHash('sha1').update(seq.join('#')).digest('hex').slice(0, 12);
  B.resetPlanOffStat();
  return { spec: spec, callSetter: callSetter, hash: hash, counts: counts, winFlags: winFlags,
    skipTotal: Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0),
    winPct: 100 * (winFlags.reduce(function (a, b) { return a + b; }, 0) / GAMES),
    kinds: Object.keys(sink.kitKinds).length,
    actsPerGame: sink.acts / (KIT * GAMES), avgRounds: sink.rounds / GAMES };
}
/* 逐局配对差的 95% 区间（`d = 本臂赢没赢 − 基线赢没赢`，同一颗种子同一副牌 ⇒ 轨迹分叉带来的额外散布被 SE 吸收，
 *   而不是被"我们是配对设计"这句话抹掉——见 §E695 的读法段）。 */
function pairedDiff(arm, base) {
  const d = [];
  for (let i = 0; i < GAMES; i++) d.push(arm.winFlags[i] - base.winFlags[i]);
  const m = d.reduce(function (a, b) { return a + b; }, 0) / GAMES;
  const v = d.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / Math.max(1, GAMES - 1);
  const se = Math.sqrt(v / GAMES);
  return { pt: 100 * m, lo: 100 * (m - 1.96 * se), hi: 100 * (m + 1.96 * se), z: se > 0 ? Math.abs(m) / se : 0 };
}

if (B.planOffOn().length !== 0) {
  console.error('⛔ 进程起步时开关不是空集（' + JSON.stringify(B.planOffOn()) + '）⇒ 基线臂不成立，本批作废');
  process.exit(3);
}
const baseline = armRun(null, false);           // 出厂（从不调 setter）
const blankArm = armRun('', true);              // 调 setter 但传空 ⇒ A4 用
const arms = [baseline, blankArm];
for (const id of want) arms.push(armRun(id, true));
/* A5 仪器自复现：出厂臂在**同一进程里**再跑一遍，hash 必须逐字相同。
 *   ⚠ 这条不是"X 跟 X 比"那种自反假对照（[[feedback-subcell-control]] ⑧(a) 否掉的是"拿被考对象跟它自己配对"）；
 *     它要防的是**臂间漏状态**：模块级的东西（bot 的 `__mem`、计划层计数器）从上一臂带进下一臂时，
 *     "第一遍"与"第二遍"就会分开 —— 本仓 §E209 记过这个坑，这次它真的把一批读数污染了（见 §E695）。
 *   ⚑ 第一版这里写的是"再调一次**不调 setter** 的出厂臂"，被自己抓了个正着：**不调 setter ≠ 开关是空的**
 *     （上一根臂留下的 `P3` 还挂着）⇒ 复现臂必须显式传空串。 */
const baseline2 = armRun('', true);

/* ===== 五条腿（A1/A2/A3/A4/A5；A0 是入口校验，单独在文件开头）===== */
const teeth = [];
teeth.push(['A4 出厂无害（空串臂 vs 从不调 逐字）', blankArm.hash === baseline.hash, blankArm.hash + ' vs ' + baseline.hash]);
teeth.push(['A5 空串臂在跑完全部消融臂后再跑一遍逐字相同（查臂间漏状态）', baseline2.hash === baseline.hash, baseline2.hash + ' vs ' + baseline.hash]);
for (let i = 2; i < arms.length; i++) {
  const r = arms[i];
  teeth.push(['A1 ' + r.spec + '：计数=0 ⇒ hash 必须不变（查"开关有副作用"）', !(r.skipTotal === 0 && r.hash !== baseline.hash),
    '计数 ' + r.skipTotal + ' ‖ hash ' + (r.hash === baseline.hash ? '不变' : '**变了**')]);
  teeth.push(['A2 ' + r.spec + '：计数>0 ⇒ hash 必须变（查"计数是假的/没真挡住"）', !(r.skipTotal > 0 && r.hash === baseline.hash),
    '计数 ' + r.skipTotal + ' ‖ hash ' + (r.hash === baseline.hash ? '不变' : '变')]);
}
const anyLive = arms.slice(2).some(function (r) { return r.skipTotal > 0 && r.hash !== baseline.hash; });
teeth.push(['A3 至少一臂"按住且真的改变行为"', anyLive, anyLive ? '有' : '**没有一臂改变行为 ⇒ 这个旋钮是装饰**']);
const teethOK = teeth.every(function (t) { return t[1]; });

console.log('== 计划线逐线消融（§E695）· 桌 = ' + MODE + ' n=' + N + ' ‖ 杂货铺席 ' + KIT + ' 席 ‖ 对手 = ' + (N - KIT) + ' 席' +
  (USE_PACK ? '冠军（' + PACK + '，ε=0.15）' : '脚本（' + oppFns.map(o => o.name).join(' ‖ ') + '，按席位轮转）') + ' ==');
console.log('   配对：' + GAMES + ' 局 × 每臂 ‖ seed0=' + SEED0 + '（同 seed 同 slotSalt ⇒ 除开关外逐字同装配）');
console.log('   基线出手序列 hash = ' + baseline.hash);
console.log('\n   线     含义                                        计数  hash        该侧胜率%   配对Δ(95%CI)          种类  出手/局  平均回合');
for (const r of arms) {
  const label = r.spec === null ? '（出厂）' : (r.spec === '' ? '（空串）' : r.spec);
  const pd = pairedDiff(r, baseline);
  const ci = r.spec === null ? '（基线）' : (pd.pt.toFixed(1) + ' [' + pd.lo.toFixed(1) + ',' + pd.hi.toFixed(1) + ']' + (pd.z >= 2 ? ' >2σ' : ''));
  console.log('   ' + label.padEnd(6) + (KNOWN[r.spec || ''] || '—— 基线：不关任何线 ——').slice(0, 40).padEnd(42) +
    String(r.skipTotal).padStart(5) + '  ' + (r.hash === baseline.hash ? '不变' : r.hash).padEnd(12) +
    r.winPct.toFixed(1).padStart(8) + '  ' + ci.padEnd(24) +
    String(r.kinds).padStart(5) + String(r.actsPerGame.toFixed(1)).padStart(9) + String(r.avgRounds.toFixed(1)).padStart(9));
}
console.log('\n   尺子自证（预注册五条腿，逐字比较）：');
for (const t of teeth) console.log('     ' + (t[1] ? '✅' : '❌') + ' ' + t[0].padEnd(46) + ' ' + t[2]);
console.log('   ⇒ ' + (teethOK ? '**五条腿全过，逐线差可引用**' : '**有腿不过 ⇒ 本批逐线差一律作废**'));
if (!QUIET) {
  console.log('\n   读法：`计数` = 这条线在本批里被按住过多少次（= 它本来会出手的次数）；`Δ夺冠` 是同一批种子的配对差，不是两组样本。');
  console.log('   ⚠ 两条边界：① 计数=0 的线，本批**没有判语权**（"关掉没变化"是结构性的，不能写成"这条线没用"）；');
  console.log('              ② 关掉一条线会改变它下游分支的机会成本（P4 按住 ⇒ 那些手落到 P3/P1/地板），');
  console.log('                 所以 Δ 是"**这条线在这一整套次序里**值多少"，不是它单独的因果效应；要拆边际只能逐线**加**回去（那是另一台尺）。');
}
process.exit(teethOK ? 0 : 3);
