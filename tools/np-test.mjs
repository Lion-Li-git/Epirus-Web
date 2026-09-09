/* Epirus N 人（3-5）引擎测试：随机对局 fuzz + 关键裁定点（docs/RULES-NP.md） */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, X = sb.window.EpirusResolve, Play = sb.window.EpirusPlay;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let PASS = 0, FAIL = 0;
function t(name, fn) {
  try { fn(); PASS++; console.log('  ✔ ' + name); }
  catch (e) { FAIL++; console.log('  ✘ ' + name + '  → ' + e.message); }
}
function ok(c, m) { if (!c) throw new Error(m || 'assert failed'); }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' got=' + a + ' want=' + b); }

/* 随机 chooser：可负担里随机挑，随机挑一个存活对手 */
function randChooser(state, pid, legal) {
  const aff = legal.filter(function (l) { return l.affordable; });
  if (!aff.length) return R.SK.JI;
  const pick = aff[Math.floor(state.rng.next() * aff.length)];
  const opps = S.opponentsOf(state, pid);
  const target = opps.length ? opps[Math.floor(state.rng.next() * opps.length)] : null;
  return { key: pick.key, target };
}

console.log('== N 人引擎测试 ==');

t('N1 人数：createState 默认 2 人；multi 模式可 3/4/5 人', function () {
  eq(S.createState('standard').p.length, 2, '默认 2 人');
  for (const n of [3, 4, 5]) {
    const st = S.createState('multi', { next: mulberry32(n) }, n);
    eq(st.p.length, n, n + ' 人');
    eq(st.actions.length, n, n + ' 行动槽');
    eq(st.n, n, 'n 字段');
  }
});

t('N2 多人模式含双枪（镜面本版未实现，N11）', function () {
  const st = S.createState('multi', { next: mulberry32(1) }, 3);
  ok(S.canUseSkillInMode(st, R.SK.DUAL_GUN), '双枪可用');
  ok(!S.canUseSkillInMode(st, R.SK.MIRROR), '镜面未实现→不可用');
  const st2 = S.createState('standard', { next: mulberry32(1) }, 2);
  ok(!S.canUseSkillInMode(st2, R.SK.DUAL_GUN), '标准模式双枪不可用');
});

t('目标：attemptAction 记录 action.target，resolveTarget 兜底第一个存活对手', function () {
  const st = S.createState('multi', { next: mulberry32(7) }, 3);
  st.p[0].ep = 5;
  S.attemptAction(st, 0, R.SK.GUN, { target: 2 });
  eq(st.actions[0].target, 2, '显式目标');
  S.attemptAction(st, 1, R.SK.GUN, {});
  ok(st.actions[1].target !== null && st.actions[1].target !== 1, '兜底目标≠自己');
});

t('N3 小雷逐边：A→B 使 B 作废（B 未反击 A）', function () {
  const st = S.createState('multi', { next: mulberry32(11) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.actions[1].voided, 'B 的枪被小雷作废');
  ok(!st.actions[0].voided, 'A 的小雷成立');
});

t('N3b 小雷互雷成环（2 人边）：双方作废', function () {
  const st = S.createState('multi', { next: mulberry32(12) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.actions[0].voided && st.actions[1].voided, '互雷成环双方作废');
  ok(st.events.some(function (e) { return e.type === 'thunderRing'; }), 'thunderRing 事件');
});

t('N10 胜负：最后存活者胜', function () {
  const st = S.createState('multi', { next: mulberry32(13) }, 3);
  st.p[1].hp = 0; st.p[2].hp = 0;
  X.checkOver(st);
  eq(st.winner, 0, '仅 P0 存活 → 胜');
});

t('N10b 胜负：同回合全灭 = 平局', function () {
  const st = S.createState('multi', { next: mulberry32(14) }, 4);
  for (const p of st.p) p.hp = 0;
  X.checkOver(st);
  eq(st.winner, 'draw', '全灭平局');
});

t('N10c 回合上限：血量最高者胜；并列平局', function () {
  const st = S.createState('multi', { next: mulberry32(15) }, 3);
  st.round = R.MAX_ROUNDS;
  st.p[0].hp = 2; st.p[1].hp = 1.5; st.p[2].hp = 0;
  X.checkOver(st);
  eq(st.winner, 0, '血最高者胜');
  const st2 = S.createState('multi', { next: mulberry32(16) }, 3);
  st2.round = R.MAX_ROUNDS;
  st2.p[0].hp = 2; st2.p[1].hp = 2; st2.p[2].hp = 1;
  X.checkOver(st2);
  eq(st2.winner, 'draw', '并列最高平局');
});

t('N8 铁索：边共享伤害且不递归（A-B-C 链，只共享直接边）', function () {
  const st = S.createState('multi', { next: mulberry32(17) }, 3);
  st.p[0].chains = [1]; st.p[1].chains = [0, 2]; st.p[2].chains = [1];
  st.p[0].hp = st.p[1].hp = st.p[2].hp = 3;
  X.rawDamage(st, 0, 1, '测试', 'test', {});
  eq(st.p[0].hp, 2, 'A 自身');
  eq(st.p[1].hp, 2, 'B 通过 A 的边共享');
  eq(st.p[2].hp, 3, 'C 不共享（铁索图不递归 N8）');
  // 直接打 B：A 与 C 都共享
  st.p[0].hp = st.p[1].hp = st.p[2].hp = 3;
  X.rawDamage(st, 1, 1, '测试', 'test', {});
  eq(st.p[1].hp, 2, 'B 自身');
  eq(st.p[0].hp, 2, 'A 共享');
  eq(st.p[2].hp, 2, 'C 共享');
});

t('N3 双枪射手：对两个目标各 1 点', function () {
  const st = S.createState('multi', { next: mulberry32(18) }, 3);
  st.p[0].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.DUAL_GUN, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.JI, {});
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 2, '目标1 受伤');
  eq(st.p[2].hp, 2, '目标2 受伤');
  eq(st.p[0].hp, 3, '自身不受伤');
});

t('fuzz：3/4/5 人随机对局无异常，且必然收敛', function () {
  for (const n of [3, 4, 5]) {
    for (let g = 0; g < 120; g++) {
      const st = S.createState('multi', { next: mulberry32(1000 + g * 31 + n) }, n);
      const ch = [];
      for (let i = 0; i < n; i++) ch.push(randChooser);
      const w = Play.autoGameN(st, ch);
      ok(st.over, '必须结束');
      ok(w === 'draw' || (typeof w === 'number' && w >= 0 && w < n), '合法胜者: ' + w);
      ok(st.round <= R.MAX_ROUNDS, '回合上限内: ' + st.round);
      for (const p of st.p) ok(isFinite(p.hp), 'HP 有限');
    }
  }
});

t('autoGame 2 人入口仍可用（数组/位置参数两种）', function () {
  const st = S.createState('standard', { next: mulberry32(21) }, 2);
  const w1 = Play.autoGame(st, randChooser, randChooser);
  ok(st.over, '位置参数入口收敛');
  const st2 = S.createState('standard', { next: mulberry32(22) }, 2);
  const w2 = Play.autoGame(st2, [randChooser, randChooser]);
  ok(st2.over, '数组入口收敛');
});

console.log('\nN人测试：通过 ' + PASS + ' / ' + (PASS + FAIL));
process.exit(FAIL ? 1 : 0);
