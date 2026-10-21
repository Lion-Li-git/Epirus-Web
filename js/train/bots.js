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
  /* §E209（**只给研究侧仪器用**，默认无人调用 ⇒ 出厂路径逐字不变）：
   * `__mem` 是模块级、只在 `state.round === 1` 自重置的。任何"在母局中途插入 rollout"的量具都会把
   * **rollout 的回合号**写进 `lastDefRound`，母局下一手读到的是别的轨迹的历史
   * （实测：rollout 跑到 20 回合 ⇒ 回到母局第 5 手时 `(5 - 19) <= 2` 成立 ⇒ bot 以为对手刚防过）。
   * ⇒ 加一对快照/恢复，让仪器能把这段历史**围起来**。`--resetmem`（只抹不还原）不够：它把母局自己的真历史也抹了。 */
  function snapshotBotMem() { return { lastDefRound: __mem.lastDefRound, oppMightDefend: __mem.oppMightDefend }; }
  function restoreBotMem(s) { if (s) __mem = { lastDefRound: s.lastDefRound | 0, oppMightDefend: !!s.oppMightDefend }; }
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
      /* v1.4.11：对手在靠聚能环攒钱 ⇒ 用小雷 void 掉它（outcome≠ok ⇒ ringStreak 归零，
       * resolve.js:789）。这条分支此前缺失，所以"反制环经济"在池子里从未被演练过。 */
      if (predict === SK.RING && aff(SK.MINI_T)) return SK.MINI_T;
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
  /* ===== §E600-B「杂货铺」：弱档席——**地板是全能型，多余的动作才交给低性价比卡**（v2，10-13）=====
   * 立项依据（实测 `docs/debug/breadth-probe.mjs`，40 局/格 · 5 席镜像 · multi ‖ 机会只数**买得起**的）：
   *   现有 5 只风格脚本里 4 只出手种类是 1~2，只有 `st:mix` 有 23 种；而 `st:mix` 真正的缺口是
   *   **净化 2.8 ‖ 双枪 2.0 ‖ 镜面 2.0 次/局的"买得起却没出"**。
   *   ⚠ 我 v1 之前在这里写过"避雷针 72.5 次/局"——那是尺子把"规则允许但珠不够"数成了机会，**比真值大一个数量级**；
   *     修在尺上（`breadth-probe` 现在分开报 机会/差手 两列），旧数不许再引。
   *   ⇒ 弱档"没广度"不是随机性不够，是**选择侧永远排不到这些卡**（用户 10-13：这些技能进不了高强度的包）。
   * v1（`44384ea`）的形状 = "这局没用过 > 用得最少 > 别的" ⇒ 广度天然上去，但**它挤掉的是正招**，
   *   强度天然掉到"脚本席不该有的程度"。用户 10-13 补的那句把它钉住了：「**就算给简单掺脚本席也要让脚本有基础强度**」。
   * v2 的依据 = `docs/research/CARD-VALUE-2026-10-13.md` §4 的分层**配对** RCT（同 seed 跑两遍：A=一有机会就打这张卡 / B=一次都不打）：
   *   15 张弱卡平均全是负的（dose=1 时 −13.6%~−33.3%），但**"我血≤1"那一格普遍抬到 0 附近甚至转正**
   *   （藤甲 +0.4/+3.9 ‖ 全息屏障 +3.9 ‖ 镜面反射 +3.1 ‖ 双枪射手 +4.3/+3.9/+6.8 ‖ 无极变速 +0.3），
   *   而"地板本来就只剩 ジ"的时刻打工具**不挤掉任何正招** ⇒ 这两类回合就是天然的广度预算。
   * ⚠ 判它只看两件事 —— 广度（出手种类数）与"人类席夺冠率"（`tools/probe-pool.mjs`）：
   *   不许拿"能不能打赢冠军"评它，那不是它要解的题（同一课见 `METHODOLOGY.md`："弱点必须是目标在乎的缺口"）。
   * ⚠ 计数从 `state.events` 现算（事件形状 `{type:'action', pid, key, outcome}`，与 `usage-probe` 同一判据），
   *   不存模块级状态 ⇒ 同一个种子必然同一个行为，`cloneState` / 并行 worker 都不会串味。 */
  const TOOL_KEYS = [SK.ROD, SK.LASER_EYE, SK.SHIFT, SK.JINSHIELD, SK.ARMOR, SK.PROTO, SK.TRANSFER,
    SK.CURSE, SK.FIRESTORM, SK.TAUNT, SK.CANNON, SK.PURIFY, SK.MINE, SK.DUAL_GUN, SK.MIRROR, SK.HOLO, SK.DRAIN];
  /* 计划层的经济门槛：开一次聚能环要 3 珠（`state.js:137` rawCost 的 `ringStreak===0 ⇒ ep 3`），
   * 所以"手里不够 3 珠就别花钱"是 P1/P3/P4 能不能存在的前提（P0 那条纪律用的就是它）。*/
  const PLAN_BANK = 5;
  /* ★ P7-断环的阈值（用户 10-15 晚「断环加一下吧」）＝ 对手连环到几我才用小雷断他。
   *   取 **1**（"他刚开环就断"）而不是 2：千问实测（`s35-ringbreak.mjs` ‖ v1.7.45/46）NEED=1 的机会更多
   *   （0.437 vs 0.360 次/局），而对我的贵招挤压更小（≥3 费出牌 −12.7% vs NEED=2 的 **−0.225 = >3σ**）。 */
  const PLAN_BREAK_NEED = 1;
  /* 攒钱的上限（用户 10-13：「攒到 51ep 也太夸张了，到 20 都绰绰有余可以玩各种技能了」）：
   *   到 20 珠就不再开环/续环，逼它把钱花出去 ⇒ 镜像里那个 51 是无压力装配的长尾，不该当现场读数，更不该当行为目标。*/
  const PLAN_SPEND = 20;
  /* 血≤1 那一格里最不值钱的是"防御类工具"（RCT 里它们抬到 0 附近）⇒ 保命窗口先给这一批，别先甩天火/贴贴 */
  const TOOL_DEFENSE = [SK.SHIFT, SK.JINSHIELD, SK.ARMOR, SK.PROTO, SK.HOLO, SK.TRANSFER, SK.ROD];
  /* ⚠ v3「演出配额」（每局至多 N 手"不是闲着的也开一张贵工具"）**测过、判死、已删**（10-13 晨）：
   *   强度轴 —— `tools/probe-pool.mjs --mixSeats=2` 六格人类席读数与 v2 一致；
   *   广度轴 —— 页面 16 局整桌低性价比卡 v1 19 ‖ v2 14 ‖ v3 13（`docs/debug/play-mix.mjs`，配额没把它抬回去反而少 1）；
   *   根因是配额**花错了时机**：`played` 数的是**所有**工具出手，而 ③ 在开局那几手攒珠的闲回合就把配额吃满，
   *   等 3 珠卡买得起时配额已归零 ⇒ 这条分支基本不落地。真要做该按"贵卡自己那批"计数、且排在 ③ 之前 —— 那是 v4，得单独测。
   *   留这段话是为了下一个人别再照原样把配额加回来。 */
  /* ===== 计划层（P 系列 · 用户 10-13 上午给的六条推理形状，用户原话抄在下面）=====
   * 用户的意思不是"再多几种卡"，是**脚本要看得懂局面**：「既然做脚本就可以搞一些有逻辑推理的部分…
   *   而不是为了堆广度随便浪费」。所以这一层排在 ③（闲时换新卡）**之前**：能读出局面就走计划，读不出来才回地板。
   * 花费结构全部从 `js/core/state.js` 的 `rawCost` 现读（不是照卡面文字猜）：
   *   · 聚能环：首次 3 珠、之后 **0 珠**（`resolve.js:733` 每次 +1/+2/+3，第 3 次起封顶 +3；断环即归零 `resolve.js:1239`）
   *     ⇒ 开环之后每一手都是**免费的钱**，代价是"这些回合不打人也不守"；
   *   · 过载炮：phase = `cannonCount % 3 + 1` —— 第1次 2 珠；第2次**清空全部珠**（且要求 ep≥1）；第3次清空全部珠**再自损 1 血**
   *     ⇒ 用户给的三条正好是"花费最小化"的三条：phase1 当普通攻击、phase2 只在 ep=1 时按（只付 1 珠）、phase3 只在 ep=0 时按（无珠可清，只付 1 血）；
   *   · 天火：不需要选目标、打**全场**我贴出且 `age<=3` 的符咒，**引爆后符咒仍在**（`resolve.js:1070`）⇒ "贴3次然后连续引爆两次"的第二爆天然成立。
   * ⚠ 与整只脚本同一条纪律：**只读 state 现算**（ringStreak / cannonCount / stickers / ep / hp / elec），不存模块级状态
   *   ⇒ 同一颗种子必然同一串行为，`cloneState` / 并行 worker / 页面都不会串味。每条实际触发几次由 `docs/debug/plan-firing.mjs` 数。 */
  function planRichest(state, pid, minEp) {           // 攒珠最多、且不少于 minEp 的对手
    let mx = -1; const cand = [];
    for (const i of mpOpps(state, pid)) { const e = state.p[i].ep;
      if (e < minEp) continue;
      if (e > mx) { mx = e; cand.length = 0; cand.push(i); } else if (e === mx) cand.push(i); }
    return cand.length ? mpPickOne(state, cand) : null;
  }
  function planMyStickers(state, pid) {               // 我贴在别人身上、还活着的符咒数（与天火的判据同一条）
    let n = 0;
    for (let i = 0; i < state.p.length; i++) { if (i === pid) continue;
      const s = state.p[i].stickers || [];
      for (let k = 0; k < s.length; k++) if (s[k].owner === pid && s[k].age <= 3) n++; }
    return n;
  }
  function planUnstickered(state, pid) {              // 我一枚还没贴上去的对手（P4 要铺开贴三个人，不是叠一个人）
    const out = [];
    for (const i of mpOpps(state, pid)) { const s = state.p[i].stickers || [];
      if (!s.some(function (x) { return x.owner === pid && x.age <= 3; })) out.push(i); }
    return out;
  }
  function planHpNotBehind(state, pid) {              // 用户那句"血多"的口径：我不比场上任何人血少
    const me = state.p[pid]; let mx = -Infinity;
    for (const i of mpOpps(state, pid)) if (state.p[i].hp > mx) mx = state.p[i].hp;
    return !isFinite(mx) || me.hp >= mx;
  }
  /* 我最近 k 手真正打出的招（事件序就是时间序 ⇒ 倒着捡本席的 action）。
   *   被防御挡掉的那一手**也算"贴了一次"**：用户的窗口说的是"连续贴三次"这个**出手次数**，
   *   而"到底落没落地"交给 `planMyStickers`（活符咒数）判 —— 两件事分开设判据，别混成一个。 */
  function planMySeq(state, pid, k) {
    const out = []; const evs = (state && state.events) || [];
    for (let i = evs.length - 1; i >= 0 && out.length < k; i--) {
      const e = evs[i];
      if (e && e.type === 'action' && e.outcome === 'ok' && e.pid === pid && e.key) out.push(e.key);
    }
    return out;                                            // out[0] = 最近一手
  }
  /* 用户那句"保命也要看现场"的量化：能威胁我的程度计分 ——
   *   一个人有 5 珠或带雷珠 = 2 分（真能打死/大伤害），一人有 2~4 珠 = 1 分，没珠 = 0 分。
   *   门槛取 2 ⇒ "别人都没 ep"（0 分）与"只有一个人有一两 ep"（1 分）都**不守**，两人有点钱或一人能放大雷才守。 */
  function planThreatScore(state, pid) {
    let s = 0;
    for (const i of mpOpps(state, pid)) { const o = state.p[i];
      if (o.ep >= 5 || (o.elec || 0) >= 1) s += 2; else if (o.ep >= 2) s += 1; }
    return s;
  }
  function planPick(state, pid, legal) {
    const bk = mpBk(legal), me = state.p[pid];
    const live = planMyStickers(state, pid);
    const seq = planMySeq(state, pid, 6);   // 窗口最长要能看见"贴-ジ-贴-ジ-贴-爆"这种节奏 ⇒ 取 6 手
    let curseRun = 0, fireRun = 0;
    /* ⚠ "连续"的口径：**ジ 不算打断**。第一版按字面"相邻两手"数，于是 贴/ジ/贴/ジ/贴 永远数不满 3 次
     *   （40 局实测最长连贴 2，窗口从未上膛）——而攒钱回合本来就该允许插一手ジ，用户说的"连续3次"指的是这个计划的三次贴。 */
    for (const k of seq) { if (k === SK.JI) continue; if (k === SK.CURSE) curseRun++; else break; }
    for (const k of seq) { if (k === SK.JI) continue; if (k === SK.FIRESTORM) fireRun++; else break; }
    /* P4-引爆（时序版，按用户 10-13 那句改）：「贴贴是连续3次，未必要3枚，不然开头那个就过期了」
     *   ⇒ 判据是**连贴满 3 手**，不是"场上同时有 3 枚"（后者实测历史最大值只有 2 枚，条件永远凑不满）；
     *   「三回合只贴上1枚或是没有那也可以不引爆」⇒ 还要 `live >= 2` 才点，别把 2 珠烧在空场上；
     *   符咒引爆后仍在（`resolve.js:1070`）⇒ 刚点过一发就再点第二发，`fireRun < 2` 封顶，正是"连续引爆两次"。 */
    if (live >= 2 && mpAff(bk, SK.FIRESTORM) && ((curseRun >= 3 && fireRun === 0) || fireRun === 1)) {
      return { key: SK.FIRESTORM, target: null };
    }
    /* P4-连贴（**渐进式的"确认后才加码"**，用户 10-13：「贴贴可以试一下渐进式窗口，但是我担心这样会拉低强度和大雷使用率」）：
     *   只有**上一手真的贴上了**（`live >= 1`）才继续补到 3 手；被防御挡掉（`live === 0`）就立刻止损回主线。
     *   这条排在 P3 大雷**之前**是必须的：窗口已经开起来了，中途改放大雷会让前面那枚符咒白放（原子性）。
     *   ⚠ 又试过一版"上膛了但买不起天火就继续贴"（`(curseRun<3 || !affordable(天火))`）⇒ 贴 140→149 手，天火 4→3 次，组合仍 0 ⇒ **已回退**；
     *     卡点不是概率也不是原子性，而是**上膛那一刻手里没有那 2 珠**（P95 才 2 珠）⇒ 见 CARD-VALUE §8-c 的经济结论。 */
    if (curseRun >= 1 && curseRun < 3 && live >= 1 && mpAff(bk, SK.CURSE)) {
      const fresh = planUnstickered(state, pid);
      const t = mpPickOne(state, fresh.length ? fresh : mpOpps(state, pid));
      if (t != null) return { key: SK.CURSE, target: t };
    }
    /* P3-大雷：「ep 达到 5 之后对着别的有 2ep 或血厚的角色打」——先收能一雷打死的，再打断攒钱的，最后压领先者。 */
    if (mpAff(bk, SK.BIG_T)) {
      const k2 = mpKillable(state, pid, 2);
      const rich = planRichest(state, pid, 2);
      const t = k2 != null ? k2 : (rich != null ? rich : mpLeader(state, pid));
      if (t != null) return { key: SK.BIG_T, target: t };
    }
    /* P4-贴（**渐进式入口**）：不再要求"攒够 7 珠才进窗口"（那是理想方案，实测真装配里凑不齐 ⇒ 整桌只有 6 手贴贴），
     *   改成 4 珠起、五成概率**只投一枚试探**（1 珠成本），贴上了才按上面那条续到 3 手。
     *   排在 P3 大雷**之后** ⇒ 保大雷使用率（用户点名的担心）。 */
    if (curseRun === 0 && fireRun === 0 && live === 0 && me.ep >= 4 && rnd(state) < 0.5 && mpAff(bk, SK.CURSE)) {
      const t = mpPickOne(state, planUnstickered(state, pid));
      if (t != null) return { key: SK.CURSE, target: t };
    }
    /* P1-续环：「血多可以连着打4-5次聚能环」——开环之后每手免费，所以只要没断、没到 5 手就续。
     *   ⚠ 加 `me.ep < PLAN_SPEND`（用户 10-13：「攒到 51ep 也太夸张了，到 20 都绰绰有余可以玩各种技能了」）⇒ 20 珠封顶，钱必须花出去。 */
    if (me.ringStreak >= 1 && me.ringStreak < 5 && me.ep < PLAN_SPEND && mpAff(bk, SK.RING)) return { key: SK.RING, target: null };
    /* P1-开环：首次 3 珠（`state.js:137` rawCost：`ringStreak===0 ⇒ ep 3`）、之后每手免费 +2/+3 ⇒ 开环就是这台经济器的入口。
     *   门槛只能到"买得起 + 我血不劣势"为止。⚠ 第一版写成 `ep>=5` 被实测打回来：40 局镜像**一段环都没开过**
     *   （这只脚本的珠从来没到 5）⇒ 连带 P3 大雷 0 次、P4 的 ep≥7 窗口 0 次 —— "要有钱才开环、开环才有钱"是自我锁死。 */
    if (me.ringStreak === 0 && me.ep < PLAN_SPEND && mpAff(bk, SK.RING) && planHpNotBehind(state, pid) && rnd(state) < 0.7) {
      return { key: SK.RING, target: null };
    }
    /* P6-过载炮：三条按用户的花费逻辑（phase1 随意 / phase2 只在 1ep / phase3 只在 0ep 且打最富的那个）*/
    if (mpAff(bk, SK.CANNON)) {
      const phase = (me.cannonCount % 3) + 1;
      if (phase === 1) { const t = mpLeader(state, pid); if (t != null) return { key: SK.CANNON, target: t }; }
      if (phase === 2 && me.ep <= 1) { const t = mpLeader(state, pid); if (t != null) return { key: SK.CANNON, target: t }; }
      if (phase === 3 && me.ep === 0 && me.hp > 1) { const t = planRichest(state, pid, 4); if (t != null) return { key: SK.CANNON, target: t }; }
    }
    /* P2-避雷针：「看到有人蓄能或攒到 5ep 以上的时候倾向于使用」——电珠在手 = 电磁炮/大雷的入口，六成抬手 */
    if (mpAff(bk, SK.ROD) && rnd(state) < 0.6) {
      for (const i of mpOpps(state, pid)) { const o = state.p[i];
        if (o.ep >= 5 || o.elec >= 1) return { key: SK.ROD, target: null }; }
    }
    /* P7-断环（用户 10-15 晚「断环加一下吧」；机制 = 小雷 void 掉对方的环 ⇒ 他 `ringStreak` 归零、得重花 3 珠重开，
     *   千问 `s35-ringbreak.mjs` 实测机制侧 **14/14 与 10/10 = 100% 生效**，且这条线**不需要任何新维**：
     *   `ringStreak` 在 `policy.js:236` 已有、被作废那一手让 `lastSkill=null` ⇒ 网络也能看见）。
     *   ⚠ 两条刻意的保守（都按他的证据，不是我拍的）：
     *     ① **钱只能来自"已经攒够的那份"**：`me.ep >= PLAN_BANK` 才断 —— v1.7.46 实测"在他连到 2 环那格硬花这 2 珠"
     *        会把我的 ≥3 费出牌从 0.470 打到 0.245（−0.225 ±0.066，>3σ，而胜负分不开）⇒ 不许从开环/大雷的预算里挪钱。
     *     ② 排在**计划层最后**（P2 之后）⇒ 只在"没有别的计划线要做"时才断，不抢 P1/P3/P4/P6 的原子性。
     *   ⚠ 免疫：小雷对**这一回合亮出 防御/反弹/原型**的对手会被 void（`resolve.js:827` + `rules.js:108`）；
     *     我在这里**不预测**（那一回合还没亮的牌本来就不知道）—— 他的实测里真出牌时 14/14 全成功 ⇒ 实践中罕见。
     *   ⇒ 若这条线在真装配里几乎不触发，那结论是"**墙是钱**"（他量的：每局 3.56 次机会里只有 0.23 次买得起那 2 珠），
     *     要真跑起来得先动经济学那一族（P0 攒钱剂量 / `PLAN_BANK`），而不是继续调这里的阈值。 */
    if (PLAN_BREAK_NEED > 0 && me.ep >= PLAN_BANK && mpAff(bk, SK.MINI_T)) {
      let bt = -1, bs = PLAN_BREAK_NEED - 1;
      for (const i of mpOpps(state, pid)) { const o = state.p[i];
        if (o.hp > 0 && (o.ringStreak || 0) > bs) { bs = o.ringStreak || 0; bt = i; } }
      if (bt >= 0) return { key: SK.MINI_T, target: bt };
    }
    return null;
  }
  function toolkitUsed(state, pid) {
    const used = {};
    const evs = (state && state.events) || [];
    for (let i = 0; i < evs.length; i++) { const e = evs[i];
      if (e && e.type === 'action' && e.outcome === 'ok' && e.pid === pid && e.key) used[e.key] = (used[e.key] || 0) + 1; }
    return used;
  }
  function pickToolKit(state, pid, legal) {
    const used = toolkitUsed(state, pid);
    const aff = (legal || []).filter(function (l) { return l && l.affordable; });
    /* 挑一张**这局还没用过**的工具卡（没有新的就交 null，让调用方回到地板）*/
    const freshTool = function (arr) {
      const f = arr.filter(function (l) { return TOOL_KEYS.indexOf(l.key) >= 0 && !used[l.key]; });
      if (!f.length) return null;
      return f[Math.floor(rnd(state) * f.length) % f.length].key;
    };
    /* ① 保命窗口（RCT 里唯一普遍不亏的一格）：先把回合交给还没用过的**防御类**工具，其次才是别的工具。
     *   ⚠ 10-13 用户补了一条对的：「保命窗口你也要看现场情况，要是别人都没有ep或者只有一个人有一两ep那也没必要保命（他都不一定来打你）」
     *     ⇒ 加威胁门 `planThreatScore >= 2`（计分见上面那个 helper：一人 5 珠/带雷珠 = 2 分，一人 2~4 珠 = 1 分）；
     *     原来的无条件守，在"没人有钱"的回合是**白守一手**（表 B 那一格的收益前提是"真的有人要打我"）。 */
    if (state && state.p && state.p[pid] && state.p[pid].hp <= 1 && planThreatScore(state, pid) >= 2) {
      const k = freshTool(aff.filter(function (l) { return TOOL_DEFENSE.indexOf(l.key) >= 0; })) || freshTool(aff);
      if (k) return k;
      /* ⚠ 兜底（加威胁门时漏掉过一次，实测血≤1 的回合有 **36% 直接回地板**，而 v2 是 0% —— 等于把表 B 里唯一量到"不亏"的那格丢掉了）：
       *   没有"这局没用过"的新卡可试，也必须守 —— 买得起的**任何**防御类都算（用过也一样），因为残血时正招本来就是奢侈品。 */
      const anyDef = aff.filter(function (l) { return TOOL_DEFENSE.indexOf(l.key) >= 0 || l.key === SK.GUARD || l.key === SK.REFLECT || l.key === SK.BAGUA; });
      if (anyDef.length) return anyDef[Math.floor(rnd(state) * anyDef.length) % anyDef.length].key;
    }
    /* ⓪ 计划层（P1~P6，用户的六条推理形状）：读得出局面就走计划，返回 null 才往下走地板 */
    const plan = planPick(state, pid, legal);
    if (plan) return plan;
    /* ② 地板 = 全能型（六条人格线随机切换；实测是脚本里出手最广、强度最高的一只）*/
    const base = pickMix(state, pid, legal);
    const bk = (typeof base === 'string') ? base : (base && base.key);
    /* ③ 地板这一手本来就是 ジ（这回合没有更值的事做）⇒ 换成还没用过的工具卡：不挤掉任何正招，广度就在这类便宜回合里长 */
    const idleTool = (bk === SK.JI) ? freshTool(aff) : null;
    /* ★ P0 攒钱纪律 —— 用户那五条计划的**前置**，是实测逼出来的（`docs/debug/plan-firing.mjs` 第一次跑：
     *   六条里四条一次都不触发；诊断脚本给出 20 局 2,640 次决策的珠数分布 = **0珠 50.9% ‖ 1珠 44.4% ‖ 2珠 4.7%，最大 2**）。
     *   原因很直白：③（见便宜工具就花）与地板（一有珠就开枪）会把珠随时花光 ⇒
     *   用户给的 3 珠开环、5 珠大雷、7 珠贴爆**永远够不到**；而 ep 的唯一收入是 `resolve.js` 的 `case SK.JI: me.ep += 1` ⇒
     *   不主动攒，就没有那条"血多连打 4-5 次聚能环"的经济基础。
     *   ⚠ 这正是本文件 `:507` 那条老教训的复刻（"ep>=3 开环…经济锁在 ep<=2，开环分支实测一次都没触发——堆分支不等于提吞吐量"）；
     *     我这次是靠 plan-firing 那把尺发现的，不是靠"分支写完了"。
     *   做法：不处于保命窗口、血不劣势、而这手准备花的钱 ≥1 珠且手里不够 3 珠 ⇒ 六成改按 ジ 攒（留四成照常打，别把脚本变成木头）。 */
    const me = state.p[pid];
    const spendKey = idleTool || (bk !== SK.JI ? bk : null);
    const spendCost = (spendKey && R.byKey[spendKey] && typeof R.byKey[spendKey].cost === 'number') ? R.byKey[spendKey].cost : 0;
    if (me && me.ep < PLAN_BANK && spendCost >= 1 && me.hp >= 2 && planHpNotBehind(state, pid) && rnd(state) < 0.6) {
      return { key: SK.JI, target: null };
    }
    if (idleTool) return idleTool;
    return base;
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
  /* 并列时用本局 rng 随机选一个 —— **不要**按 pid 升序取第一个。
   * v1.3.57 实测：下面这些 helper 原先一律取最低 pid，使脚本系统性地集火低 pid 玩家：
   *   5 人真实考卷场各座位均承伤 P0=2.683 / P1=2.494 / P2=2.446 / P3=2.440 / P4=2.203，
   *   终局 hp 0.45 / 0.60 / 0.64 / 0.64 / 0.85 ⇒ "高 pid 名次更好"成了一个
   *   **与策略无关的座位效应**（对称场里承伤是平的，所以它纯粹来自脚本的取目标方式）。
   * 注意：这会改变 pickMultiEasy/Med/Strong（游戏内多人难度档）与 proto* 脚本的取目标，
   * 但只是"并列时不再偏向低 pid"，方向上是消除偏置。 */
  function mpPickOne(state, arr) {
    if (!arr || !arr.length) return null;
    if (arr.length === 1) return arr[0];
    const r = (state && state.rng && typeof state.rng.next === 'function') ? state.rng.next() : 0;
    return arr[Math.floor(r * arr.length)];
  }
  function mpOpps(state, pid) {
    const out = [];
    for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) out.push(i);
    return out;
  }
  function mpLeader(state, pid) {          // 血量最高的领先者（最该压的人）
    const o = mpOpps(state, pid); if (!o.length) return null;
    let mx = -Infinity; const cand = [];
    for (const i of o) {
      const h = state.p[i].hp;
      if (h > mx + 1e-9) { mx = h; cand.length = 0; cand.push(i); }
      else if (Math.abs(h - mx) < 1e-9) cand.push(i);
    }
    return mpPickOne(state, cand);
  }
  function mpSaver(state, pid) {           // 正在攒钱的对手（ep>=3，快要放大招）
    const o = mpOpps(state, pid); if (!o.length) return null;
    let mx = 2.999; const cand = [];
    for (const i of o) {
      const e = state.p[i].ep;
      if (e > mx + 1e-9) { mx = e; cand.length = 0; cand.push(i); }
      else if (Math.abs(e - mx) < 1e-9) cand.push(i);
    }
    return mpPickOne(state, cand);
  }
  function mpKillable(state, pid, amt) {   // 能一击打死（hp<=amt）的目标
    const cand = mpOpps(state, pid).filter(function (i) { return state.p[i].hp <= amt + 1e-9; });
    return mpPickOne(state, cand);
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
  /* ===== 破原型制御脚本（分工修正）=====
   * 用户指出：**大雷已经有 `breakdef` 单独负责**，不该让这个脚本也出大雷。
   * 而这个脚本的职责是**测试"绕过原型制御"这条路**——按规则
   *   `原型制御 阻挡除 地雷、转移伤害 外的技能伤害`
   * 只有这两个能穿，且**都是"挨打才生效"的反射机制**，不是主动攻击：
   *   - 转移伤害(2 ジ, 目标敌人)：本回合所受可转移伤害转给目标
   *   - 地雷(3 ジ, 目标自己)    ：被非狙击攻击时，攻击者受 1 火伤
   * 用户要求**二选一**（不要两个都塞进去）。这里做成工厂，用数据挑赢家。
   * 判据沿用已验证的「近 5 回合架势频率」；同时保留枪线，保证它会还手。 */
  /* 跨回合观察：近 5 回合里"领先者"摆架势的次数。
   * 为什么不做成"预测本回合意图"：引擎在决策时刻不提供对手意图（所有人同时声明），
   * 上一版读 `lastSkill === PROTO` 做了 120 次检查、**0 次命中**（拿上一回合的招当这一回合的意图）。
   * 这里只记**可观测的历史频率**，不假装预知。⚠️ 仿 __mem 既有模式：模块级、round===1 重置。 */
  const DS_WIN = 5;
  const DS_STANCE_NEED = 2;
  const DS_STANCE = [SK.GUARD, SK.SHIFT, SK.REFLECT, SK.PROTO, SK.JINSHIELD, SK.ARMOR, SK.BAGUA];
  let __pbMem = { seenRound: -1, recent: [] };
  function resetProtoMem() { __pbMem = { seenRound: -1, recent: [] }; }
  function dsStanceSeen(state, tl) {
    const rd = state.round || 1;
    if (rd === 1 || rd < __pbMem.seenRound) resetProtoMem();
    if (tl == null) return 0;
    if (__pbMem.seenRound !== rd) {
      __pbMem.seenRound = rd;
      const sk = state.p[tl].lastSkill;
      __pbMem.recent.push(DS_STANCE.indexOf(sk) >= 0 ? 1 : 0);
      if (__pbMem.recent.length > DS_WIN) __pbMem.recent.shift();
    }
    let c = 0;
    for (const v of __pbMem.recent) c += v;
    return c;
  }

  const mkProtoBreaker = function (tool) {
    return function (state, pid, legal) {
      const bk = mpBk(legal);
      const tl = mpLeader(state, pid);
      const seen = dsStanceSeen(state, tl);
      if (seen >= DS_STANCE_NEED) {
        if (tool === SK.TRANSFER && mpAff(bk, SK.TRANSFER)) return { key: SK.TRANSFER, target: tl };
        if (tool === SK.MINE && mpAff(bk, SK.MINE)) return { key: SK.MINE, target: null };
      }
      if (mpAff(bk, SK.GUN)) return { key: SK.GUN, target: tl };
      return { key: SK.JI, target: null };
    };
  };
  const pickProtoMine = mkProtoBreaker(SK.MINE);
  const pickProtoTransfer = mkProtoBreaker(SK.TRANSFER);

  /* ===== 集火脚本（转移伤害诊断用）=====
   * 目的：制造 **单回合承伤 N>=2** 这个条件——转移伤害赚 ⟺ N>=2（见 CHANGELOG v1.3.40），
   * 而当前 meta 里 N>=2 的唯一常见来源就是"被集火"。
   * ⚠️ 目标设置（用户特别提醒）：
   *   - 必须**显式返回 {key,target}**，不能只返回技能名（否则回落到 pickTargetN，集火就散了）；
   *   - 目标必须是**存活**且**不是自己**的对手；
   *   - 选"**血量最低**"是为了让**多个集火脚本各自算都能得到同一个目标**（确定性共识），
   *     而不是各自随机挑——否则两个脚本会分开打，N 永远到不了 2。 */
  /* ===== v1.4.1：两个"前置条件提供者"脚本（用户 2026-09-12 指出这类卡需要专门的脚本）=====
   * 背景：v1.3.60 起已有 `--field=` 前置条件场，但池子里**没有铺雷者**也没有"贴符咒的人"，
   * 于是藤甲的火弱那一半、贴贴×天火这条组合线在**任何考卷上都测不到**。 */

  /* 地雷专精：攒到 3 ジ就铺雷，否则 ジ（濒死时补防御）。
   * 为什么它是关键器材：地雷既是**火焰伤害来源**（藤甲的"下回合火伤+1"才有对象，
   * 见 resolve.js:192 火弱只加到挂了 debuff 的那个人），又是**触发型 AoE**
   * ——5 血下已实测解冻（3 血 Δ−1.3pt → 5 血 Δ+4.0pt）。 */
  function pickMineSpam(state, pid, legal) {
    const bk = mpBk(legal), me = state.p[pid];
    if (mpAff(bk, SK.MINE)) return { key: SK.MINE, target: null };
    if (me.hp <= 1 && mpAff(bk, SK.GUARD)) return { key: SK.GUARD, target: null };
    return { key: SK.JI, target: null };
  }

  /* 贴贴×天火组合：先贴符咒，再**承诺攒钱**到 2 引爆。
   * ⚠️ 设计教训（v1.3.60 实测）：第一版"能贴就贴"永远停在 1 ジ ⇒ 天火只引爆 8 次、1st 0.1%；
   * 改成一贴一存后引爆 2749 次。ep 的唯一来源是 ジ 的 +1（resolve.js:501），
   * 所以任何"先铺场再兑现"的组合都必须显式放弃当期支出（与 evo.js 的 makeCommitChooser 同理）。
   * 注：符咒 `age <= 3` 会失效，而铺符速率上限是 1 张/2 回合 ⇒ 同目标实际最多只有 1 张活符咒。 */
  function pickCurseStorm(state, pid, legal) {
    const bk = mpBk(legal), o = mpOpps(state, pid);
    if (!o.length) return { key: SK.JI, target: null };
    let t = o[0];
    for (const i of o) if (state.p[i].hp < state.p[t].hp - 1e-9) t = i;
    let mine = 0;
    const st = state.p[t].stickers || [];
    for (const x of st) if (x.owner === pid && x.age <= 3) mine++;
    if (mine > 0) {
      if (mpAff(bk, SK.FIRESTORM)) return { key: SK.FIRESTORM, target: t };
      return { key: SK.JI, target: null };            // 承诺攒钱，别顺手再贴
    }
    if (mpAff(bk, SK.CURSE)) return { key: SK.CURSE, target: t };
    return { key: SK.JI, target: null };
  }

  /* ===== v1.4.11 聚能环经济流（用户 2026-09-12 指出的关键前置条件）=====
   * 聚能环是全游戏**唯一的"钱生钱"线**：首次 3 ジ → +1（净 −2），连续第 2 次 0 ジ → +2，
   * 第 3 次起 0 ジ → **+3 ジ/回合**（resolve.js:614-616）。
   * 它唯一的反制是**小雷（雷击之枪）**：void 掉对手的环 ⇒ 该次 outcome 不是 ok ⇒
   * resolve.js:789 把 `ringStreak` 归零，3 ジ的投入与复利线一起报废。
   * 原先池子里**没有任何脚本在开环**（只有个别脚本在自己 streak>0 时顺手续），
   * 所以"小雷反制环"这条线从未被演练、也从未在考卷上被测量。 */
  function pickRingSpam(state, pid, legal) {
    const byKey = {}; legal.forEach(l => byKey[l.key] = l);
    const aff = k => byKey[k] && byKey[k].affordable;
    const me = state.p[pid];
    /* 第一版只"开环+续环"⇒ 从不防守也从不兑现，开环还没回本就被打死（考卷上冠军 100%）。
     * 真实的经济流必须**攒到能兑现一次大件**（第十轮复核的"环→bank8 出大雷"轨迹），
     * 代价是每次兑现都会断链（非 RING 的动作把 streak 清零）。 */
    const BANK = 5;                                  // 攒到能放"真正的落雷"就兑现
    if (me.ringStreak > 0) {
      if (me.ep >= BANK) {                           // 兑现：最贵的输出优先（这一手会断链）
        if (aff(SK.BIG_T)) return SK.BIG_T;
        if (aff(SK.RAILGUN)) return SK.RAILGUN;
        if (aff(SK.TANK)) return SK.TANK;
        if (aff(SK.SWORD)) return SK.SWORD;
        if (aff(SK.SNIPE)) return SK.SNIPE;
      }
      if (me.hp <= 1 && aff(SK.GUARD)) return SK.GUARD;   // 濒死先保命（也会断链，但活着才有复利）
      if (aff(SK.RING)) return SK.RING;              // 续环：0 成本 +1/+2/+3 ジ
      return affOrJi(legal);
    }
    if (aff(SK.RING) && me.ep >= 3) return SK.RING;  // 攒够 3 ジ开环（净 −2 换复利）
    if (me.hp <= 1 && aff(SK.GUARD)) return SK.GUARD;
    return affOrJi(legal);
  }

  function pickFocusFire(state, pid, legal) {
    const bk = mpBk(legal);
    const o = mpOpps(state, pid);
    if (!o.length) return { key: SK.JI, target: null };
    let t = o[0];
    for (const i of o) if (state.p[i].hp < state.p[t].hp - 1e-9) t = i;   // 同一个共识目标
    if (mpAff(bk, SK.GUN)) return { key: SK.GUN, target: t };
    return { key: SK.JI, target: null };                                  // 攒到能开枪再打
  }

  /* ===== 会瞄人的对手 pickTargeter（v1.5.71，第五轮复核 §4-1/§3-2）=====
   * 池子里**没有任何对手会瞄人**，这是三个现象的共同病根（复核 §3-2 的合成结论）：
   *   · 狙击专精看起来"无解"—— 实测给 4 席对手加一条"谁用狙击就瞄谁"的规则 ⇒ 候选夺冠 30% → 0%；
   *   · 场B（对手只ジ不还手）里冠军清不掉人（清场 0.00/局）；
   *   · 聚能环从没被反制过（八次尝试都没学会）。
   * 所以这里补的不是"又一个人格"，而是**梯度**：谁是威胁就指谁，让"被威胁"这件事在训练里真的出现。
   *
   * 威胁判据**只读状态真源**（不猜字段、不解析事件）：
   *   `state.p[o].ringStreak > 0`（在滚环）· `lastSkill === SK.SNIPE`（上回合出过狙击）· `ep >= 5`（攒满大雷）；
   *   有威胁 ⇒ 掐威胁；**没有威胁也压领先者**（不能攒钱躺平 —— 见下方 ⚠️ 的反噬说明）。
   * ⚠️ 与 `pickFocusFire`（打**残血**抢人头）方向相反：那条是抢，这条是掐，池里各有用途。
   * ⚠️ 目标不会被引擎剥掉：`wrapBotN` 自 v1.3.55 起保留脚本自选目标（返回 {key,target} 即可）——
   *   若这条不成立，本对手会退化成"又一个 pickTargetN"，整批实验会白跑（已加守门 D63）。 */
  function pickTargeter(state, pid, legal) {
    const bk = mpBk(legal), me = state.p[pid];
    const o = mpOpps(state, pid);
    if (!o.length) return { key: SK.JI, target: null };
    const isThreat = function (i) {
      const p = state.p[i];
      return (p.ringStreak > 0) || (p.lastSkill === SK.SNIPE) || (p.ep >= 5);
    };
    const threats = o.filter(isThreat);
    let t = null;
    const ring = threats.filter(function (i) { return state.p[i].ringStreak > 0; });      // 复利最贵，优先掐
    if (ring.length) t = mpPickOne(state, ring);
    if (t == null) {
      const sn = threats.filter(function (i) { return state.p[i].lastSkill === SK.SNIPE; }); // 其次：刚放冷枪的
      if (sn.length) t = mpPickOne(state, sn);
    }
    if (t == null && threats.length) t = mpPickOne(state, threats);                        // 其次：攒满大雷的
    if (me.hp <= 1 && mpAff(bk, SK.GUARD)) return { key: SK.GUARD, target: null };         // 濒死先保命
    if (mpAff(bk, SK.GUN)) {
      /* ⚠️ v1.5.71 修正（实测反噬）：没有威胁时**也必须施压**，不能一直攒钱。
       * 第一版写成"无威胁 ⇒ 攒钱"，结果这个对手在不被挑衅时等于一个农民 ⇒
       * ① `--field=targeter` 变成弱场（**随机基线都有 78.3%**，新候选 100%）；
       * ② 更要紧的是它会给训练送一条**反向梯度**："别成为威胁（别开环/别用狙击/别攒到 5 ジ）
       *    就不会被打" ⇒ 正好喂大我一直在打的"低压力场瘫"（E/场A/场B 那一族）。
       * 现在：有威胁 ⇒ 掐威胁（原设计）；没有威胁 ⇒ 压领先者（与其他进攻脚本一致）。 */
      return { key: SK.GUN, target: (t != null) ? t : mpLeader(state, pid) };
    }
    return { key: SK.JI, target: null };                                                   // 攒到能开枪
  }

  /* ===== 狙击专精 pickSnipeSpam（v1.5.71，第五轮复核 §4-2）=====
   * 狙击场探针的"威胁源"：4 席只会一件事的狙击手。为什么要它 —— 复核把"狙击看起来无解"证伪了：
   * 任何带攻击效果的技能指过来就能让狙击无效（**1 ジ 的枪就够**），所以它是最容易被废的攻击卡；
   * 而池里没人会瞄人 ⇒ 满分环境里它显得无敌（v17-146 夺冠 30%，加上"瞄狙击手"规则后 0%）。
   * 口径与 reflectspam/ringspam 一致：只做一件事（能狙就狙），目标是"让'被瞄'真的发生"。 */
  function pickSnipeSpam(state, pid, legal) {
    const bk = mpBk(legal);
    if (mpAff(bk, SK.SNIPE)) {
      const k1 = mpKillable(state, pid, 1);                    // 能一击致命就杀（2 ジ 换 1 血）
      if (k1 != null) return { key: SK.SNIPE, target: k1 };
      const t = mpLeader(state, pid);                           // 否则压领先者
      if (t != null) return { key: SK.SNIPE, target: t };
    }
    return { key: SK.JI, target: null };                        // 攒钱到能开枪
  }

  /* ===== 压制密度对手 pickGunSpam（v1.5.90，第八轮复核 §6 / §8-3）=====
   * 复核的命门：**一行代码、用最便宜的一张卡**（枪，1 ジ，打血量最高者）在长程把线上冠军打死 65%；
   * 四包里没有一包顶得住。机制**不是**"集火 vs 散射"（集火率最高的两条反而最弱），而是
   * **overkill 浪费 + 输出密度** —— 冠军 57~65% 的回合在按 ジ、ep 峰值只有 2
   * ⇒ "交 tempo 税去攒一种永远花不掉的东西"。
   * 池里没有这种压迫 ⇒ 训练里"低密度"不受罚。所以这里补的不是"又一个人格"，而是**给密度补梯度**。
   * 口径与其他 `*spam` 一致：只做一件事（付得起枪就开枪）。
   * ⚠️ 目标选择：**只在血量最高的那一档里随机取一个**（`mpPickOne`），**不能**按 pid 取最肥 ——
   *    那会重新引入"座位身份通道"（D50/D58 家族，本仓库栽过多次）。 */
  function pickGunSpam(state, pid, legal) {
    const bk = mpBk(legal);
    if (mpAff(bk, SK.GUN)) {
      const o = mpOpps(state, pid);
      if (o.length) {
        let mx = -Infinity;
        for (const i of o) if (state.p[i].hp > mx) mx = state.p[i].hp;
        const fattest = o.filter(function (i) { return state.p[i].hp >= mx - 1e-9; });
        return { key: SK.GUN, target: mpPickOne(state, fattest) };
      }
    }
    return { key: SK.JI, target: null };                        // 攒到能开枪
  }

  /* ===== 只枪对手 pickGunFocus（v1.5.133；**G4 那格的口径写成人格**）=====
   * 为什么要有它：`G4[long] 只枪` 是**全仓唯一已知红门**（线上包 **75%(long)/62%(multi)**，阈值 60%），
   *   而 v1.5.133 把它的机制量成了因果读数 —— **不是被打死，是"龟"**：只枪局里被测席 **62.2% 的决策是ジ**、
   *   其中 **1759 次是"当回合枪买得起却选攒钱"**；只把这一条规则改成"买得起就开枪" ⇒ 只枪胜率
   *   **75% → 13%**（long）/ **62% → 17%**（multi），而**场B 清场 1.00 → 1.00**
   *   （CHANGELOG v1.5.133 · `docs/research/handoff/HANDOFF-2026-09-19.md` §0d/§4-13 · 探针 `tools/probe-g4-anatomy.mjs`）。
   * ⚠️ **它与 `pickGunSpam` 不是同一条线**（名字骗过很久）：
   *   · `pickGunSpam` = **只打最肥**（血量最高）＝ 稀释/喷子线；
   *   · 本函数 = **击杀优先 → 再压血量最高者**（与 `gate-drafts.mjs` 的 `pT` → `T.pickTargetN` 同口径）
   *     ＝ 聚焦线，**这才是 G4 那格真正在考的东西**。
   *   ⚠️ 顺带记一处**标签错误**：G4 把那格叫「只枪(1ジ压制·**打最肥**)」（`gate-drafts.mjs:222`），
   *     但实现是 `pT(...)` = **击杀优先**；真正的"打最肥"是 `pickGunSpam`。**故意不改那个标签**：
   *     `G4_POOL_ID` = 「键序 + 阈值」的 sha1（`gate-drafts.mjs:284-289`）⇒ 改标签会让 id 变，
   *     线上包 meta 里已记录的 `--force` 例外（D67）会当场失效。要改就得同时改包 meta（另立一条）。
   * 实测（同一个 G4 harness，n=60）：池里那条 `pickGunSpam` 打线上包 **83%(long)/77%(multi)**，
   *   **比 G4 那格更狠 8/15pt** ⇒ "池里没有枪线"这个解释**站不住**（本函数加进池子是去打**另一个假设**：
   *   "缺的是**枪在聚我**这个压力"）。
   * ⚠️ **预注册预测（v1.5.133，跑臂之前写下来）**：这次池子单杠杆**很可能不动 G4** —— 因为
   *   训练局的**压力座次份额**与考卷不同：训练是"1 席候选 vs 4 席对手"（枪手的目标里只有 ~1/4 是候选），
   *   考卷是"4 席我的家族 vs 1 席枪手"（**子弹全落在我家**）；而 v1.5.89 的头注**已经**把机制写成
   *   "低密度不受罚"并加了 `pickGunSpam` —— 池里早有密度线，G4 仍然是红的。若这次真的不动，
   *   下一根杠杆是**训练形状**（4 席自家族 + 1 席脚本外部人），不是再加对手。
   * 口径与其他 `*spam` 一致：只做一件事，**不按 pid 取人**（避免座位身份通道 D50/D58）。 */
  function pickGunFocus(state, pid, legal) {
    const bk = mpBk(legal);
    if (mpAff(bk, SK.GUN)) {
      const k1 = mpKillable(state, pid, 1);                  // 枪 1 点：能一击必杀先杀
      const t = (k1 != null) ? k1 : mpLeader(state, pid);    // 否则压血量最高者
      if (t != null) return { key: SK.GUN, target: t };
    }
    return { key: SK.JI, target: null };                     // 攒到能开枪
  }

  /* ===== 收割型对手 pickKillSecure（v1.5.156 · DS 09-22）=====
   * 为什么写它：跨 N 的臂 7′（`docs/research/logs/RESEARCH-LOG-2026-09-22-ds.md` §11）两场都拿得出手，
   * 唯一缺口是「**把击杀收干净**」（场B 清场 0.10 < 0.3/局 ＋ G4[long]「珠爆发」63% ✗）。
   * 而池子里**没有**这条线 —— 最接近的 `pickGunFocus` 打的是**最肥**的（`mpLeader`）✗，
   * 本线打**最残**的（`oppPidOf` = 血量最低的存活对手 ✓）。
   * 口径（只做一件事，与 `*spam` 族一致 —— 它是对手/教师线上的**专才**，不是冠军）：
   *   ① 本回合能一击必杀 ⇒ 走**最便宜**的必杀（枪 1 → 狙击/坦克/激光剑 1 → 电磁炮 2），把击杀兑现；
   *   ② 没有必杀 ⇒ 把伤害压在**血量最低**的对手身上（持续削，直到能收）；
   *   ③ 都打不动 ⇒ 攒ジ。
   * ⚠️ 取目标只用 `mpKillable` / `oppPidOf`（**不按 pid 取**）⇒ 不引入座位身份通道（D50/D58 家族，栽过多次）。
   * ⚠️ 这是"先量价值再投入"的第一半：先用价值表量它值不值钱，再决定进不进池/教师计划。 */
  function pickKillSecure(state, pid, legal) {
    const bk = mpBk(legal);
    const order = [[SK.GUN, 1], [SK.SNIPE, 1], [SK.TANK, 1], [SK.SWORD, 1], [SK.RAILGUN, 2]];
    for (let i = 0; i < order.length; i++) {
      if (!mpAff(bk, order[i][0])) continue;
      const t = mpKillable(state, pid, order[i][1]);
      if (t != null) return { key: order[i][0], target: t };
    }
    if (mpAff(bk, SK.GUN)) { const t = oppPidOf(state, pid); if (t != null) return { key: SK.GUN, target: t }; }
    if (mpAff(bk, SK.JI)) return { key: SK.JI, target: null };
    const a = legal.find(function (l) { return l.affordable; });
    return { key: a ? a.key : SK.JI, target: null };
  }

  /* ===== 珠爆发对手 pickBeadBurst（v1.5.129；第三方复核 §3 的实锤线，写成人格）=====
   * 实锤（`docs/research/reviews/REVIEW-QODER-2026-09-19.md` §3，复核者独立复跑 n=100~200）：这条线对
   * **2P 线上冠军 100% 胜**（standard · 均 9 回合）、对 3P 冠军 99%、multi@N=2 98%。机理**全在规则内**：
   *   · 电磁炮 2 点电伤**同时破防御与反弹**（`rules.js:68` 的 `pierce`）、优先级 3 压过冠军主力狙击
   *     （狙击 pri 1），而"任何攻击动作都废掉对面狙击"；
   *   · 冠军**从不备电系防御、从不花珠** —— 它自己的 meta 就量着"花珠率 0.0% · 珠经济未闭环"。
   * 考卷/G4 池里**没有这条线** ⇒ 体检看不见这个洞（这正是"可利用的战术洞"与"体检脚注"的区别）。
   * 口径与其他 `*spam` 一致：只做一件事 —— **为放电而蓄电珠 · 有电珠就放电磁炮 · 残血摄魂收尾**。
   * ⚠️ 取目标与 pickGunSpam 同规矩：只在"最该打的那一档"里随机取（`mpPickOne`），**不按 pid 取**，
   *    否则会重新引入座位身份通道（D50/D58 家族，本仓库栽过多次）。
   * ⚠️ 摄魂的门在**施法者自己**身上（`state.js:128-131` 读 `p.hp > drainHpMax` ⇒ standard/multi 是
   *    **自己 HP≤1**、long 是 ≤3）⇒ `mpAff(bk, SK.DRAIN)` 为真时它必然已在窗口内，不必再判。 */
  function pickBeadBurst(state, pid, legal) {
    const bk = mpBk(legal), me = state.p[pid];
    /* ① 放电：能一击必杀（2 点）先杀，否则压领先者 */
    if (mpAff(bk, SK.RAILGUN)) {
      const k2 = mpKillable(state, pid, 2);
      if (k2 != null) return { key: SK.RAILGUN, target: k2 };
      const ld = mpLeader(state, pid);
      if (ld != null) return { key: SK.RAILGUN, target: ld };
    }
    /* ② 残血收尾：只有自己在摄魂窗口内这一手才在 legal 里（见上），命中还自愈 1 血 */
    if (mpAff(bk, SK.DRAIN)) {
      const k1 = mpKillable(state, pid, 1);
      const dt = (k1 != null) ? k1 : mpLeader(state, pid);
      if (dt != null) return { key: SK.DRAIN, target: dt };
    }
    /* ③ 心脏：**蓄电珠** —— 但**必须等到"下一回合付得起电磁炮"再蓄**（v1.5.129 实测踩到的坑）！
     *   珠只活到下一回合末（`resolve.js:1203-1209`：`keep = p.beadNew || null`），而蓄能花 1 ジ。
     *   若写成"买得起蓄能就蓄"（我的第一版），这张卡会退化成
     *   `蓄能 → ジ → 珠过期 → 蓄能 → …` **永不放炮**：实测 200 局里 `railgun` 出手 **0 次**、
     *   造成伤害 **0.00/局**（探针 `tools/probe-beadburst.mjs`），而冠军只打出 1.60 伤/局
     *   ⇒ "这条线能赢"与"这条线打得出炮"**完全是两件事**，脚本必须显式保证后者。
     *   ⇒ 门槛 **`me.ep >= 3`**：花 1 蓄珠后余 ≥2，下一回合才付得起电磁炮的 2 ジ。
     *   ⚠️ 返回的 `bead:'elec'` **不可省** —— `play.js:33-37` + `:65-69` 是 v7 的珠类型通道，
     *      不显式给就只会拿到启发式兜底（"蓄珠为放电"这件事就永远学不到）。
     *   （蓄能花费 = 1 是 `rules.js:44` 的卡面常量；`mpAff` 只是同时挡住"经济门槛/禁用"这类引擎侧条件。） */
    if (me.elec < 1 && me.ep >= 3 && mpAff(bk, SK.CHARGE)) return { key: SK.CHARGE, target: null, bead: 'elec' };
    return { key: SK.JI, target: null };                       // 攒到"能蓄且下一回合能放"
  }

  /* ===== 防守型瞄准教师 pickAimDefender（qoder-research 0920 · Q1 臂专用，**只走教师通道、不进对手池**）=====
   * 动机（CHANGELOG v1.5.134 §3/§5 + docs/research/reviews/REVIEW-QODER-2026-09-19.md §6-2）：G4「只枪」那格的主杠杆
   * 是**往谁身上打**（aimGunner：同一包只改目标、不多花钱 ⇒ 75%→0%），不是**花不花钱**。
   * 池子加对手买到的是"躲"（v7gf1-92 变被动过门 ⇒ 场B 清场 0.00 挂 G5），而"打枪手"是**教师型行为**
   * ——模仿通道（`EPIRUS_IMIT_TEACHER` + OVERRIDE）是全仓唯一被复现过的学习杠杆（无教师对照 0/6）。
   * 本教师示范三件事：① **谁在压迫我我就打谁**（本局造成伤害最高者）② **能杀就先杀** ③ **买得起就打**
   * （示范花钱密度）；面对架势（上回合 guard/reflect 族）**用狙击穿**。⚠️ 它**从不摆防御** ——
   * 龟这条轴已被 v1.5.133 反事实钉死为**负样本**，教师哪怕捎带防御倾向都会把臂带回被动解。
   * ⚠️ 取目标只在"最高一档"里 `mpPickOne` 随机（D50/D58 座位身份通道规矩，同 `pickGunSpam`）。 */
  function pickAimDefender(state, pid, legal) {
    const bk = mpBk(legal);
    const opps = mpOpps(state, pid);
    if (!opps.length) return { key: SK.JI, target: null };
    /* 威胁榜：本局"造成伤害"最多的人 = 该集火的那一个（跨回合累计） */
    const dmg = {};
    for (const e of state.events) {
      if (e && e.type === 'damage' && e.source != null && e.amt) dmg[e.source] = (dmg[e.source] || 0) + e.amt;
    }
    let tgt = mpKillable(state, pid, 1);                      // ① 能一击必杀先杀
    if (tgt == null) {
      let mx = -Infinity; const cand = [];
      for (const i of opps) {
        const d = dmg[i] || 0;
        if (d > mx + 1e-9) { mx = d; cand.length = 0; cand.push(i); }
        else if (Math.abs(d - mx) < 1e-9) cand.push(i);
      }
      tgt = mpPickOne(state, cand);                           // ② 否则打"造成最高伤害"的压迫者
    }
    if (mpStanceOf(state, tgt) !== 'none' && mpAff(bk, SK.SNIPE)) return { key: SK.SNIPE, target: tgt };
    if (mpAff(bk, SK.GUN)) return { key: SK.GUN, target: tgt };                        // ③ 买得起就打
    return { key: SK.JI, target: null };
  }

  /* ===== 会传导的大雷线 pickBigTFocus（DS 交接件 P3 · 规格按用户 09-21 口径写死）=====
   * 为什么要有它：本仓关于大雷的两次结论都用的是**不会为传导选目标**的脚本
   * （`pickHeavyFire` 实测最大 ep=2 ⇒ 结构上买不起；纯攒大雷线盲放 ⇒ 传导/施放只有 0.43），
   * 而用户实盘 4 次施放传导 0/0/1/2 人（均值 3.50 点/次 vs 不传导 2.00）⇒ 那两行"大雷亏本"量的不是这张卡。
   * **规则依据**（`resolve.js` 的 N22 段）：传导集合 = 目标 T 的「本回合打了 T 的人」∪「T 自己指着的人」，
   * 每人 2 点电伤 + 该技能被无效化（防御族与小雷不失效）⇒ 收益口径是**封住的行动数**，不只是伤害。
   * 目标函数只用**公共信息**（`p[*].lastTarget/ep/hp`，不读身份 ⇒ 与 D50/D58 座位公平家族兼容）：
   *   ① 用户口径 A"攒到 2~3 ep 的人更可能出手" ⇒ 有出手能力（ep≥2）的第三方"上手指向 T"计 2 票；
   *   ② 用户口径 B"血厚者被集火 ⇒ 本回合仍有人打他" ⇒ 用上一回合的集火对象做预测（`lastTarget===T`）；
   *   ③ T 自己上一手指着谁，那个人也吃一发（计 1 票，权重低于①，因为它不看 ep 会误判无力者）；
   *   ④ 血厚（hp≥3）加半票（既撑得起"被集火"的推断，也更难被一发带走）。
   * 先攒到 5 ジ 才放（`pickDeepSaver` 的同族纪律 —— 不攒就等于永远买不起，那正是空示范老坑的成因）。 */
  function bigtHubTarget(state, pid) {
    const opps = mpOpps(state, pid);
    if (!opps.length) return null;
    let best = -Infinity; const cand = [];
    for (const t of opps) {
      let votes = 0;
      for (const q of opps) {
        if (q === t) continue;
        const pq = state.p[q];
        if (pq.lastTarget === t && (pq.ep || 0) >= 2) votes += 2;      // ①+②：有能力、且上一手打过 T
        else if (pq.lastTarget === t) votes += 1;                      // 打过但暂时没 ep ⇒ 弱信号
      }
      const lt = state.p[t].lastTarget;
      if (lt != null && lt !== t && lt !== pid && state.p[lt].hp > 0) votes += 1;   // ③
      if (state.p[t].hp >= 3) votes += 0.5;                            // ④
      if (votes > best + 1e-9) { best = votes; cand.length = 0; cand.push(t); }
      else if (Math.abs(votes - best) < 1e-9) cand.push(t);
    }
    return mpPickOne(state, cand);
  }
  function pickBigTFocus(state, pid, legal) {
    const bk = mpBk(legal);
    if (!mpAff(bk, SK.BIG_T)) return { key: SK.JI, target: null };     // 攒钱（5 ジ），中途不分薄
    const k2 = mpKillable(state, pid, 2);
    if (k2 != null) return { key: SK.BIG_T, target: k2 };              // 能一发带走就先带走
    return { key: SK.BIG_T, target: bigtHubTarget(state, pid) };
  }
  /* ===== v1.5.183（DS · **用户洞察**）：连带感知的大雷教师 =====
   * 用户原话意思："现在的冠军有**一定程度的集火能力**，既然有集火就会可以**大量连带**，这可能是一个挑时机的方法"。
   * 机制（`resolve.js:884-909` · N6/N22）：与**被劈中的目标**产生交互的第三方**各受 2 点电伤**且其出手被 `setVoid` 作废
   * ⇒ 大雷"值钱"的时刻 = **目标正被多人盯上**（集火）时劈它 —— 一份 5 ジ买到的不是 2 点，而是 N 份 2 点 + N 份作废。
   * 信号（**决策时刻的公共信息**，`state.js:12/187`）：`p[q].lastTarget / lastTarget2` = 该席上一手指向谁
   * ⇒ 数"有几席指着同一个人"。⚠️ 条件必须**状态相关且稀有**（v1.5.37 的教训：旧条件 `ep>=2` 在 **45%** 的决策
   * 都成立 ⇒ 教师实际在教"见人兜里有 2 ジ就砸小雷"，示范动作与"开环"这个状态无关）。
   * 与 `pickBigTFocus` 的关键区别：它"买得起就打"，这条**集火不成立就不打**（乱放 = 白扔 5 ジ，正是用户警告的那种浪费）。 */
  function focusTarget(state, pid) {
    const tally = {};
    for (let q = 0; q < state.p.length; q++) {
      if (q === pid) continue;
      const pq = state.p[q];
      if (!pq || pq.hp <= 0) continue;
      const t1 = pq.lastTarget, t2 = pq.lastTarget2;
      if (t1 != null && t1 !== q) tally[t1] = (tally[t1] || 0) + 1;
      if (t2 != null && t2 !== q && t2 !== t1) tally[t2] = (tally[t2] || 0) + 1;
    }
    let best = -1, bestN = 0;
    for (const k in tally) {
      const qi = Number(k);
      const pq = state.p[qi];
      if (!pq || pq.hp <= 0 || qi === pid) continue;
      if (tally[k] > bestN) { bestN = tally[k]; best = qi; }
    }
    return bestN >= 2 ? { seat: best, n: bestN } : null;   // ≥2 席指向同一人 ⇒ 判为集火
  }
  function pickBigTChain(state, pid, legal) {
    const bk = mpBk(legal);
    if (!mpAff(bk, SK.BIG_T)) return { key: SK.JI, target: null };   // 攒到 5 ジ（中途不分薄）
    const k2 = mpKillable(state, pid, 2);
    if (k2 != null) return { key: SK.BIG_T, target: k2 };            // 能一发带走仍优先
    const f = focusTarget(state, pid);
    if (!f) return { key: SK.JI, target: null };                     // **没有集火就不打** = 挑时机
    return { key: SK.BIG_T, target: f.seat };
  }
  /* **对照组**（P3 预注册要求的那一条）：同样攒到 5 ジ 才放、同样"能一发带走就先带走"，
   * 唯一区别 = 目标随机取。它用来回答"传导到底是**选出来的**还是**这片场自己撞出来的**"——
   * 没有它，`pickBigTFocus` 与 `pickBreakDef` 那 0.03 的差就无从判读。 */
  function pickBigTRandom(state, pid, legal) {
    const bk = mpBk(legal);
    if (!mpAff(bk, SK.BIG_T)) return { key: SK.JI, target: null };
    const k2 = mpKillable(state, pid, 2);
    if (k2 != null) return { key: SK.BIG_T, target: k2 };
    const o = mpOpps(state, pid);
    return { key: SK.BIG_T, target: mpPickOne(state, o) };
  }

  /* ===== 深经济对手 pickDeepSaver（"会攒 + 会还手"）=====
   * ⚠️ 它曾在 v1.3.27 加入、在 v1.3.30（N20 地雷 AoE 重写）被**静默删除**——
   * 那个 commit 的 CHANGELOG 只字未提，之后 24 个版本没人发现，而 REVIEW-3P §1-D
   * 还把对手池变动记成"去重（项目卫生）"，恰好掩盖了它。v1.3.55 恢复。
   *
   * 它补的位置是**现有对手池里唯一空缺的**：`pickFarmer` 只攒不还手（逼不出惩罚），
   * `pickHeavyFire` 会还手但**不攒**（ep<=2，贵技能分支永不触发，所以它和 tankline 曾被测为等价）。
   * 本脚本先攒到 5 ジ 再放大雷，正是"不攒钱就该受罚"这条压力在考卷里的唯一来源。
   *
   * 设计教训（CHANGELOG v1.3.27 实测，已内化进本实现）：
   * 早先版本一买得起就放地雷(3 ジ) ⇒ **最高 ep 只到 3**，大雷那一支永不触发。
   * 3 ジ 与 5 ジ 在本脚本里互斥（花了 3 就再也到不了 5），故选**保住大雷**，
   * 地雷只留作"对手正在用原型制御"时的独占补充（该分支实测命中 0 次，属无害死代码）。 */
  function pickDeepSaver(state, pid, legal) {
    const bk = mpBk(legal), me = state.p[pid];
    const k2 = mpKillable(state, pid, 2);                    // 大雷 2 点：能一击必杀就杀
    if (k2 != null && mpAff(bk, SK.BIG_T)) return { key: SK.BIG_T, target: k2 };
    if (mpAff(bk, SK.BIG_T)) return { key: SK.BIG_T, target: mpLeader(state, pid) };
    const tl = mpLeader(state, pid);
    if (mpAff(bk, SK.MINE) && tl != null && state.p[tl].lastSkill === SK.PROTO)
      return { key: SK.MINE, target: tl };
    if (me.hp <= 1 && mpAff(bk, SK.GUARD)) return { key: SK.GUARD, target: null };
    return { key: SK.JI, target: null };                     // 攒钱
  }

  /* ===== 10-02（用户裁定批 · 千问 P-econ-exam §2）：经济轴的**两根反向锚** =====
   * 动机（§E226 实测，32,200 局）：23 张原型桌里**没有一张能考出"随环境换花费时机"**——
   * `saver − spender` 在 21/23 张桌上是 0.0 vs 0.0，因为**考场里几乎没人攒到值得怕的程度**
   * （20/23 张桌的脚本对手打出 ≥4 费卡的比例≈0.0%，见 §E227 的 `--oppTrace`）。
   * ⇒ 这两枚脚本的目的是**把那根轴造出来**（让它可被机检），不是"把某张桌做得更难"，也不承诺涨胜率。
   *
   * ⚠️ 两枚之间**只有一个自由度：第几回合开始花**（这是预注册判据的地基）：
   *   · 选牌规则**逐字相同**（`mpMostExpensiveAffordable(legal, R.CAT.ATTACK)` = 买得起的最贵**攻击**牌；
   *     没有攻击牌时退回"买得起的最贵一张" ⇒ 经济照样排空，否则这根轴会塌回"买不买得起"）；
   *   · 目标规则**逐字相同**（`econTarget`：能一击必杀先杀 → 否则压领先者，同 pickDeepSaver/pickGunFocus 家族口径）；
   *   · 唯一区别 = `pickDeadlineBurst` **攒到第 `ECON_B` 回合才全额兑现**，`pickEarlyPressure` **从第 1 回合就全额兑现**。
   *   ⚠️ 千问提案 §2 原文给两枚写了**不同**的目标规则（死线"锁焦点席" ‖ 早压"锁最脆"）⇒ 那是**两个自由量**，
   *      会把"分离方向必须相反"这条判据的解释搅浑（§E194 那条纪律）⇒ 这里统一成同一套，改动记进交接件。
   *
   * ⚠️ **不进默认进化池**：`OPP_DEFAULT = OPP_SPECS.slice(0, 9)` ⇒ 追加在 `OPP_SPECS` **尾部**不动任何既有协议
   *    （这也是"不许往默认池加键"那道门的本意）。 */
  let ECON_B = 6;   /* 死线的爆发回合。锚点是**实测的**不是扫出来的：唯一真会兑现的那枚（`pickDeepSaver`）
                     * 首次打出 ≥4 费卡就在第 6 回合、当时 ep 峰值 5 珠；而 `pickFarmer` 能攒到 32 珠却拖到
                     * 第 28 回合才花 ⇒ "攒"不缺，缺的是**兑现的纪律**（§E227 的 `--oppTrace`）。
                     * ⚠️ 只通过下面 `getEconB/setEconB` 读写（**不给 env 旋钮**）：它是"这张桌的参数"，不是
                     * 训练/出厂旋钮；预注册里那条"若判 (a) 才补 B∈{4,9} 敏感性"就用它跑，不必改代码。 */
  function getEconB() { return ECON_B; }
  function setEconB(b) { const v = Number(b); ECON_B = (isFinite(v) && v >= 1) ? Math.round(v) : 6; return ECON_B; }
  let _ecoIdx = null;
  function mpEconIdx() {   /* 键 → {cost, cat, dmg}。`R.skills` 是**数组形状**、真键在 `.key` 上
                            * （这个坑本仓踩过两次）⇒ 惰性建一次，别按对象键取。 */
    if (_ecoIdx) return _ecoIdx;
    _ecoIdx = {};
    for (const k in R.skills) { const s = R.skills[k]; if (s && s.key) _ecoIdx[s.key] = { cost: s.cost || 0, cat: s.cat, dmg: !!s.dmg }; }
    return _ecoIdx;
  }
  function mpEconSpend(legal) {   /* 两枚**共用**的选牌规则（单一来源）。
     * "伤害牌"用规则表自己声明的 `dmg` 字段判，**不手写第二份名单** —— 本仓为"名单写两遍/漏卡/桶重叠"栽过四次
     * （D117/D216 那一族）；⚠️ 首版我按 `cat === ATTACK` 过滤，实测把**真正的落雷/电磁炮/过载炮**（都是
     * `CAT.SPECIAL`）整族排除掉，最贵只打到 cost 3 的双枪射手 ⇒ 当场被单决策冒烟抓住。
     * 没有伤害牌可负担时退回"买得起的最贵一张" ⇒ 经济照样排空（否则这根轴会塌回"买不买得起"）。 */
    const idx = mpEconIdx();
    const pool = legal.filter(function (l) { return l.affordable; });
    const dmg = pool.filter(function (l) { const e = idx[l.key]; return e && e.dmg; });
    const use = dmg.length ? dmg : pool;
    let best = null, bc = -Infinity;
    for (const l of use) { const c = (idx[l.key] && idx[l.key].cost) || 0; if (c > bc) { bc = c; best = l; } }
    return best;
  }
  function econTarget(state, pid) {          /* 两枚**共用**的目标规则（单一来源） */
    const k2 = mpKillable(state, pid, 2);
    if (k2 != null) return k2;
    return mpLeader(state, pid);
  }
  function pickDeadlineBurst(state, pid, legal) {
    if (state.round < ECON_B) return { key: SK.JI, target: null };   /* 死线之前：只攒，不产生任何威胁 */
    const pick = mpEconSpend(legal);
    if (!pick) return { key: SK.JI, target: null };                  /* 真买不起任何一张才攒这一手 */
    return { key: pick.key, target: econTarget(state, pid) };
  }
  function pickEarlyPressure(state, pid, legal) {
    const pick = mpEconSpend(legal);                                 /* 与死线**同一套选牌/目标**，只差"从第 1 回合就花" */
    if (!pick) return { key: SK.JI, target: null };
    return { key: pick.key, target: econTarget(state, pid) };
  }

  /* v1.6.6 删除 `DIFFICULTY_N`（多人那三档 easy/medium/hard）：它唯一的"消费者"是 `ui.js` 里那行 `DN.hard.pick(...)`，
   * 而 `const DN = Bots.DIFFICULTY_N` 早在 v1.3.22（3462abf）就被删掉了 ⇒ 这张表**从未被读到**，
   * 页面走进那条分支只会 `ReferenceError`（修复与实测见 `ui.js` 的 `fallbackPickFor`，门 D153 兜底那条腿钉）。
   * 全库复查零使用（`grep -rn DIFFICULTY_N js tools server docs`）⇒ 按"没有消费者的表就是腐烂的表"直接删。
   * 兜底现在点名到函数：≥3 人 = `pickMultiStrong`，2 人 = `pickAdaptive`（历史上 2 人困难档就是它）。 */

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
    /* ⚠⚠ **v1.6.6 起"风格即档位"这句话作废**（用户 10-03 夜裁定「原本的简单普通就不能用了，
     *   你可以自由考虑新的脚本用难度分层还是风格化」⇒ 难度改由下面的 `DIFF_TIERS` 说话，风格只是"口味"）。
     * 直接原因（§E286，`tools/probe-diff-ladder.mjs`，1500 局/格，同一批种子跨格配对）：**风格的强度是桌形的函数，不是它的属性**——
     *   同一把尺（1 席人类形状替身 vs N-1 席同一档）下，"激进快攻"在 5 人桌上是**最硬**的一格（替身夺冠 9.1%），
     *   搬到 3 人桌就掉到中游（17.7%，而与"读招反制"差 11.2 ±2.9pt ⇒ 不是噪声）；"憋大招"在 5 人桌最软（53.6%）而在 3 人桌与高剂量档齐平（32.1%）。
     *   ⇒ 旧 note 里那串"约 17% → 约 55%"是 `tools/bot-audit.mjs` 的**另一种桌形**（3 人 60 局、对手轮换、且量的是"这个 bot 自己夺冠率"）
     *     被当成页面的难度排序用了 —— 第 45 条口径陷阱（"多久一次/多强"必须带装配名）在这里的代价是一整个功能。
     * 现在每条 note 只描述**打法**，强度一律去 `DIFF_TIERS` 查（那里每条带五个装配的实测数）。 */
    { id: 'st:reflectmix',   name: '节奏型',   pick: pickReflectMix,   note: '固定节奏：反弹→枪→坦克，可被识破' },
    { id: 'st:breakdef',     name: '憋大招',   pick: pickBreakDef,     note: '86% ジ 攒钱，等真正的落雷一发定胜负（大雷密度极高，但整桌最软的一档）' },
    { id: 'st:mix',          name: '全能型',   pick: pickMix,          note: '什么都用一点，出招最杂（有效技能数 4.38）' },
    { id: 'st:aggro',        name: '激进快攻', pick: pickAggro,        note: '一有机会就开枪，逼你打快棋（均 27 回合）' },
    { id: 'st:combocounter', name: '读招反制', pick: pickComboCounter, note: '读你最近 5 次出招来反制 —— 五个装配里都比"困难"更硬，所以它被收进 `DIFF_TIERS` 当成最高档' },
    { id: 'st:toolkit', name: '杂货铺', pick: pickToolKit, note: '§E600-B v2 + **计划层 P0~P7**（用户 10-13；**P7-断环** 于 10-15 晚加入，见 `planPick` 末尾的注释）：**地板=全能型**，只在"这回合本来只剩 ジ"或"自己血≤1 且场上真有威胁"时才把动作交给还没用过的低性价比卡；'
      + '往上叠一套看得懂局面的计划 —— 攒够 3 珠开聚能环（免费 +2/+3，连到 5 手、20 珠封顶）‖ 有人攒到 5 珠或带电珠就抬避雷针 ‖ '
      + '攒到 5 珠放大雷（先收能一雷打死的，再打断攒钱的，最后压领先者）‖ 贴贴渐进窗口（贴上才加码、被挡就止损）‖ 过载炮按 phase 的花费逻辑。'
      + 'v1 是"没用过就优先打"⇒ 实测每局挤掉正招的代价 −13.6%~−33.3%（配对 RCT，见 `docs/research/CARD-VALUE-2026-10-13.md`）。'
      + '给**弱档掺席**用：脚本席自身夺冠 v2 8.4% → 现在 12.1%（multi，同尺同 seed A/B）；不许拿"能不能打赢冠军"评价它（判据见 `docs/debug/breadth-probe.mjs` 头注与 `plan-firing.mjs`）' }
  ];

  /* ===== v1.6.6 难度阶梯（用户 10-03 夜指令 2：「重新研究脚本难度…比如可以设计成冠军作为底层但脚本探索概率很高的版本」）=====
   *
   * 形状：**同一颗冠军包**（人数=2 用 2P 那颗、≥3 用 3P 那颗，理由见下面 ③），难度 = **探索剂量**
   *   （`eps` = 有多少比例的手不取网络最优、`epsK` = 允许它在网络看好的前 K 张里乱抽、`epsMode` = soft 时探索不许覆盖防御/聚能环）。
   *   机制早就在（`evo.js` 的 `policyChooserN(params, temp, eps, epsK, epsMode)`，v1.5.139/141 就是它），
   *   这一版只是**把它做成玩家可选的档**，而不是页面里写死的一个数。
   *
   * 三条实测依据（`tools/probe-diff-ladder.mjs` · **1500 局/格 · 同批种子跨档逐局配对** · 替身夺冠率 %，越低=这一档越强；
   * 五个装配 = 5人3血 ‖ 3人3血 ‖ 5人5血 ‖ 5人4血 ‖ 2人3血(用 2P 那颗包)）
   *   ① **剂量梯在五个装配里全都单调、次序一致**（ε=1/uniform → .5 → .2(斜坡) → 0）：
   *      简单 60.9 ‖ 78.0 ‖ 72.7 ‖ 63.0 ‖ 90.1 → 入门 17.5 ‖ 28.4 ‖ 23.5 ‖ 22.4 ‖ 24.1
   *      → 普通 13.4 ‖ 23.4 ‖ 19.1 ‖ 16.9 ‖ 20.1 → 困难 11.9 ‖ 21.4 ‖ 14.5 ‖ 13.3 ‖ 15.5
   *      （与"普通"的配对差：入门 +4.0~+5.5pt、简单 +46.1~+70.1pt ⇒ 这两步**同号且远**；
   *        困难 −1.53±2.36 ‖ −2.00±2.77 ‖ −4.60±2.70 ‖ −3.53±2.48 ‖ −4.60±2.02pt ⇒ **只有"普通→困难"那一步在 5 人 3 血桌上分不开**，
   *        门 D227④ 因此把**这一对点名**放行成"不许翻序"（≥0），其余相邻档要求 ≥2pt —— 例外写死在名单里，不许悄悄放宽。）
   *   ② **最高一档给脚本**：读招反制在五个装配里全都比"困难"硬（−3.87±2.29 ‖ −16.93±2.43 ‖ −11.20±2.41 ‖ −8.40±2.36 ‖ −9.80±2.44pt）
   *      ⇒ 想要比贪心冠军更难，目前只有这一条路（剂量再往下加没有意义：ε=0 就是"完全不探索"的下界）。
   *   ③ **2 人那一格必须换包**：3P 那颗包在 1v1 上是**分布外**的（贪心档替身夺冠 27.5%，比 2P 颗的 15.5% 软 12pt），
   *      而且 3P 包在 2 人桌上剂量梯**反号**（ε=0 27.5 竟比 ε=.5 的 19.4 软 ⇒ 贪心策略在 1v1 里本来就不是最优）。
   *      ⇒ 用 2P 那颗（v1.0 为 1v1 训的）之后剂量梯恢复单调（15.5 / 20.1 / 24.1 / 90.1）。
   *      附带好处：「训练场」练出来的 2P 冠军重新有地方可玩（v1.6.6 之前页面把它挤到只剩"困难"一个槽，之后是"2 人桌的底层"）。
   *   ④ **最高档那一格用 `uniform` 而不是 `soft`**：同一剂量 ε=1/k40 在 soft 下只软到 24.6~39.3%，uniform 才软到 60.9~90.1%。
   *      机制是 soft 那条"探索不许覆盖防御/聚能环"的豁免（`evo.js`，v1.5.304 定它为 ≥1 门槛）在 ε=1 时仍然把整桌钉在防御线上 ——
   *      替身夺冠 24.6% 那一格不是"简单的对手"，是"很会站防的随机手"。所以最软一档必须连这层豁免一起放开。
   *
   * ⚠ 这些数是**人类形状替身**（`tools/human-pool.mjs`，56 局真人日志的条件分布）做的代理，不是真人；
   *   它衡量的是"一桌同档 AI 给一个会按人类分布出牌的玩家多大压力"，与"AI 互打的强度"不是一回事。
   * ⚠ 上线档的大雷/摄魂注入**在这些数里**（`BIGT_PUSH=12` ‖ `DRAIN_PUSH=1`，走的是页面同一份 chooser）⇒ 别把 note 再当成"裸包"的读数。
   * ⚠ 剂量还会改**局长**：简单档 5 人桌平均 45.1 回合、普通档 16.8 ⇒ "看得见的节奏"也是难度的一部分。 */
  /* ===== v1.6.63（§E590）：档位多了一根 `pool` —— 冠军池按档取成员 =====
   * 契约在 `docs/POOL-CONTRACT.md` §3：**难度与池是两根正交的轴** —— `pool` 决定"从哪一档的池里逐席抽一枚"，
   *   而 `eps/epsK/epsMode/ramp` 仍是"抽到的那枚上面叠多少探索剂量"。
   * ⚠ 这不是把"难度"换个写法：以前"困难"只能靠 ε=0 在同一枚包上做文章，现在它同时意味着"桌上是困难那一带的成员"。
   *   ⇒ `D227` 的④（档位两两分得开）在池形态下的语义已按用户 10-11 裁定改成"在册账"（见 `tools/diff-ladder-claims.mjs`）。
   * ⚠ `kind:'style'` 的档不带 `pool`（脚本整桌上桌，本来就没包可抽）—— 10-12 §E596 之后表里已经没有这种档了，
   *   原来的"极限 · 读招"回到了下拉第二组「风格」。 */
  /* ===== §E596（10-12 用户裁定）：五档并成三档 —— 「档位不许有同名不同义的格子」 =====
   * 为什么合并（实测，不是观感）：`bb0ca22` 把池收成两带之后，"简单/入门/普通"三档**共用同一个带**、只差探索剂量，
   *   而 10-12 的隔离实验证明"同一个带里改剂量量不出台阶"（入门 vs 普通 1.3~2.1pt，那 2.1pt 还是**反号**的）
   *   ⇒ 五档里只剩三种可分辨的状态，另外两种是同一个东西写了两遍。用户原话：「不需要 5 个难度了，合并成 3 个吧」。
   * 合并之后每一档 = **一个带 × 一组剂量**，带按"这一组人凑到桌上的实测强度"切（不是按逐枚强度排），
   *   切法与读数在 `docs/research/logs/2026-10-12-e596-three-tier.md`；三档的档级读数（1500 局/格 · 人类席夺冠率 · 越高=这档越软）：
   *     简单 19.4 ‖ 普通 16.3 ‖ 困难 13.5（multi）   简单 20.2 ‖ 普通 19.0 ‖ 困难 10.3（long，17:10 重测）
   *   相邻档差：困难↔普通 4.27±1.26pt（3.4σ）‖ 7.80±1.27pt（6.1σ）⇒ **两模式都分得开，这才是"档"**。
   * ⚠ 被并掉的两个名字的机制去哪了：
   *   · `入门`（ε=0.5/k5/soft）—— 用户 10-12：「原本入门的脚本可以放到简单档位的池子里」⇒ 简单档拿到的是**更大的带**
   *     （§E596 当时 7 枚，比原入门那 5 枚更宽 —— 10-12 夜名册 20→27 之后低档是 **11 枚**）+ ε=1/uniform 那个唯一量得出的大台阶；那个中间剂量（0.5）不再单独提供，
   *     因为实测它在同一带上量不出与 0.2 的区别（§E590 早已量过"soft 族从 ε=0 扫到 1 是平的"）。
   *   · `极限 · 读招`（脚本 `st:combocounter`）—— 它本来就是"整桌上桌的脚本"，不是冠军档；从难度表里摘掉之后
   *     它**自动回到下拉第二组"风格"里**（`ui.js:syncDiffOptions` 用 `claimed` 去重，表里不再占格），玩家一点没丢东西。
   *     实测它与最强的冠军档本来也分不开（9.5 对 8.9 ‖ 7.9 对 8.0，都在 1σ 内），把它当"最高难度"是标签夸张。
   * ⚠ `lv:hunter` 那种 `kind:'style'` 的档现在表里没有了 ⇒ 若哪天要放回来，必须连 `D227`①a 的下限一起重议（那条腿刚按裁定改成 ≥3）。 */
  /* ⚠ §E596 下半场（用户 10-12 15:2x：「现在又有强度差别了就不用非得搞 ε 差异了，统一成 0→0.1→0.2」）：
   *   三档的**五人桌剂量统一成默认那条 ramp 口径** ⇒ 难度只剩"桌上是哪一带"这一根轴（实测见下面的 note 与在册账）。
   *   为什么 2 人桌仍留 `eps2` 这一根**独立**的轴：池按 §E286 不上 2 人桌（3P 那颗在 1v1 是分布外的），
   *   所以 2 人桌上三档用的是同一颗包 —— 如果剂量也统一，2 人桌的"简单/普通/困难就**逐字节是同一档**"，
   *   那不是简化而是把下拉变成三个假选项。⇒ `eps2` 只管 2 人桌（`ui.js` 那一行），五人桌读的是 `ramp/eps`。
   *   ⚠ 代价要说明白：并掉 ε 之后**最简单档变硬了** —— 统一剂量下 soft 带实测人类席夺冠 19.0%(multi) ‖ 20.6%(long)，
   *   而原来那一档（ε=1/uniform）是 61.9% ‖ 71.5%。想要"真简单"的杠杆只剩两个：给 soft 带添更弱的成员，
   *   或单独给简单档留一点 ε（`eps2` 之外再加一个 `epsEasy` 之类，那是下一次裁定）。 */
  const DIFF_TIERS = [
    { id: 'lv:sparring', name: '简单 · 陪练', kind: 'champ', eps: 0.2, epsK: 5, epsMode: 'soft', ramp: false, pool: 'soft', eps2: 0.5,
      /* §E600-B（用户 10-13 裁定：「把启发式随机脚本塞到弱池子里面，能用更多低性价比的技能…
       *   反正这些技能进不了高强度的包」）⇒ 这一档的装配 = 池的 soft 带 **加 k 席脚本**。
       *   · seats = 想掺几席；min = 至少留几席**包**（2P 只有 1 席 AI ⇒ 掺不动，会走"降级要说话"那条）
       *   · ids 必须是 `STYLES` 里真有的 id（门 D227①f 钉这一条，点了选不出来的风格 = 假档）
       *   · 掺**谁**买的是"可玩性"这一侧，不是难度（用户 10-15 04:0x 原话：「掺脚本席又不是非得降低难度，重要的是提高可玩性，
       *     在低级场能见到更多技能，所以就掺之前搞的那个杂货铺就好了」⇒ 当时落成 **2×`st:toolkit`**）。
        *   ★ **10-15 12:0x 用户更正了主语**：要的是「**1 席杂货铺 + 1 席每手随机挑人格线的 `st:mix`**」= §E600-B 的**原装配**（10-13 那一版）
        *     ⇒ 本行 `ids` 改回 `['st:toolkit','st:mix']`。依据是 12:4x 量的**四臂表**（§E627：8 seed × 门 ④d 那行命令 1200 局 + 普查 1440 场/臂/模式）：
        *     A 现状 2×铺 首末差 **2.04±0.57pt（8 跑只 3 跑过线）** ‖ B 只 1×铺 4.22±0.38（8/8）‖
        *     **C 铺+型 3.75±0.64（6/8），而门默认 seed 单跑 5.58pt ⇒ ④d 会绿** ‖ D 2×型 4.13±0.42（7/8）。
        *     ⇒ C 是四臂里**唯一"既让 ④d 翻绿、又还留着一只有意图形状（六条计划线 + 攒钱经济）"**的那只；代价是每局种类比 A 少 0.8 种（multi 9.9 vs 10.7）。
        *   · ⚠ 一条**用法更正**（§E627，比上面那句更重要）：**不许再用"并集种类"当宽度的证据** ——
        *     `st:mix` 那个"23 种"是**跑够多局才凑得出来的并集**；它是**每手**在 6 条人格线里随机挑一条（`bots.js:308-311`），
        *     而 6 条里有 5 条本身很窄（如 `breakDef` 86% 按ジ）⇒ **一桌看下去 mix 反而是最窄的那只**（每局 7.9 种 vs 杂货铺 10.7）。
        *     判宽度一律用普查的 `perGameKinds`（逐局、含ジ/不含ジ两栏），并连 n 一起引（`distinct` 是样本数的函数：
        *     toolkit 20 局 18 ‖ 30 局 21 ‖ 40 局 23 ‖ 60 局 24）；`st:breakdef` 在任何 n 下都只出 **1 种**。
       *     当初选它有实测依据（`docs/debug/breadth-probe.mjs`）：理由是**广度**。§E612 在同一个 n=30 上重测到
       *     `toolkit` **21 种**（10-13 给它加的计划层让出手面变宽了）‖ `mix` 23 种（在 23 处**饱和**）；
       *     而 `distinct 出手种类` 本身是**样本数的函数**（toolkit 20 局 18 ‖ 30 局 21 ‖ 40 局 23 ‖ 60 局 24）
       *     ⇒ 引用广度必须连 n 一起引，不带 n 的"几种"没有所指。弱档缺的正是这个广度，不是又一种墙。
       *     对照：`st:breakdef` 在任何 n 下都只出 **1 种**（§E612 因此改了选项①的内部排序，见日志 DONE-13）。
       *   · ⚠ §E627 的读数与残余风险：C 落地之后 long 侧台阶一仍站不住（**+0.75±0.48 = 1.5σ ⇒ 分不开，但不再翻序**），而
       *     门 D227④d 的**默认 seed 那跑重新绿**（实测 5.58pt ≥ 地板 3pt）—— 但那条腿是**单发抽签**，C 的 8 发里有两发只 0.67 / 1.33pt ⇒ **误红率约 1/4**，地板（3pt）与判词**一个字没动**（动它才是喂字符串）。 */
      /* ⚠ 两条结构 cap（都留着，别被"简化"掉）—— ① `ids` 长度封顶：`pool-draw.js:scriptSeats` 的返回是 `seats: Math.min(k, ids.length)`
       *   ⇒ **`ids` 的长度会静默给席数封顶**（用户 10-15 裁"只掺杂货铺"之后，如果只写一个 id，`seats: 2` 实际只掺 1 席 ——
       *   这条是普查量具打印"掺脚本席 1 席"时被抓到的，不是推出来的）。
       *   ② 同一个函数里 `k = min(seats, aiSeats − min)` ⇒ **3 人桌只有 2 个 AI 席、`min=1` ⇒ 永远只落得下 1 席，且领 `sids[0]`**
        *     ⇒ 实测 A/B/C 三臂在 n=3 上**逐字相同**（简单 29 ‖ 普通 23 ‖ 困难 24），只有 D（`sids[0]='st:mix'`）不同（26.5）
        *     ⇒ **"少掺一席"与"把第二席换成 mix"在 3 人桌上什么都不改变**（§E627）。
        *   要不要把①②改成显式声明（`seats: k` 允许同风格占多席 ‖ n=3 也按声明掺两席）属另一笔：它会同时动页面标签、量具表头与门 D234 的口径。 */
      scriptMix: { seats: 2, min: 1, ids: ['st:toolkit', 'st:mix'] },
      note: '桌上是**最弱那一批**（16 枚 —— 按 `champion-map/pool-members.tsv` 的 soft 带**现数**；§E596 那一版是 7 枚，10-12 夜名册 20→27 时低档补到 11 枚，**§E609 拆带又把 5 枚原中带成员并进来 ⇒ 16 枚**），探索比默认档多一档（ε=0.2/k5/soft；用户 10-12 16:4x 定「简单 0.2 ‖ 普通与困难 0.1」）。'
        + '⚠ §E610 更正了这档的读数口径：本档装配 = **2 席软带冠军 + 2 席脚本**（`scriptMix` 声明的两席都是 `st:toolkit`，10-15 裁定），'
        + '而 10-15 之前那两批阶梯量具**没读这一层**（把 `compose` 的掺席参数硬写成空）⇒ 那批的"简单档"其实是四席全池包。按现状装配重测（§E622 · 8 seed×1000 逐局配对，`docs/artifacts/e608-out/recheck-mix2-summary.txt`）：'
        + '**人类席夺冠 16.51%（multi）‖ 15.01%（long）**（"完全不掺席"的对照臂是 17.66 ‖ 20.27 ⇒ long 侧那 **5.3pt** 的差就是这两席脚本买来的，见下）。'
        + '★ **台阶一：multi 过线、long 实测翻序** —— multi **+0.63 ±0.21pt = 2.93σ**（普通人赢 15.89 < 简单 16.51 ⇒ 这一档确实软）‖ long **−1.20 ±0.37pt = −3.23σ**（普通 16.21 > 简单 15.01 ⇒ 长局里这一档比默认档**还硬**）。'
        + '⚑ 首末两档同一批现减：multi 3.08pt ‖ long 1.50pt ⇒ **门 D227④d 现场腿红**（它自己那跑 1200 局 multi 量到 简单 16.42 ‖ 困难 13.75 = 差 2.67pt，地板 3pt）—— 这是裁定的直接代价，**地板没动、也没喂字符串**，等裁 #29。'
        + '⚑ 而且这条红**不是运气**（§E623 换一整组新种子 78000..78007，同一条命令行 × 8 跑）：首末差 **multi 2.04 ±0.57pt ‖ long 1.78 ±0.56pt**，8 跑里只有 3 跑（long 只 2 跑）过 3pt ⇒ 分布整体掉到了地板下面（底稿 `docs/artifacts/e608-out/e623-both-shapes.txt`）。'
        + '★ 全人数形状（§E623 补测完，日志 DONE-25）：**long 侧没有任何一个人数把"简单"买软** —— n=3 分不开（−0.73 ±0.75 = −0.97σ）‖ n=4 实测翻序（−3.32 ±0.55 = **−6.09σ**）‖ n=5 翻序（−1.20 ±0.37 = −3.23σ）；'
        + 'multi 侧只有 n=3 站得稳（+3.46 ±0.51 = **6.79σ**），n=4 分不开（+0.76 ±0.76 = 1.01σ），n=5 勉强过线（2.93σ）。'
        + '⚠ 两条构造级的说明：① 3 人桌只掺 **1 席**，而 `compose` 取的是 `sids[z % sids.length]`（`js/pool-draw.js:107`）⇒ n=3 那一格**新旧装配逐字相同**（第一席一直是杂货铺），所以 v1.7.28 那句"n=3 翻序"同时也描述现状、不必撤回；'
        + '② 把第二席从 `st:mix` 换成 `st:toolkit` 让 n=4 的简单档在 long 上从 19.99 掉到 **18.16**（翻序从 −1.89σ 加深到 −6.09σ）⇒ 与单席表方向互咬（long 单席：`toolkit` −3.23σ ‖ `mix` +8.30σ ⇒ `toolkit` 是这两只里**更硬**的那只）。'
        + '⚑ 一条**用法**边界（§E623，写给引用这些 σ 的人）：换一组种子实测到跨批漂移 **~1pt**（连不掺席的困难档都能差 0.96pt）⇒ 凡幅度 <1pt 的那几行（multi 台阶一就是）是**批条件读数**，不许当稳态声称；只有方向（long 翻序）在两批都现。'
        + '原因不是样本量：**那两席脚本在 long 模式下比软带冠军还强**（`st:toolkit` 当初按"出手种类多"选的，没按 long 的强度筛过）⇒ 盖掉两席软带反而把桌子抬硬了。'
        + '★ 这一档买到的东西现数在（§E622 · `docs/debug/tier-census.mjs --tiers=lv:sparring --games=80 --seeds=90210..90215 --protos=6 --mode=long`，2880 场）：'
        + '出手**种类 30**（卡表 30 张里这一档一次都没出现的 **0** 张）‖ 前 3 占 67.3% ‖ G=exp(H)=6.84 ‖ 防御类 16.3% ‖ 脚本席占出手 48.7% ‖ 局长 30.9 回合 ‖ 402 种不同四席组成、四席全同 0 局、漏席 0 次。'
        + '⚠ 由此**再撤一次**：v1.7.22 那句"旧账 long 只有 0.6σ 是样本量不够、重测 10.40σ"里的 10.40σ 不成立（那批同样不含掺席）——'
        + '旧结论"long 侧简单↔普通分不开"在忠实装配上**重新成立**，只是理由从"测不准"换成了"装配本身就分不开"，而现状装配上更进一步：**不是分不开，是方向反了**。'
        + '⚠ 为什么只有这一档没跟着"三档剂量统一"：**完全统一时 long 模式"简单↔普通"只差 2.40±1.47 = 1.6σ**（那是**旧带 + 无掺席**下测的，两个条件现在都不成立了，这条理由只剩在册价值），按裁定甲不许声称分得开 ⇒ 那个模式下"三档"只剩两级；'
        + '⚑ 备选实测：这一档给 ε=0.5 时四步全过 2σ（简单↔普通 4.67±1.38 = 3.4σ ‖ 3.73±1.46 = 2.6σ，16:18~16:20 那批）—— '
        + '换到 ε=0.2 是为了让"简单"别软得太假（0.5 时人类席夺冠 20.1/21.9）。'
        + '要"真简单"现在有**三条**杠杆：① 这一档单留大 ε；② 往 soft 带补更弱的成员（10-12 查过：低 Hp 段"体检 pass 且在 git 里"的候选只剩 2 枚，'
        + '56 枚过线包从没补过上槽体检 ‖ 71 枚被体检判 block ⇒ 那是欠账，不是再挑挑就有）；'
        + '③ ~~换掺进来的那两席脚本 / 少掺一席~~ —— **这一条 10-15 已经裁掉了**（裁定：掺席买可玩性、不买难度 ⇒ 两席归杂货铺）。'
        + '于是在 long 侧想把软度买回来只剩 ① 与 ②；再动这两席就等于把那句裁定反过来读，属**新裁定**，不是量具能自己定的。'
        + '2 人桌读 `eps2: 0.5` —— ⚠ 那里**按裁定也有池**（§E599 的 2P 原生那份），只是只有 1 席 AI ⇒ `scriptSeats` 要留 `min=1` 席包 ⇒ **掺不动脚本**（`seats=0`，标签会说出来），那一档在 2 人桌上真的只剩剂量这根轴。'
        + '⛔ 但 **§E613 查明、v1.7.29 才修好**：从 §E599 一直到昨晚，页面上 2 人桌的池**从未真的生效过**（`loadPoolOf` 把"首屏那次取不到全局"粘成永久 `no-bundle`；真页面读出来是"2P 池 bundle 未加载 ⇒ 退回单包"）⇒ 那段时间玩家遇到的 2 人桌 = 那一枚内置 2P 冠军 + 剂量。**v1.7.29 起走池了**（修法 B，日志 DONE-14/15/22），今晚之前所有关于 2P 池的读数都要按这个分界重读。' },
    { id: 'lv:regular', name: '普通（默认）', kind: 'champ', eps: 0.1, epsK: 5, epsMode: 'soft', ramp: true, pool: 'mid',
      /* §E609（用户 10-15 裁定：「那就这么调电平吧」⇒ p≈0.5 两带混抽落地）：3P 池**已经拆带**（mid 清空 ⇒ hard 11 ‖ soft 16），
       *   所以这一档不再是"抽 mid 那 7 枚"，而是**逐席按 0.5/0.5 掷带、带内均匀取枚**。
       *   实现只有一份：`js/pool-draw.js` 的 `rosterFor` + `compose(..., bandW)` ⇒ 页面与量具跑同一条抽签（规矩 134 那一族）。
       *   · `else: 'mid'` 是给**还没拆带的池表**留的退路：2P 那张（hard 2 ‖ mid 3 ‖ soft 2）的 Hp 不是 3P 这把考卷量的，
       *     48.9 那条界对它没有意义 ⇒ 坐 2 人桌时整档退回按 mid 抽，并把这件事用 `bandNote` 说出来（契约 §4：降级不许静默）。
       *   · `pool: 'mid'` 保留两职：这条退路的带名 + "这一档要接池层"的开关（`ui.js` 判 `tier.pool` 非空才走池）。
       *   ⚠ 规则为什么看"表拆没拆带"而不是看桌数：钉在 n>2 上就把因果写错了 —— 条件是证据，不是人数。 */
      poolMix: { hard: 0.5, soft: 0.5, else: 'mid' },
      note: '★ 默认档 = v1.5.141 以来页面一直在跑的那条口径（前 3 回合的斜坡 0→0.05→0.1 —— 顶点按用户 10-12 16:4x 裁定从 0.2 降到 0.1，形状现在只有一份：`tierEps`）。10-12 18:1x 池装配实测人类席夺冠 16.1 ‖ 19.4%'
        + '。§E609 拆带之后桌上是**两带各半混抽**（hard 11 ‖ soft 16，每席 0.5/0.5）：同一对档位表用配对阶梯重测（8 seed×1000 局 ‖ 三档同次逐局配对）'
        + '量到普通档人类席夺冠 multi **15.89%** ‖ long **16.21%**（拆之前按同口径——8 seed×1000 逐局配对——测的现表臂是 17.01% ‖ 18.54%，10-13 那批；'
        + '10-13 用"重复铺行"预告拆带后是 15.81 ‖ 16.13 —— 与落地各差 0.08pt，而这批 8 个 seed 自己的电平 SE 是 ±0.13 ‖ ±0.21 ⇒ 在 SE 内，'
        + '"按带加权"与"往名单里重复铺行"确实同分布）'
        + ' ⇒ **普通档会变硬**，这是把"普通"从中点偏简单（0.80pt ‖ 1.76pt）挪回算术中点的必然代价（用户 10-15 认了这个电平）。' },
    { id: 'lv:hard', name: '困难 · 冠军', kind: 'champ', eps: 0.1, epsK: 5, epsMode: 'soft', ramp: true, pool: 'hard', eps2: 0,
      note: '冠军本体，而且桌上是**最强那一批**（枚数按 `champion-map/pool-members.tsv` 的 hard 带**现数** —— 2026-10-21 = 13 枚，10-18 22:45 `v7beadseed-82` 入硬带；沿革：§E596 那一版是 7 枚，10-12 夜名册 20→27 时 K2/SHIPPED-Ldemo 进困难带，**§E609 拆带又把 Hp ≥48.9 的 `G15-71` ‖ `v7cmin3-93` 两枚升进来 ⇒ 11 枚；**10-16 用户裁定 G12H1 入池（hard 带）⇒ 12 枚**），按"凑到一桌的实测强度"选，不是按逐枚分数排）。剂量与"普通"逐字相同 ⇒ '
        + '这一档的强度**全部来自带**（10-12 18:1x 重测：同剂量换带 long 差 9.33pt = 7.3σ，multi 只差 2.47pt = 当时判"分不开"；'
        + '而同带换剂量只值 0.5pt）。'
        + '⚠ **那句"multi 侧分不开"已被 §E609 撤掉**：同一对差重测到 8 个 seed（+2.46 ±0.29pt = **8.36σ**）⇒ 它是**样本量不够**，不是台阶不存在（在册账已换新）。'
        + '人类席夺冠 13.43%（multi）‖ 13.51%（long）（10-12 那批是 13.7 ‖ 10.1 —— long 侧那 3.4pt 的差是**旧带形状**给的，拆带后困难档本身没怎么动，动的是它下面那一档）。⚠ 2 人桌读 `eps2: 0`（每手取最优）—— **不是"那里没池"**：§E599 裁定那里走 2P 原生那份池（`pool-members-2p.tsv`，hard 2 ‖ mid 3 ‖ soft 2）；'
        + '★ 2 人桌现状三档台阶（**§E625 修正剂量后重测**，8 seed×1000 逐局配对）：困难 **13.71%（multi）‖ 14.99%（long）** ‖ 台阶二 +3.79 ±0.66 = 5.70σ ‖ +8.38 ±0.56 = 15.09σ（`docs/artifacts/e608-out/s27-2p-refit.txt`）。'
        + '⛔ **§E609/§E622 那两批 2P 读数（multi 3.98σ ‖ 2.87σ ‖ long 8.39σ ‖ 14.22σ）已作废**：那时两把量具都**不读 `eps2`**（简单喂 0.2 而不是 0.5 ‖ 困难喂 0.1 而不是 0）⇒ 量的不是产品那张桌；'
        + '同一族病 10-12 已犯过一次（斜坡字面值两份，D153 就是为它写的），这次漂的是**人数**那一维 ⇒ 修法是一处定义三处调用（`bots.js:tierEpsAt`），D153 的钉法跟着搬。'
        + '⚠ 另外 **v1.7.29 之前**页面上 2 人桌的池从未真的生效（负状态被粘住 ⇒ 真页面退回那一枚内置 2P 冠军），那之前的玩家遇到的仍是单包（日志 DONE-14/22）。' },
    /* `lv:hunter`（极限 · 读招）§E596 从难度表里摘掉：它本来就是"整桌上桌的脚本"而不是冠军档，
     *   且实测与最强冠军档分不开（9.5 对 8.9 ‖ 7.9 对 8.0，都在 1σ 内）。摘掉后 `st:combocounter`
     *   自动回到下拉第二组"风格"里（`ui.js:syncDiffOptions` 的 `claimed` 去重），玩家没有失去任何东西。 */
  ];
  const DIFF_DEFAULT = 'lv:regular';

  /* §E596（10-12 晚）：**档 → 这一手该用的 ε** 只写这一遍。
   *   为什么要搬进来：斜坡形状原来在 `ui.js` 与 `tools/probe-diff-ladder.mjs` 各有一份，
   *   下午把顶点从 0.2 降到 0.1 时只改到了页面那一份 ⇒ 量具那份还停在 0/0.1/0.1，
   *   于是"在册的那套阶梯读数"量的是一种**产品里不存在**的剂量（round 2 多一倍）。
   *   `ramp` 档 = 第 1 回合 0、第 2 回合 0.05、第 3 回合起取该档的 `eps`；非 ramp 档 = 常数 `eps`。
   *   消费者三处：`ui.js`（产品）‖ `tools/probe-diff-ladder.mjs`（阶梯尺）‖ `tools/eval-5p.mjs --eps-tier=`（图上头号尺 Hp）。 */
  function tierEps(tier, round) {
    if (!tier || !(tier.eps > 0)) return 0;
    if (!tier.ramp) return tier.eps;
    return round <= 1 ? 0 : (round === 2 ? 0.05 : tier.eps);
  }
  /* §E625（10-15 早）：**"几个人才用 `eps2`"这条规则也只写这一遍**。
   *   以前它只活在 `ui.js:716` 那一行的三元里（注释还写着"这是页面才知道的事"），而两把量具
   *   （`probe-diff-ladder` 与 `tier-census`）**各自直接读 `tier.eps`** ⇒ 它们在 2 人桌上量的是
   *   产品不喂的那份剂量（简单 0.2 而不是 0.5 ‖ 困难 0.1 而不是 0）。§E622 那批 2 人桌读数就是这么来的（已重测并更正，见日志 DONE-27）。
   *   ⇒ 这正是 10-12 那次"斜坡字面值两份、量具那份漂了"的**同一族**，只是这次漂的是人数那维。
   *   ⚠ `nPlayers > 2` 时逐字等于 `tierEps(tier, round)` ⇒ 所有在册的 5 人桌读数不受影响（回归实测在 DONE-27）。 */
  function tierEpsAt(tier, nPlayers, round) {
    if (nPlayers <= 2 && tier && typeof tier.eps2 === 'number') return tier.eps2;
    return tierEps(tier, round);
  }

  /* v1.6.6 删除 `DIFFICULTY`（2 人那三档 简单/中等/困难）：页面的 2 人分支已并进 `DIFF_TIERS`，
   * 全库再无消费者（实测：只剩 ui.js 那一行 `Bots.DIFFICULTY.easy.pick`）。旧档名"简单/普通"按用户裁定不再保留。 */

  global.EpirusBots = {
    pickRandom, pickAggro, pickDefend, pickBalanced, pickAntiDef, pickBreakDef, pickAdaptive, pickWall, pickReflectSpam, pickGuardSpam, pickBaguaSpam, pickComboCounter, pickFarmer, pickMix,
    pickTankLine, pickHeavyFire, pickGuardGun, pickProtoWall, pickWhiff,
    pickReflectMix, pickReflectTank, pickDefReflectGun, pickToolKit, STYLES, DIFF_TIERS, DIFF_DEFAULT, tierEps, tierEpsAt, resetBotMem,
    snapshotBotMem, restoreBotMem,
    pickMultiEasy, pickMultiMed, pickMultiStrong, pickProtoMine, pickProtoTransfer, pickFocusFire, pickDeepSaver,
    pickMineSpam, pickCurseStorm, pickRingSpam, pickTargeter, pickSnipeSpam, pickGunSpam, pickBeadBurst,
    pickGunFocus, pickAimDefender, pickBigTFocus, pickBigTRandom, pickBigTChain, bigtHubTarget, pickKillSecure,
    pickDeadlineBurst, pickEarlyPressure, getEconB, setEconB,
    BOT_RANDOM: 'random', BOT_AGGRO: 'aggro', BOT_DEFEND: 'defend', BOT_BALANCED: 'balanced',
    BOT_ANTIDEF: 'antidef', BOT_BREAKDEF: 'breakdef', BOT_ADAPTIVE: 'adaptive', BOT_WALL: 'wall',
    BOT_REFLECTSPAM: 'reflectspam', BOT_GUARDSPAM: 'guardspam', BOT_BAGUASPAM: 'baguaspam', BOT_COMBOTCOUNTER: 'combocounter', BOT_MIX: 'mix'
  };
})(typeof window !== 'undefined' ? window : globalThis);
