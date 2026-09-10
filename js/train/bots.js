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

  const DIFFICULTY = {
    easy: { name: '简单', pick: function (st, pid, lg) { return rnd(st) < 0.6 ? pickRandom(st, pid, lg) : pickBalanced(st, pid, lg); } },
    medium: { name: '中等', pick: pickBalanced },
    hard: { name: '困难·自适应', pick: function () { throw new Error('hard 由 pickAdaptive 接管'); } }
  };

  global.EpirusBots = {
    pickRandom, pickAggro, pickDefend, pickBalanced, pickAntiDef, pickBreakDef, pickAdaptive, pickWall, pickReflectSpam, pickGuardSpam, pickBaguaSpam, pickComboCounter, pickFarmer, pickMix,
    pickTankLine, pickHeavyFire, pickGuardGun, pickProtoWall, pickWhiff,
    pickReflectMix, pickReflectTank, pickDefReflectGun, DIFFICULTY, resetBotMem,
    BOT_RANDOM: 'random', BOT_AGGRO: 'aggro', BOT_DEFEND: 'defend', BOT_BALANCED: 'balanced',
    BOT_ANTIDEF: 'antidef', BOT_BREAKDEF: 'breakdef', BOT_ADAPTIVE: 'adaptive', BOT_WALL: 'wall',
    BOT_REFLECTSPAM: 'reflectspam', BOT_GUARDSPAM: 'guardspam', BOT_BAGUASPAM: 'baguaspam', BOT_COMBOTCOUNTER: 'combocounter', BOT_MIX: 'mix'
  };
})(typeof window !== 'undefined' ? window : globalThis);
