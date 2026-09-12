/* 机制诊断：在 chooser 内部补 ep / 珠子，到底能不能让贵技能真的出手？
 *
 * 用法: node tools/grant-mech-diag.mjs
 *
 * 起因（v1.3.54）:
 *   为了给"深经济锁死"做诊断，我用 tools/subsidy-diag.mjs 测冠军在补贴下出不出贵技能。
 *   写完后我发现 js/core/play.js:50-53 是这么写的:
 *       const legal = legalActions(state, pid);      // affordable 在这里就按当时 ep 算好
 *       const raw = normPick(ch(state, pid, legal, ...));
 *       const l = legal.find(x => x.key === raw.key);
 *       const k = (ch && ch.whiffOk) ? raw.key : ((l && l.affordable) ? raw.key : R.SK.JI);
 *   于是我在 chooser 里写 `pl.ep = Math.max(pl.ep, 5)` 是**当回合无效**的:
 *   贵技能已被 affordable:false 挡在采样集外，就算选出来也会被强制改回 ジ。
 *
 *   但"当回合无效" != "永远无效"——被改的是**真实 state**，所以从下一回合的
 *   legalActions 开始，贵技能就真的可负担了。这两种解读对 evalEconProbe 那个
 *   历史结论的含义完全相反:
 *     解读 A(纯假象): 那个探针从来没测到过任何东西 -> "构造上不可满足"是测量错误;
 *     解读 B(只有首回合盲): 除每局第 1 回合外测量有效 -> "冠军不买贵技能"是真实结论。
 *   本脚本直接实测判定。教训是项目自己那条: 先验证你依赖的前置条件。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, R = W.EpirusRules, S = W.EpirusState, X = W.EpirusResolve, Play = W.EpirusPlay;

function rng(s) {
  let a = s >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const RING = R.SK.RING, BIG = R.SK.BIG_T;
console.log('RING=' + RING + '  BIG_T=' + BIG + '  (RING 首次 3 ジ, BIG_T 5 ジ)');
console.log('');

/* --- 实验 1: chooser 内部补 ep，且**不**重算 affordable（evalEconProbe 的手法）--- */
function exp1() {
  const st = S.createState('multi', { next: rng(5) }, 3);
  for (let i = 0; i < 3; i++) { st.p[i].ep = 2; st.p[i].elec = 0; st.p[i].boom = 0; }
  const seenAff = [];           // 每次决策时，RING 在 legal 里是否 affordable
  let calls = 0;
  const ch = function (state, pid, legal) {
    calls++;
    state.p[pid].ep = Math.max(state.p[pid].ep, 99);       // 只在 chooser 内部补
    const l = legal.find(function (x) { return x.key === RING; });
    seenAff.push(l ? l.affordable : null);
    return { key: BIG, target: 1, target2: null };         // 一直要贵的
  };
  Play.autoGameN(st, [ch, ch, ch]);
  const used = st.events.filter(function (e) { return e.via === BIG || e.via === RING; }).length;
  console.log('实验1  只在 chooser 内补 ep=99（不重算 affordable）');
  console.log('  决策次数=' + calls + '  首 6 次 RING 的 affordable=' + JSON.stringify(seenAff.slice(0, 6)));
  console.log('  贵/环技能实际出手次数=' + used + '  ringStreak=' + JSON.stringify(st.p.map(function (p) { return p.ringStreak; })));
  console.log('  => ' + (used > 0 ? '解读 B 成立：补的 ep 留到了下一回合，贵技能**后来真的能出**' : '解读 A 成立：补 ep 完全无效，贵技能永远出不来'));
  return used;
}

/* --- 实验 2: 一次性补 + **重算** affordable（我修好的 subsidy 探针的手法）--- */
function exp2() {
  const st = S.createState('multi', { next: rng(5) }, 3);
  for (let i = 0; i < 3; i++) { st.p[i].ep = 2; st.p[i].elec = 0; st.p[i].boom = 0; }
  let granted = false, firstTurnAff = null, calls = 0;
  const ch = function (state, id, legal) {
    calls++;
    if (!granted) {
      granted = true;
      const pl = state.p[id];
      pl.ep = Math.max(pl.ep, 6);
      for (let i = 0; i < legal.length; i++) {
        const c = S.computeCost(state, id, legal[i].key);
        legal[i].affordable = !!(c && c.ok && c.ep <= pl.ep);
      }
      const l = legal.find(function (x) { return x.key === BIG; });
      firstTurnAff = l ? l.affordable : null;
    }
    return { key: BIG, target: 1, target2: null };
  };
  Play.autoGameN(st, [ch, ch, ch]);
  const used = st.events.filter(function (e) { return e.via === BIG; }).length;
  console.log('实验2  补 ep=6 且**重算 affordable**（v1.3.54 修法）');
  console.log('  同一回合 BIG_T 变为 affordable=' + firstTurnAff + '  贵技能出手次数=' + used);
  console.log('  => ' + (firstTurnAff === true ? '修法有效：当回合就可负担（这才是真正的"白给资源"）' : '修法无效'));
  return used;
}

/* --- 实验 3: 真正的 turn-start 通道（引擎 opts.regen），affordable 由引擎自己算 --- */
function exp3() {
  const st = S.createState('multi', { next: rng(5) }, 3, { regen: 6 });
  for (let i = 0; i < 3; i++) { st.p[i].ep = 0; }
  X.startTurn(st);
  const legal = Play.legalActions(st, 0);
  const l = legal.find(function (x) { return x.key === BIG; });
  console.log('实验3  引擎通道 opts.regen=6（在 startTurn 里发 ep，早于 legalActions）');
  console.log('  startTurn 后 ep=' + st.p[0].ep + '  BIG_T affordable=' + (l ? l.affordable : null));
  console.log('  => ' + ((l && l.affordable) ? '有效通道：这才是与训练侧 regenForGame 同源的口径' : '仍然不可负担'));
}

exp1();
console.log('');
exp2();
console.log('');
exp3();
