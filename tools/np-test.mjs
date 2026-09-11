/* Epirus N 人（3-5）引擎测试：随机对局 fuzz + 关键裁定点（docs/RULES-NP.md） */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
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

t('N2 多人模式含全部多人专用技能（双枪 + 镜面）', function () {
  const st = S.createState('multi', { next: mulberry32(1) }, 3);
  ok(S.canUseSkillInMode(st, R.SK.DUAL_GUN), '双枪可用');
  ok(S.canUseSkillInMode(st, R.SK.MIRROR), '镜面可用');
  const st2 = S.createState('standard', { next: mulberry32(1) }, 2);
  ok(!S.canUseSkillInMode(st2, R.SK.DUAL_GUN), '标准模式双枪不可用');
  ok(!S.canUseSkillInMode(st2, R.SK.MIRROR), '标准模式镜面不可用');
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

t('N14 镜面反射：复制目标的伤害技能打输出对象', function () {
  const st = S.createState('multi', { next: mulberry32(31) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });   // 复制 P1 → 打 P2
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });                 // P1 用枪打 P0
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, 'P2 被复制来的枪打中');
  eq(st.p[0].hp, 2, 'P1 的枪打中 P0');
  eq(st.p[1].hp, 3, 'P1 未受伤');
  ok(st.events.some(function (e) { return e.type === 'mirror'; }), 'mirror 事件');
});

t('N14b 镜面反射：复制双枪只算一枪；镜面本身不可复制', function () {
  const st = S.createState('multi', { next: mulberry32(32) }, 4);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.DUAL_GUN, { target: 0, target2: 3 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 3, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, '复制双枪只算 1 伤');
  eq(st.p[0].hp, 2, '双枪打 P0');
  eq(st.p[3].hp, 2, '双枪打 P3');
});

t('N15 反复横跳：镜面边成环 → 所有使用者受 1 点光&火', function () {
  const st = S.createState('multi', { next: mulberry32(33) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });   // 1->2
  S.attemptAction(st, 1, R.SK.MIRROR, { target: 2, target2: 0 });   // 2->0
  S.attemptAction(st, 2, R.SK.MIRROR, { target: 0, target2: 1 });   // 0->1
  X.resolveActions(st);
  eq(st.p[0].hp, 2, 'P0 受 1 点光&火');
  eq(st.p[1].hp, 2, 'P1 受 1 点光&火');
  eq(st.p[2].hp, 2, 'P2 受 1 点光&火');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '反复横跳'; }), '反复横跳事件');
});

t('N16 聚光炮：互镜且输出同一人 → 该人受 1 点光&火', function () {
  const st = S.createState('multi', { next: mulberry32(34) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MIRROR, { target: 1, target2: 2 });
  S.attemptAction(st, 1, R.SK.MIRROR, { target: 0, target2: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 2, 'P2 受 1 点光&火');
  eq(st.p[0].hp, 3, 'P0 不受伤');
  eq(st.p[1].hp, 3, 'P1 不受伤');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '聚光炮'; }), '聚光炮事件');
});

t('N17 合二为一：两人同时小雷打同一人 → 额外 1 电伤', function () {
  const st = S.createState('multi', { next: mulberry32(35) }, 3);
  for (const p of st.p) p.ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINI_T, { target: 2 });
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 2 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.actions[2].voided, 'P2 行动被小雷作废');
  eq(st.p[2].hp, 2, 'P2 额外受 1 电伤');
  ok(st.events.some(function (e) { return e.type === 'hidden' && e.name === '合二为一'; }), '合二为一事件');
});

t('N18 光&火复合伤害：藤甲火弱 +1、吸血鬼光弱 +1 可叠加', function () {
  const st = S.createState('multi', { next: mulberry32(36) }, 3);
  for (const p of st.p) p.ep = 5;
  st.p[2].fireWeakNow = true; st.p[2].vampire = true;
  X.rawDamage(st, 2, 1, '聚光炮', 'focusCannon', { type: R.DMG.FIRELIGHT });
  eq(st.p[2].hp, 0, '1 + 藤甲 1 + 光弱 1 = 3 伤');
});

t('N19 多人冠军包：可加载且维度兼容', function () {
  const P = sb.window.EpirusPolicy;
  const pack = sb.window.EPIRUS_CHAMPION_3P;
  ok(!!pack, '存在 EPIRUS_CHAMPION_3P');
  const chk = P.checkPack(pack);
  ok(chk.ok, 'checkPack: ' + JSON.stringify(chk));
  const params = P.unpack(pack);
  ok(!!params && params.length === P.paramCount(), 'unpack 长度=' + (params ? params.length : 'null'));
  ok(pack.f === P.FEAT_S && pack.h === P.HID, 'f/h 一致');
});

t('N4 相抵必须“互为目标”：两家同打第三人 → 各中一枪', function () {
  const st = S.createState('multi', { next: mulberry32(41) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 0, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[0].hp, 1, 'P0 中两枪');
  ok(!st.actions[1].voided && !st.actions[2].voided, '两枪都没被相抵');
});

t('N4b 互为目标仍相抵（2 人回归）', function () {
  const st = S.createState('standard', { next: mulberry32(42) }, 2);
  st.p[0].ep = st.p[1].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  ok(st.actions[0].voided && st.actions[1].voided, '互枪相抵');
  eq(st.p[0].hp, 3, '无人受伤');
});

t('N4c 高优先级打第三人，不作废别人对同一目标的攻击', function () {
  const st = S.createState('multi', { next: mulberry32(43) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.SWORD, { target: 2 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(!st.actions[1].voided, 'P1 的枪不被 P0 的剑作废');
  eq(st.p[2].hp, 1, 'P2 各中 1 点');
});

t('N12 已淘汰玩家不能行动', function () {
  const st = S.createState('multi', { next: mulberry32(44) }, 3);
  st.p[1].hp = 0; st.p[1].ep = 5;
  const r = S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  eq(r.outcome, 'invalid', '被拒绝');
  ok(st.actions[1].voided, '行动作废');
});

t('N12b 每回合重置行动槽：死人不会沿用上回合行动', function () {
  const st = S.createState('multi', { next: mulberry32(45) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 1, R.SK.GUN, { target: 0 });
  S.attemptAction(st, 2, R.SK.JI, {});
  S.attemptAction(st, 0, R.SK.JI, {});
  X.resolveActions(st); X.endTurn(st);
  st.p[1].hp = 0;
  X.startTurn(st);
  ok(st.actions[1] === null, '行动槽已清空');
});

t('N6 大雷连带：攻击被雷劈中者 → 攻击者受 1 电伤且攻击作废', function () {
  const st = S.createState('multi', { next: mulberry32(46) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 2, R.SK.GUN, { target: 1 });
  S.attemptAction(st, 1, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[1].hp, 1, 'P1 中 2 电');
  eq(st.p[2].hp, 1, 'P2 受 2 点连带伤');
  ok(st.actions[2].voided, 'P2 的攻击被连带无效化');
  eq(st.p[2].cooldown[R.SK.GUN], 4, '连带者的技能（枪）被禁用 3 回合');
});

t('N6b 大雷连带：被雷劈者攻击第三人 → 第三人受连带', function () {
  const st = S.createState('multi', { next: mulberry32(47) }, 3);
  st.p[0].ep = st.p[1].ep = st.p[2].ep = 5;
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.GUN, { target: 2 });
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  eq(st.p[2].hp, 1, 'P2 受 2 点连带电伤');
  ok(st.actions[2].voided, 'P2 的行动同样被作废');
});

t('目标反锁：上回合与某对手互为目标而相抵 → 本回合不再打他', function () {
  const T = sb.window.EpirusTrainer;
  const st = S.createState('multi', { next: mulberry32(51) }, 3);
  st.round = 5; st.p[1].hp = 2; st.p[2].hp = 2;
  st.events.push({ type: 'cancel', pids: [0, 2], round: 4 });
  ok(T.pickTargetN(st, 0, R.SK.GUN) !== 2, '不再打 P2（反锁）');
});

t('目标选择：能一击必杀先杀；否则打血量最高的领先者', function () {
  const T = sb.window.EpirusTrainer;
  const a = S.createState('multi', { next: mulberry32(52) }, 3);
  a.round = 5; a.p[1].hp = 1; a.p[2].hp = 3;
  eq(T.pickTargetN(a, 0, R.SK.GUN), 1, '能杀 P1 就杀');
  const b = S.createState('multi', { next: mulberry32(53) }, 3);
  b.round = 5; b.p[1].hp = 2; b.p[2].hp = 3;
  eq(T.pickTargetN(b, 0, R.SK.GUN), 2, '打领先者 P2');
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

t('N2 同优先级同时结算：三方互放大雷 → 人人挨打（低 pid 不再免伤）', function () {
  const st = S.createState('multi', { next: mulberry32(42) }, 3);
  for (let i = 0; i < 3; i++) { st.p[i].ep = 5; st.p[i].elec = 1; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st, 1, R.SK.BIG_T, { target: 2 });
  S.attemptAction(st, 2, R.SK.BIG_T, { target: 0 });
  X.resolveActions(st);
  const hp = st.p.map(function (p) { return p.hp; });
  ok(hp[0] < 3 && hp[1] < 3 && hp[2] < 3,
    '三人应各受伤害（快照结算），实际 HP=' + hp.join('/'));
});

t('N2 座位偏置：3x 同一策略各座位 1st 率接近均等', function () {
  const B = sb.window.EpirusBots, T = sb.window.EpirusTrainer;
  const sel = T.wrapBotN(B.pickBreakDef);
  const GAMES = 80, first = [0, 0, 0];
  let drawn = 0;
  for (let g = 0; g < GAMES; g++) {
    const r = T.oneGameN([sel, sel, sel], 31337 + g * 977, 3);
    if (typeof r.winner !== 'number') drawn++; else first[r.winner]++;
  }
  const decided = GAMES - drawn;
  ok(decided >= 30, '有效样本不足 decided=' + decided);
  const pct = first.map(function (c) { return c / decided * 100; });
  const spread = Math.max.apply(null, pct) - Math.min.apply(null, pct);
  ok(spread <= 32,
    '座位偏置过大 ' + pct.map(function (v) { return v.toFixed(1); }).join('/') + '% 极差=' + spread.toFixed(1) + 'pt（修复前为 73.5pt）');
});


/* ===== N20 地雷 AoE（用户裁定 2026-09-11）=====
 * 旧实现是 2 人口径"只让攻击者受 1 火伤"；而 2 人局里「全场其他角色」与「攻击者」**恰好同一人**
 * ⇒ 两种读法在 2 人下无法区分，multi 加入时未回头核对。以下用例必须 N≥3 才测得出。 */
t('N20a 地雷直接触发：4 人 a/b/c 装雷、d 打 a → 除 a 外各 1；b/c 间接触发合并一波打 a/d', function () {
  const st = S.createState('multi', { next: mulberry32(7) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  eq(st.p[0].mineArmed, false, 'a 的雷被直接触发后消耗');
  eq(st.p[1].mineArmed, false, 'b 的雷被间接触发后消耗');
  eq(st.p[2].mineArmed, false, 'c 的雷被间接触发后消耗');
  eq(st.p[0].hp, 3, 'a：d 的枪 1 + 间接触发波 1');
  eq(st.p[1].hp, 4, 'b：只挨 a 的直接波 1');
  eq(st.p[2].hp, 4, 'c：只挨 a 的直接波 1');
  eq(st.p[3].hp, 3, 'd：a 的直接波 1 + 间接触发波 1');
});

t('N20b 直接触发无上限：d 双枪打 a,b → a/b 各一波 + c 间接触发合并一波 = 共 3 波', function () {
  const st = S.createState('multi', { next: mulberry32(11) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.DUAL_GUN, { target: 0, target2: 1 });
  X.resolveActions(st);
  eq(st.p[0].hp, 2, 'a：双枪 1 + b 直接波 1 + c 间接触发波 1');
  eq(st.p[1].hp, 2, 'b：双枪 1 + a 直接波 1 + c 间接触发波 1');
  eq(st.p[2].hp, 3, 'c：a 直接波 1 + b 直接波 1（间接触发者豁免自己那波）');
  eq(st.p[3].hp, 2, 'd：a 直接波 1 + b 直接波 1 + c 间接触发波 1');
});

t('N20c 地雷伤害无来源：事件 source=null → 不被铁索共享', function () {
  const st = S.createState('multi', { next: mulberry32(13) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  st.p[0].chains = [1]; st.p[1].chains = [0];
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  ok(md.length > 0, '应有地雷伤害事件');
  ok(md.every(function (e) { return e.source == null; }), '地雷伤害事件 source 必须为 null');
  eq(st.p[1].hp, 3, 'b：铁索共享 d 的枪 1 + a 的直接波 1；雷伤不共享故不再掉');
});

t('N20d 火弱逐目标：地雷 AoE 只对挂了藤甲 debuff 的那一个 +1', function () {
  const st = S.createState('multi', { next: mulberry32(17) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  st.p[1].fireWeakNow = true;            // 只给 b 挂火弱（模拟此前被藤甲贴过）
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 1, R.SK.MINE, {});
  S.attemptAction(st, 2, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.GUN, { target: 0 });
  X.resolveActions(st);
  const md = st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; });
  const toB = md.filter(function (e) { return e.to === 1; });
  ok(toB.length > 0, 'b 应吃到地雷伤害');
  eq(toB[0].amt, 2, 'b 挂了火弱 → 这一发 2 点');
  ok(md.filter(function (e) { return e.to !== 1; }).every(function (e) { return e.amt === 1; }),
    '其他没挂火弱的人只吃 1 点');
  eq(st.p[0].hp, 3, 'a：d 的枪 1 + 间接触发波 1');
  eq(st.p[1].hp, 3, 'b：直接波 2（含火弱 +1），间接触发者豁免自己那波');
  eq(st.p[2].hp, 4, 'c：直接波 1');
  eq(st.p[3].hp, 3, 'd：直接波 1 + 间接触发波 1');
});

t('N20e 狙击枪豁免只针对那一次攻击：狙击打持雷者不触发，雷仍装着', function () {
  const st = S.createState('multi', { next: mulberry32(19) }, 4);
  for (let i2 = 0; i2 < 4; i2++) { st.p[i2].hp = 5; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.MINE, {});
  S.attemptAction(st, 3, R.SK.SNIPE, { target: 0 });
  X.resolveActions(st);
  ok(st.p[0].hp < 5, 'a 应挨到狙击伤害（点数随爆头判定变化，本用例只锁豁免不变量）');
  eq(st.p[0].mineArmed, true, '狙击枪攻击不触发地雷 → 雷仍然装着');
  eq(st.events.filter(function (e) { return e.type === 'damage' && e.via === 'mine'; }).length, 0,
    '不应产生任何地雷伤害事件');
  eq(st.p[1].hp, 5, 'b 未被波及');
  eq(st.p[3].hp, 5, 'd 未被波及');
});

/* 千问建议的硬规矩：训练路径禁止裸 Math.random / Date.now —— 随机只能来自
 * state.rng 或 P.setRng 注入的流。这次不可复现的根因就是 server 里两处 Node 作用域的裸调用
 * （__seedSandbox 只管 vm 沙箱，管不到 Node 全局）。加自动检查防止再犯。
 * 白名单：明确的兜底分支 / 超时与时间戳（不参与决策）。 */
t('REPRO 训练路径不得出现裸 Math.random / Date.now（白名单见下）', function () {
  const WL = [
    'js/train/bots.js',            // rnd() 的 Math.random 兜底（浏览器无 state.rng 时）
    'js/train/policy.js',          // __rng 的默认值 Math.random（可被 setRng 覆盖）
    'T.mulberry32 ? T.mulberry32', // 播种流不可用时的显式兜底
    'Date.now() - t0 > cap',       // 30 分钟超时上限（不参与决策）
    'Date.now() % ',               // 仅允许作为"已废弃写法"的检测目标，不应出现在有效代码
  ];
  const files = ['server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs'];
  const bad = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      const t0 = L.trim();
      if (t0.startsWith('*') || t0.startsWith('//') || t0.startsWith('/*')) continue;   // 注释不算
      const hasRand = L.indexOf('Math.random(') >= 0;
      const hasClock = L.indexOf('Date.now(') >= 0;
      if (!hasRand && !hasClock) continue;
      if (WL.some(function (w) { return L.indexOf(w) >= 0 || f.indexOf(w) >= 0 && w.indexOf('/') >= 0; })) continue;
      if (L.indexOf('const t0 = Date.now()') >= 0) continue;   // 纯计时（不参与决策）
      if (L.indexOf('Date.now() - t0') >= 0) continue;      // 超时
      if (L.indexOf('toISOString') >= 0) continue;          // 时间戳（meta 用）
      if (L.indexOf('toString(36)') >= 0) continue;         // cache-busting token
      if (L.indexOf('mulberry32') >= 0) continue;           // 播种兜底
      bad.push(f + ':' + (i + 1) + '  ' + L.trim().slice(0, 70));
    }
  }
  eq(bad.length, 0, '训练路径出现裸随机/时间源：\n    ' + bad.join('\n    '));
});

t('N21 大雷不失效/不禁用小雷（非空版）：小雷打第三方时大雷正常结算，此时才看得出豁免', function () {
  /* 空用例的教训：若被大雷打的人**自己**用了小雷，小雷(pri5)会先作废大雷本身，
   * 大雷压根不结算 -> 禁用与否都是 0，用例恒过。
   * 必须让小雷**打第三方**，大雷才不会被作废、才会真的走到"要不要禁用目标技能"这一步。 */
  const st = S.createState('multi', { next: mulberry32(23) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st.p[i2].hp = 8; st.p[i2].ep = 9; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.BIG_T, { target: 1 });      // 大雷 pri4 -> P1
  S.attemptAction(st, 1, R.SK.MINI_T, { target: 2 });     // 小雷 pri5 -> **P2**（不干扰 P0 的大雷）
  S.attemptAction(st, 2, R.SK.JI, {});
  X.resolveActions(st);
  ok(st.events.some(function (e) { return e.type === 'ban'; }), '大雷应已结算并发出 ban 事件（否则用例又是空的）');
  eq(st.p[1].cooldown[R.SK.MINI_T] || 0, 0, '小雷不应被大雷禁用');

  // 对照组：目标用普通技能（激光剑）时**应当**被禁用
  const st2 = S.createState('multi', { next: mulberry32(29) }, 3);
  for (let i2 = 0; i2 < 3; i2++) { st2.p[i2].hp = 8; st2.p[i2].ep = 9; }
  X.startTurn(st2);
  S.attemptAction(st2, 0, R.SK.BIG_T, { target: 1 });
  S.attemptAction(st2, 1, R.SK.SWORD, { target: 0 });
  S.attemptAction(st2, 2, R.SK.JI, {});
  X.resolveActions(st2);
  ok((st2.p[1].cooldown[R.SK.SWORD] || 0) > 0, '非防御类技能(激光剑)应被大雷禁用');
});

console.log('\nN人测试：通过 ' + PASS + ' / ' + (PASS + FAIL));
process.exit(FAIL ? 1 : 0);
