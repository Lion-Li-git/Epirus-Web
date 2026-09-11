/* Epirus — 脚本基准 AI。
 * 响应式经济（关键）：
 *  - 对手摆“防御架势”(防御/反弹/原型制御/金刚盾/藤甲/八卦阵/无极变速) → 优先出穿透技(狙击/电磁炮/坦克/激光剑/大雷)，
 *    若还差ジ则先攒到 2（否则狙击/坦克出不来）。
 *  - 对手正常/激进 → 能开枪就开枪（不憋），该守就守。
 * 这避免“为了破墙而一直攒ジ导致被活活打死”和“1ジ就开枪永远攒不到2ジ”的两个极端。
 */
(function (global) {
  'use strict';
  const R = global.EpirusRules;
  const SK = R.SK;

  /* 对手脚本的随机决策走游戏种子 rng，保证训练/评估可复现（bot 行为确定性，不再因 Math.random 抖动导致冠军不稳定） */
  function rnd(state) {
    return (state && state.rng && state.rng.next) ? state.rng.next() : Math.random();
  }
  function affOrJi(legal) {
    const a = legal.find(l => l.affordable);
    return a ? a.key : SK.JI;
  }
  /* N 人：对手解析（2 人=另一个；N 人=血量最低的存活对手） */
  function oppPidOf(state, pid) {
    let best = [], minHp = Infinity;
    for (let i = 0; i < state.p.length; i++) {
      if (i === pid) continue;
      const p = state.p[i];
      if (p.hp <= 0) continue;
      if (p.hp < minHp - 1e-9) { minHp = p.hp; best = [i]; }
      else if (Math.abs(p.hp - minHp) < 1e-9) best.push(i);
    }
    if (!best.length) { for (let i = 0; i < state.p.length; i++) { if (i !== pid) { best = [i]; break; } } }
    if (best.length === 1) return best[0];
    return best[Math.floor(rnd(state) * best.length)];   // 并列随机，避免 pid 偏差（N 人）
  }
  function oppOf(state, pid) {
    const i = oppPidOf(state, pid);
    return (i == null) ? state.p[0] : state.p[i];
  }

  function stanceOf(you) {
    const s = you.lastSkill;
    if (s === SK.GUARD || s === SK.SHIFT) return 'guard';          // 防御架势 → 需穿防御
    if (s === SK.REFLECT || s === SK.PROTO || s === SK.JINSHIELD || s === SK.ARMOR || s === SK.BAGUA) return 'reflect'; // 反弹/架势 → 需穿反弹
    return 'none';
  }
  function oppInDefense(you) { return stanceOf(you) !== 'none'; }

  /* 轻量跨回合记忆：跟踪“对手最近一次防御的回合”，区分循环防御者(每2回合防一次)与真激进者(从不防)。
   * bots 默认无状态；因 UI 预决策用 cloneState(会丢 state 上的字段)，这里用模块级、每局(round==1)重置。 */
  let __mem = { lastDefRound: -1000, oppMightDefend: false };
  function resetBotMem() { __mem = { lastDefRound: -1000, oppMightDefend: false }; }
  function noteOpp(state, pid) {
    if (state.round === 1) resetBotMem();
    const you = oppOf(state, pid);
    if (stanceOf(you) !== 'none') __mem.lastDefRound = state.round - 1;
    __mem.oppMightDefend = (state.round - __mem.lastDefRound) <= 2;  // 最近2回合内防过 → 可能再防
  }

  /* 最佳“能破当前架势”的攻击；只挑可负担（aff 已含可负担过滤）。返回 key 或 null。
   * 关键修正：对手摆防御架势时绝不打普通枪会被挡/反，要优先穿透技；
   *          反弹架势优先“穿反弹”的激光剑/狙击/电磁炮，防御架势优先“穿防御”的坦克。 */
  function pickAttack(me, you, byKey, aff) {
    const st = stanceOf(you);
    const out = [];
    // 通用穿防御+穿反弹（狙击/电磁炮/激光眼），最安全
    if (aff(SK.SNIPE)) out.push(SK.SNIPE);
    if (me.elec > 0 && aff(SK.RAILGUN)) out.push(SK.RAILGUN);
    if (me.boom > 0 && me.lastSkill !== SK.LASER_EYE && aff(SK.LASER_EYE)) out.push(SK.LASER_EYE);
    // 针对架势的便宜穿透
    if (st === 'guard') { if (aff(SK.TANK)) out.push(SK.TANK); }        // 坦克穿防御
    else if (st === 'reflect') { if (aff(SK.SWORD)) out.push(SK.SWORD); } // 激光剑穿反弹
    else { if (aff(SK.TANK)) out.push(SK.TANK); if (aff(SK.SWORD)) out.push(SK.SWORD); }
    if (me.ep >= 5 && aff(SK.BIG_T)) out.push(SK.BIG_T);   // 大雷：高爆发
    for (const k of out) if (aff(k)) return k;
    return null;
  }
  function wantPierce(me, you, byKey, aff) { return pickAttack(me, you, byKey, aff); }

  // 对手防御架势：要么穿透，要么攒到能穿透
  function reactDefense(me, you, byKey, aff) {
    const p = pickAttack(me, you, byKey, aff);
    if (p) return p;
    if (me.ep < 2 && aff(SK.JI)) return SK.JI;             // 攒到 2 能出穿透
    if (me.ep < 5 && aff(SK.JI)) return SK.JI;             // 继续攒大雷
    if (me.elec === 0 && aff(SK.CHARGE) && me.ep >= 2) return SK.CHARGE;
    return null;
  }
  // 对手正常/激进：优先穿透技；若对手最近防过(可能是循环防御)→攒穿透，否则可用枪抓机会
  function reactOffense(me, you, byKey, aff, allowGun) {
    const p = pickAttack(me, you, byKey, aff);
    if (p) return p;
    const useGun = allowGun || !__mem.oppMightDefend;   // 进攻型 bot，或对手不防 → 打枪
    if (useGun && stanceOf(you) === 'none' && aff(SK.GUN)) return SK.GUN;
    if (aff(SK.JI) && me.ep < (allowGun ? 3 : 2)) return SK.JI;
    if (allowGun && aff(SK.GUN)) return SK.GUN;   // 进攻兜底
    return null;
  }

  function pickRandom(state, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const pool = aff.length ? aff : legal;
    if (!pool.length) return SK.JI;
    return pool[Math.floor(rnd(state) * pool.length)].key;
  }

  function pickAggro(state, pid, legal) {
    const me = state.p[pid], you = oppOf(state, pid);
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (me.hp <= 1 && aff(SK.DRAIN)) return SK.DRAIN;
    if (oppInDefense(you)) { const r = reactDefense(me, you, byKey, aff); if (r) return r; }
    const r = reactOffense(me, you, byKey, aff, true); if (r) return r;
    if (me.mineArmed && aff(SK.TAUNT)) return SK.TAUNT;
    if (aff(SK.MINE)) return SK.MINE;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  function pickDefend(state, pid, legal) {
    const me = state.p[pid], you = oppOf(state, pid);
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (me.hp <= 1.5 && aff(SK.GUARD)) return SK.GUARD;
    if (me.hp <= 2 && you.ep >= 2 && aff(SK.PROTO)) return SK.PROTO;
    if (me.ep >= 3 && aff(SK.MINE)) return SK.MINE;
    if (me.ep >= 2 && aff(SK.TRANSFER)) return SK.TRANSFER;
    if (oppInDefense(you)) { const r = reactDefense(me, you, byKey, aff); if (r) return r; }
    const r = reactOffense(me, you, byKey, aff, false); if (r) return r;
    if (aff(SK.GUARD) && rnd(state) < 0.5) return SK.GUARD;
    return pickAggro(state, pid, legal);
  }

  function pickBalanced(state, pid, legal) {
    const me = state.p[pid], you = oppOf(state, pid);
    noteOpp(state, pid);
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (me.tauntActive) {
      for (const k of [SK.GUN, SK.SWORD, SK.TANK, SK.SNIPE, SK.DRAIN, SK.CANNON]) if (aff(k)) return k;
    }
    if (me.hp <= 2 && you.ep >= 3 && rnd(state) < 0.4 && aff(SK.PROTO)) return SK.PROTO;
    if (me.hp === 1 && aff(SK.DRAIN)) return SK.DRAIN;
    if (oppInDefense(you)) { const r = reactDefense(me, you, byKey, aff); if (r) return r; }
    const r = reactOffense(me, you, byKey, aff, false); if (r) return r;
    if (me.ep >= 4 && aff(SK.BIG_T)) return SK.BIG_T;
    if (me.ep >= 3 && rnd(state) < 0.35 && aff(SK.MINE)) return SK.MINE;
    if (aff(SK.GUN) && rnd(state) < 0.6) return SK.GUN;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  function pickAntiDef(state, pid, legal) {
    const me = state.p[pid], you = oppOf(state, pid);
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (me.tauntActive) {
      for (const k of [SK.SNIPE, SK.RAILGUN, SK.TANK, SK.SWORD, SK.GUN, SK.DRAIN]) if (aff(k)) return k;
    }
    const r = reactDefense(me, you, byKey, aff); if (r) return r;
    const o = reactOffense(me, you, byKey, aff, false); if (o) return o;
    if (me.elec === 0 && aff(SK.CHARGE)) return SK.CHARGE;
    if (me.ep >= 4 && aff(SK.BIG_T)) return SK.BIG_T;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  function pickBreakDef(state, pid, legal) {
    const me = state.p[pid];
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (me.tauntActive) {
      for (const k of [SK.SNIPE, SK.RAILGUN, SK.TANK, SK.SWORD, SK.GUN, SK.DRAIN]) if (aff(k)) return k;
    }
    if (me.ep < 5) {
      if (aff(SK.JI)) return SK.JI;
      if (me.elec === 0 && aff(SK.CHARGE)) return SK.CHARGE;
    }
    if (aff(SK.BIG_T)) return SK.BIG_T;
    if (aff(SK.SNIPE)) return SK.SNIPE;
    if (me.elec > 0 && aff(SK.RAILGUN)) return SK.RAILGUN;
    if (aff(SK.TANK)) return SK.TANK;
    if (aff(SK.SWORD)) return SK.SWORD;
    if (aff(SK.GUN)) return SK.GUN;
    if (aff(SK.PURIFY) && me.stickers.length) return SK.PURIFY;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  function pickAdaptive(state, pid, legal) {
    const me = state.p[pid], you = oppOf(state, pid);
    noteOpp(state, pid);
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    const defOpp = oppInDefense(you);
    if (me.tauntActive) {
      for (const k of [SK.SNIPE, SK.RAILGUN, SK.TANK, SK.SWORD, SK.GUN, SK.DRAIN, SK.CANNON]) if (aff(k)) return k;
    }
    if (me.stickers.length >= 2 && aff(SK.PURIFY)) return SK.PURIFY;
    // 对手防御架势 → 穿透/攒到2
    if (defOpp) { const r = reactDefense(me, you, byKey, aff); if (r) return r; }
    // 斩杀
    if (you.hp <= 1.5) {
      if (me.hp <= 1 && aff(SK.DRAIN)) return SK.DRAIN;
      if (aff(SK.SNIPE)) return SK.SNIPE;
      if (me.elec > 0 && aff(SK.RAILGUN)) return SK.RAILGUN;
      if (aff(SK.TANK)) return SK.TANK;
      if (aff(SK.GUN)) return SK.GUN;
    }
    // 正常 → 开火优先，偶尔铺垫
    const o = reactOffense(me, you, byKey, aff, false); if (o) return o;
    if (me.ep < 3 && aff(SK.JI)) return SK.JI;
    if (me.elec === 0 && aff(SK.CHARGE)) return SK.CHARGE;
    if (me.ep >= 5 && aff(SK.BIG_T)) return SK.BIG_T;
    if (me.ep >= 2 && you.ep >= 3 && me.hp > 2 && aff(SK.MINE)) return SK.MINE;
    if (me.hp <= 2 && you.ep >= 3 && aff(SK.PROTO)) return SK.PROTO;
    if (me.hp <= 2 && aff(SK.GUARD)) return SK.GUARD;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  function pickWall(state, pid, legal) {
    const me = state.p[pid];
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    const seq = [SK.GUARD, SK.REFLECT, SK.PROTO];
    const i = Math.floor(state.round % seq.length);
    if (aff(seq[i])) return seq[i];
    if (aff(SK.GUARD)) return SK.GUARD;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  /* 永久架势三兄弟：一直摆同一种（免费）架势 → 逼训练学会"用穿透技破架势"而不是把可被反的招送进去。
   * 修"一键反弹打死冠军"这类 bug（原池里没有"永久反弹"对手）。 */
  function pickReflectSpam(state, pid, legal) {
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (aff(SK.REFLECT)) return SK.REFLECT;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }
  function pickGuardSpam(state, pid, legal) {
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (aff(SK.GUARD)) return SK.GUARD;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }
  function pickBaguaSpam(state, pid, legal) {
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    if (aff(SK.BAGUA)) return SK.BAGUA;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  /* 连招反制脚本：读对手最近出招 → 预测下一招 → 选克制技。
   * 逼 AI 学会"别被看穿"（不靠运行时连招防护）；模拟"正常游戏里明显连招会被对手针对"。 */
  function pickComboCounter(state, pid, legal) {
    const opp = oppPidOf(state, pid);
    const recent = [];
    for (let i = state.events.length - 1; i >= 0 && recent.length < 5; i--) {
      const e = state.events[i];
      if (e.type === 'action' && e.pid === opp && e.outcome === 'ok') recent.push(e.key);
    }
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    let predict = null, cnt = 0;
    if (recent.length) {
      const f = {};
      for (const k of recent) f[k] = (f[k] || 0) + 1;
      for (const k in f) if (f[k] > cnt) { cnt = f[k]; predict = k; }
    }
    if (predict) {
      if (predict === SK.GUN && aff(SK.REFLECT)) return SK.REFLECT;      // 枪 → 反弹
      if (predict === SK.TANK && aff(SK.SNIPE)) return SK.SNIPE;         // 坦克 → 狙击（穿反弹）
      if (predict === SK.SWORD && aff(SK.TANK)) return SK.TANK;          // 激光剑 → 坦克（穿防御）
      if (predict === SK.SNIPE && aff(SK.PROTO)) return SK.PROTO;        // 狙击 → 原型制御
      if ((predict === SK.GUARD || predict === SK.REFLECT || predict === SK.BAGUA) && aff(SK.TANK)) return SK.TANK; // 防御架势 → 坦克
      if ((predict === SK.BIG_T || predict === SK.RAILGUN) && aff(SK.GUARD)) return SK.GUARD; // 电系 → 防御
      if (predict === SK.DRAIN && aff(SK.GUARD)) return SK.GUARD;
    }
    if (aff(SK.GUN)) return SK.GUN;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  /* 农民型：只攒资源、不主动进攻 —— 逼 AI 学会惩罚消极攒ジ的对手 */
  function pickFarmer(state, pid, legal) {
    const byKey = {}; legal.forEach(function (l) { byKey[l.key] = l; });
    const aff = function (k) { return byKey[k] && byKey[k].affordable; };
    if (aff(SK.CHARGE) && rnd(state) < 0.35) return SK.CHARGE;
    if (aff(SK.RING) && state.p[pid].ringStreak > 0) return SK.RING;
    if (aff(SK.JI)) return SK.JI;
    return affOrJi(legal);
  }

  function pickMix(state, pid, legal) {
    const table = [pickBalanced, pickAggro, pickAntiDef, pickBreakDef, pickDefend, pickRandom];
    return table[Math.floor(rnd(state) * table.length)](state, pid, legal);
  }

  /* ---------- 人类式打法（评测硬门槛：池外"笨但有效"的真人节奏，任何一条 <50% 就不许当冠军） ---------- */
  // 坦克线：能出坦克就出坦克，否则按ジ。坦克优先级 3 直接作废枪(2)/狙击(1)，而坦克自带的火焰照打。
  function pickTankLine(state, pid, legal) {
    const byKey = {}; legal.forEach(function (l) { byKey[l.key] = l; });
    if (byKey[SK.TANK] && byKey[SK.TANK].affordable) return SK.TANK;
    return SK.JI;
  }
  // 重火力压制：大雷 → 电磁炮 → 坦克 → 激光剑，取可负担的最重一击，否则按ジ。
  function pickHeavyFire(state, pid, legal) {
    const byKey = {}; legal.forEach(function (l) { byKey[l.key] = l; });
    const order = [SK.BIG_T, SK.RAILGUN, SK.TANK, SK.SWORD];
    for (const k of order) if (byKey[k] && byKey[k].affordable) return k;
    return SK.JI;
  }
  // 空放型对手：故意挑一个"买不起/条件不满足"的技能空放（→ 招式作废 → 对手 lastSkill=null）。
  // 唯一用途是让冠军见过"对手上一招无效"这个状态，别掉进未训练区退化成死循环。
  // 带 whiffOk 标记：play.js 的空放兜底会放行它（普通脚本/AI 一律被兜底改成按ジ）。
  function pickWhiff(state, pid, legal) {
    const bad = legal.filter(function (l) { return !l.affordable; });
    if (bad.length) return bad[bad.length - 1].key;   // 挑最贵的那张
    return SK.JI;
  }
  pickWhiff.whiffOk = true;

  // 节奏型对手工厂：按给定技能序列循环；**买不起就按ジ攒**（关键：缺这一步就永远攒不出 2 ジ 的招，
  // 会退化成"只会免费反弹"的弱鸡——实测这种弱化版冠军 100% 能赢，反而掩盖了真实洞）。
  function makeRhythm(seq) {
    return function (state, pid, legal) {
      const byKey = {}; legal.forEach(function (l) { byKey[l.key] = l; });
      const want = seq[Math.floor((state.round || 1) % seq.length)];
      if (byKey[want] && byKey[want].affordable) return want;
      if (byKey[SK.JI] && byKey[SK.JI].affordable) return SK.JI;
      return legal.length ? legal[0].key : SK.JI;
    };
  }
  // 反弹与攻击交替（三拍）：反弹 → 枪 → 坦克
  const pickReflectMix = makeRhythm([SK.REFLECT, SK.GUN, SK.TANK]);
  // 反弹 → 反弹 → 坦克（用户实测能把冠军 100% 打穿）
  const pickReflectTank = makeRhythm([SK.REFLECT, SK.REFLECT, SK.TANK]);
  // 防御 → 反弹 → 枪（用户实测 17 回合打赢困难档）
  const pickDefReflectGun = makeRhythm([SK.GUARD, SK.REFLECT, SK.GUN]);

  // 原型制御墙：能出原型就出，否则按ジ。原型挡一切技能伤害，只有地雷/转移能绕——专门逼 AI 学会用这两招。
  function pickProtoWall(state, pid, legal) {
    const byKey = {}; legal.forEach(function (l) { byKey[l.key] = l; });
    if (byKey[SK.PROTO] && byKey[SK.PROTO].affordable) return SK.PROTO;
    return SK.JI;
  }
  // 防御+枪三拍：防御 → 枪 → ジ 循环（专克"只会出伤害招、不会摆架势"的 AI）。
  function pickGuardGun(state, pid, legal) {
    const byKey = {}; legal.forEach(function (l) { byKey[l.key] = l; });
    const ph = (state.round || 1) % 3;
    const want = ph === 0 ? SK.GUARD : (ph === 1 ? SK.GUN : SK.JI);
    if (byKey[want] && byKey[want].affordable) return want;
    if (byKey[SK.GUARD] && byKey[SK.GUARD].affordable) return SK.GUARD;
    return SK.JI;
  }

  /* ===== A 方案：多人专用难度档（N 意识版）=====
   * 现有脚本全是 2 人时代写的：oppPidOf 只会打"血量最低"的对手、无视领先者，
   * 也不认识"有人正在攒钱（ep≥3）"这个 3 人局的核心威胁。
   * 这三档统一改成：**先决定"打谁"（N 意识），再决定"用什么"**，并允许返回 {key,target}。 */
  function mpOpps(state, pid) {
    const out = [];
    for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) out.push(i);
    return out;
  }
  function mpLeader(state, pid) {          // 血量最高的领先者（最该压的人）
    const o = mpOpps(state, pid); if (!o.length) return null;
    let best = o[0];
    for (const i of o) if (state.p[i].hp > state.p[best].hp + 1e-9) best = i;
    return best;
  }
  function mpSaver(state, pid) {           // 正在攒钱的对手（ep>=3，快要放大招）
    const o = mpOpps(state, pid); if (!o.length) return null;
    let best = null, mx = 2.999;
    for (const i of o) if (state.p[i].ep > mx) { mx = state.p[i].ep; best = i; }
    return best;
  }
  function mpKillable(state, pid, amt) {   // 能一击打死（hp<=amt）的目标
    for (const i of mpOpps(state, pid)) if (state.p[i].hp <= amt + 1e-9) return i;
    return null;
  }
  function mpStanceOf(state, t) { return (t == null) ? 'none' : stanceOf({ lastSkill: state.p[t].lastSkill }); }
  function mpBk(legal) { const o = {}; legal.forEach(function (l) { o[l.key] = l; }); return o; }
  function mpAff(bk, k) { return !!(bk[k] && bk[k].affordable); }

  /* 简单·多人：随机 + 少量基础进攻，**故意不架势、不穿透**（留破绽，新手能赢） */
  function pickMultiEasy(state, pid, legal) {
    const bk = mpBk(legal);
    if (rnd(state) < 0.35) return pickRandom(state, pid, legal);
    if (mpAff(bk, SK.GUN) && rnd(state) < 0.5) return { key: SK.GUN, target: mpLeader(state, pid) };
    return { key: SK.JI, target: null };
  }

  /* 中等·多人：能杀就杀 → 压制攒钱者 → 对领先者架势做穿透反应 → 否则攒/开枪 */
  function pickMultiMed(state, pid, legal) {
    /* 中等·多人（**按实测数据重写**）
     * 实测（6 档对手两两组合 × 三座位 × 10 局）：
     *   打 leader + 枪 = 61.9% | 打 weakest + 枪 = 51.7% | 打 saver + 枪 = 50.6% | 随机 = 52.8%
     * ⇒ "打领先者"是最大杠杆（+10.2pt）；"压制攒钱者"是**负收益**，已删除。
     * ⚠️ v1.3.20 旧版正好踩在最差区域（先压攒钱者 + 反应式穿透）。 */
    const bk = mpBk(legal);
    const k1 = mpKillable(state, pid, 1);
    if (k1 != null && mpAff(bk, SK.GUN)) return { key: SK.GUN, target: k1 };
    const t = mpLeader(state, pid);
    if (mpAff(bk, SK.GUN)) return { key: SK.GUN, target: t };
    return { key: SK.JI, target: null };
  }

  /* 困难·脚本兜底：冠军不可用时的替代品。带经济（攒到 3 开环）与穿透决策。 */
  function pickMultiStrong(state, pid, legal) {
    /* 困难·脚本兜底（**按实测数据重写**）
     * 实测：打 leader + **买得起就穿透** = 62.5%（最高档）；
     *   而"对架势才反应式穿透" = 55.8%（−6.7pt，平均回合 31.2 vs 28.0 → 反应式拖节奏）。
     * 故这里**不看对手架势，能穿透就穿透**。
     * 已删除实测负收益/不触发的分支：压制攒钱者（50.6%）、被两人压→反弹、ep>=3 开环
     *   （经济锁在 ep<=2，"开环"分支实测一次都没触发——堆分支不等于提吞吐量）。 */
    const bk = mpBk(legal), me = state.p[pid];
    /* ⚠️ 曾有一个 "mpKillable(2) + 坦克" 分支 —— 那是 bug：**坦克只造成 1 点伤害**
     * （rules.js:47 dmg.amt=1），所以它会为"2 血目标"白花 2 ジ还打不死，且触发频繁（拖垮胜率）。
     * 造成 2 点伤害的只有大雷（5 ジ，经济锁下买不起）。已删除。 */
    const k1 = mpKillable(state, pid, 1);
    if (k1 != null && mpAff(bk, SK.GUN)) return { key: SK.GUN, target: k1 };
    const t = mpLeader(state, pid);
    /* 曾在此加过 "血<=1 就守" —— 实测**大幅拖垮胜率**（3 人局里守一回合，
     * 另一个对手照样打你，等于白送回合）。已删除：困难档就是实测最优的
     * "打领先者 + 买得起就穿透"，不加未验证的花样。 */
    if (me.ep >= 2 && mpAff(bk, SK.TANK)) return { key: SK.TANK, target: t };    // 穿防御+转移
    if (me.ep >= 2 && mpAff(bk, SK.SNIPE)) return { key: SK.SNIPE, target: t };  // 穿反弹
    if (mpAff(bk, SK.GUN)) return { key: SK.GUN, target: t };
    return { key: SK.JI, target: null };
  }

  /* ===== P1：深经济对手（攒钱流）=====
   * 千问指出：现有对手池里**没有任何一个会跨过 2 ジ 档**（heavyfire 名字像，实测 ジ70/坦克30），
   * 所以"不攒钱"永远不会受到惩罚——这是"考卷问题"，不是策略问题。
   * 这个脚本的作用就是当那张**会惩罚不攒钱的考卷**：
   *   能一击必杀 → 大雷；够得着大雷 → 大雷；血少 → 先守（不白给）；否则**只出 ジ 攒钱**。
   * ⚠️ 按前几轮教训，必须实测它**真的**会攒到 3~5（不能只看设计意图）。 */
  function pickDeepSaver(state, pid, legal) {
    const bk = mpBk(legal), me = state.p[pid];
    const k2 = mpKillable(state, pid, 2);
    if (k2 != null && mpAff(bk, SK.BIG_T)) return { key: SK.BIG_T, target: k2 };
    if (mpAff(bk, SK.BIG_T)) return { key: SK.BIG_T, target: mpLeader(state, pid) };
    /* ⚠️ 实测教训：原先这里无条件放地雷（3 ジ）→ 一买得起就花掉，**最高 ep 只到 3**，
     * 大雷(5 ジ) 那一支永远不触发，ep>=3 占比仅 15.9%（对比 breakdef 43.4%）。
     * 现在只在"对手正在用原型制御"时才放地雷（它唯一的独占价值），否则继续攒到大雷。 */
    const tl = mpLeader(state, pid);
    if (mpAff(bk, SK.MINE) && tl != null && state.p[tl].lastSkill === SK.PROTO)
      return { key: SK.MINE, target: tl };
    if (me.hp <= 1 && mpAff(bk, SK.GUARD)) return { key: SK.GUARD, target: null };
    return { key: SK.JI, target: null };                                             // 攒钱
  }

  /* 多人专用难度档（ui.js chooseAIMulti 用） */
  const DIFFICULTY_N = {
    easy:   { name: '简单',   pick: pickMultiEasy },
    medium: { name: '中等',   pick: pickMultiMed },
    hard:   { name: '困难·脚本兜底', pick: pickMultiStrong }
  };

  /* ===== 玩家可选对手风格（乙方案：风格即档位）=====
   * 从 23 个训练对手里按**实测审计**（`tools/bot-audit.mjs`）选出 5 个"有可玩性"的：
   *   剔除依据：有效技能数 = 1.00 的是"只会一招"的退化对手
   *   （reflectspam / guardspam / baguaspam），random 是另一个极端（熵 6.74，纯噪声，没人格）；
   *   wall / protowall / reflecttank / farmer / whiff 全部 1st = 0%（自己赢不了，只会拖局）；
   *   balanced(49.9 回合) / defend(40.8 回合) 拖太久不适合玩家；
   *   tankline 与 heavyfire 数据完全重复（38%/15.0/1.84/ジ70+坦克30）→ 合并即无需两个。
   * 目标选择不在这里做：ui.js 统一走 `pickTargetN`（= 击杀优先 → 打领先者），
   * 而实测「打领先者」比「打残血」高 10.2pt，是多人局最大的单一杠杆。 */
  const STYLES = [
    /* **按实测强度升序排列**（3 人 60 局，对手轮换）——风格即档位，玩家从上到下就是由易到难。
     * 数值来自 tools/bot-audit.mjs 的同口径复测，已写进 note 供玩家判断。 */
    { id: 'st:reflectmix',   name: '节奏型',   pick: pickReflectMix,   note: '固定节奏：反弹→枪→坦克，可被识破（最易，约 17%）' },
    { id: 'st:breakdef',     name: '憋大招',   pick: pickBreakDef,     note: '86% ジ 攒钱，等真正的落雷一发定胜负（约 28%）' },
    { id: 'st:mix',          name: '全能型',   pick: pickMix,          note: '什么都用一点，出招最杂（有效技能数 4.38，约 30%）' },
    { id: 'st:aggro',        name: '激进快攻', pick: pickAggro,        note: '一有机会就开枪，逼你打快棋（约 55%，均 27 回合）' },
    { id: 'st:combocounter', name: '读招反制', pick: pickComboCounter, note: '读你最近 5 次出招来反制，最难缠（约 55%，均 15 回合）' }
  ];



  const DIFFICULTY = {
    easy: { name: '简单', pick: function (st, pid, lg) { return rnd(st) < 0.6 ? pickRandom(st, pid, lg) : pickBalanced(st, pid, lg); } },
    medium: { name: '中等', pick: pickBalanced },
    hard: { name: '困难·自适应', pick: function () { throw new Error('hard 由 pickAdaptive 接管'); } }
  };

  global.EpirusBots = {
    pickRandom, pickAggro, pickDefend, pickBalanced, pickAntiDef, pickBreakDef, pickAdaptive, pickWall, pickReflectSpam, pickGuardSpam, pickBaguaSpam, pickComboCounter, pickFarmer, pickMix,
    pickTankLine, pickHeavyFire, pickGuardGun, pickProtoWall, pickWhiff,
    pickReflectMix, pickReflectTank, pickDefReflectGun, DIFFICULTY, DIFFICULTY_N, STYLES, resetBotMem,
    pickMultiEasy, pickMultiMed, pickMultiStrong, pickDeepSaver,
    BOT_RANDOM: 'random', BOT_AGGRO: 'aggro', BOT_DEFEND: 'defend', BOT_BALANCED: 'balanced',
    BOT_ANTIDEF: 'antidef', BOT_BREAKDEF: 'breakdef', BOT_ADAPTIVE: 'adaptive', BOT_WALL: 'wall',
    BOT_REFLECTSPAM: 'reflectspam', BOT_GUARDSPAM: 'guardspam', BOT_BAGUASPAM: 'baguaspam', BOT_COMBOTCOUNTER: 'combocounter', BOT_MIX: 'mix'
  };
})(typeof window !== 'undefined' ? window : globalThis);
