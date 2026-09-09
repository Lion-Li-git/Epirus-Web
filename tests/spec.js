/* Epirus 引擎场景自测 —— 与 docs/RULES-2P.md 裁定逐条对应 */
(function () {
  'use strict';
  const R = window.EpirusRules, SK = R.SK;
  const S = window.EpirusState, X = window.EpirusResolve;

  /* ---------- 工具 ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 判定序列 rng：按序返回给定值，耗尽后返回 0.9（判定必败）
  function seqRng(vals) {
    let i = 0;
    return { next: function () { return i < vals.length ? vals[i++] : 0.9; } };
  }

  function game(mode, rng, hp0, hp1) {
    const st = S.createState(mode || 'standard', rng || { next: Math.random });
    if (hp0 !== undefined) st.p[0].hp = hp0;
    if (hp1 !== undefined) st.p[1].hp = hp1;
    return st;
  }
  function gv(st, pid, f) { return st.p[pid][f]; }
  function setEp(st, a, b) { st.p[0].ep = a; st.p[1].ep = b; }
  function play(st, k0, k1, o0, o1) {
    st.events = [];
    X.startTurn(st);
    if (st.over) return st.events;
    S.attemptAction(st, 0, k0, o0);
    S.attemptAction(st, 1, k1, o1);
    X.resolveActions(st);
    X.endTurn(st);
    return st.events;
  }
  // 直接设好动作（跳过花费，便于构造状态）
  function playRaw(st, k0, k1) {
    st.events = [];
    X.startTurn(st);
    if (st.over) return st.events;
    st.actions = [
      { key: k0, voided: false, outcome: 'ok', opt: null },
      { key: k1, voided: false, outcome: 'ok', opt: null }
    ];
    X.resolveActions(st);
    X.endTurn(st);
    return st.events;
  }

  const results = [];
  function t(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, err: e && e.stack || String(e) }); }
  }
  function eq(actual, expected, msg) {
    if (actual !== expected) throw new Error((msg || '') + ' 期望=' + expected + ' 实际=' + actual);
  }
  function ok(cond, msg) { if (!cond) throw new Error(msg || 'assert failed'); }

  /* ============ 用例 ============ */
  t('R5 资源不足：大雷缺5ジ → 无法发动、不扣血', function () {
    const st = game(); setEp(st, 0, 0); st.p[0].hp = 3;
    const evs = play(st, SK.BIG_T, SK.JI);
    eq(st.p[0].hp, 3, '不扣血（无贷款）');
    eq(st.actions[0].outcome, 'insufficient');
    ok(st.actions[0].voided, '技能未发动');
    eq(st.p[1].hp, 3, '大雷未生效');
  });

  t('R5b 资源不足：1ジ技能(枪)缺ジ → 无法发动、不扣血', function () {
    const st = game(); setEp(st, 0, 0); st.p[0].hp = 3;
    const evs = play(st, SK.GUN, SK.JI);   // 枪 = 1ジ
    eq(st.p[0].hp, 3, '不扣血');
    eq(st.actions[0].outcome, 'insufficient');
    ok(st.actions[0].voided, '技能未发动');
  });

  t('R5c 资源不足：电磁炮无电珠 → 无法发动', function () {
    const st = game(); setEp(st, 9, 9); st.p[0].hp = 3; st.p[0].elec = 0;
    play(st, SK.RAILGUN, SK.JI);
    ok(st.actions[0].voided, '电磁炮未发动（缺电珠）');
  });

  t('R3 同优先级攻击相抵：双枪', function () {
    const st = game(); setEp(st, 5, 5); st.p[0].hp = st.p[1].hp = 3;
    play(st, SK.GUN, SK.GUN);
    eq(st.p[0].hp, 3); eq(st.p[1].hp, 3);
  });

  t('R3 高优先级阻止低：电磁炮(3) vs 枪(2)', function () {
    const st = game(); setEp(st, 5, 5); st.p[0].elec = 1;
    play(st, SK.RAILGUN, SK.GUN);
    eq(st.p[1].hp, 1, '电磁炮2伤命中');   // 3-2
    eq(st.p[0].hp, 3, '枪被阻止');
  });

  t('R15 防御挡枪', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.GUN, SK.GUARD);
    eq(st.p[1].hp, 3);
  });

  t('R15 坦克破防御', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.TANK, SK.GUARD);
    eq(st.p[1].hp, 2);
  });

  t('R15 反弹反射枪', function () {
    const st = game(); setEp(st, 5, 5); st.p[0].hp = st.p[1].hp = 3;
    play(st, SK.GUN, SK.REFLECT);
    eq(st.p[1].hp, 3, '反弹者无事');
    eq(st.p[0].hp, 2, '枪手自食其果');
  });

  t('R15 激光剑攻破反弹', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.SWORD, SK.REFLECT);
    eq(st.p[1].hp, 2, '反弹被破');
    eq(st.p[0].hp, 3, '激光剑不受反弹');
  });

  t('R15 八卦阵判定胜挡伤/败受伤', function () {
    const win = game('standard', seqRng([0.1])); setEp(win, 5, 0);
    play(win, SK.GUN, SK.BAGUA);
    eq(win.p[1].hp, 3, '判定胜挡');
    const lose = game('standard', seqRng([0.9])); setEp(lose, 5, 0);
    play(lose, SK.GUN, SK.BAGUA);
    eq(lose.p[1].hp, 2, '判定败受伤');
  });

  t('R27 小雷无效化枪；对防御免疫', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.MINI_T, SK.GUN);
    eq(st.p[1].hp, 3, '枪被小雷废掉');
    const st2 = game(); setEp(st2, 5, 5);
    play(st2, SK.MINI_T, SK.GUARD);
    eq(st2.p[1].hp, 3);
  });

  t('R27 互雷成环：双方无效', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.MINI_T, SK.MINI_T);
    eq(st.p[0].hp, 3); eq(st.p[1].hp, 3);
    ok(st.events.some(e => e.type === 'thunderRing'));
  });

  t('R28/29 大雷：2伤+只禁目标当回合用的技能；防御可全挡', function () {
    const st = game(); setEp(st, 5, 1);
    play(st, SK.BIG_T, SK.GUN);          // P1 用枪 → 枪被禁用
    eq(st.p[1].hp, 1, '2电');
    ok((st.p[1].cooldown[SK.GUN] || 0) === 3, '枪禁用（目标当回合用的技能）');
    eq(st.p[1].cooldown[SK.TANK], undefined, '其它技能不受影响');
    eq(st.p[1].cooldown[SK.JI], undefined, 'ジ豁免');
    const st2 = game(); setEp(st2, 5, 1);
    play(st2, SK.BIG_T, SK.GUARD);
    eq(st2.p[1].hp, 3, '防御全挡');
    eq(st2.p[1].cooldown[SK.GUN], undefined, '被挡无禁用');
  });

  t("R23' 大雷 vs 原型制御：2电被挡但禁用目标用的原型制御仍生效", function () {
    const st = game(); setEp(st, 5, 1);
    play(st, SK.BIG_T, SK.PROTO);
    eq(st.p[1].hp, 3, '原型制御挡住2电');
    ok((st.p[1].cooldown[SK.PROTO] || 0) > 0, '原型制御被禁用（目标当回合用的技能）');
    eq(st.p[1].cooldown[SK.GUN], undefined, '枪不受影响');
  });

  t('R38 地雷：受枪击反击1火；双雷链上限2', function () {
    const st = game(); setEp(st, 5, 0);
    st.p[1].mineArmed = true;
    play(st, SK.GUN, SK.JI);
    eq(st.p[1].hp, 2, '枪命中');
    eq(st.p[0].hp, 2, '地雷反击1');
    ok(!st.p[1].mineArmed, '雷已失效');
    const st2 = game(); setEp(st2, 5, 0);
    st.p[1].mineArmed = true; st.p[0].mineArmed = true;
    st2.p[1].mineArmed = true; st2.p[0].mineArmed = true;
    play(st2, SK.GUN, SK.JI);
    eq(st2.p[0].hp, 2, '枪手: 3-1(你的雷反击)');           // 第1次触发
    eq(st2.p[1].hp, 1, '埋雷者: 3-1(枪)-1(枪手的雷链)');   // 第2次触发上限
  });

  t('R13/57 狙击：被攻击干扰而废；对ジ爆头判定', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.SNIPE, SK.GUN);
    eq(st.p[0].hp, 2, '枪反打狙手');
    eq(st.p[1].hp, 3, '狙击被干扰无效');
    const st2 = game('standard', seqRng([0.9, 0.9, 0.9])); setEp(st2, 5, 0);
    play(st2, SK.SNIPE, SK.JI);
    eq(st2.p[1].hp, 2, '狙中无爆头');
    const st3 = game('standard', seqRng([0.1, 0.1, 0.1])); setEp(st3, 5, 0);
    play(st3, SK.SNIPE, SK.JI);
    eq(st3.p[1].hp, 1, '三判定全胜=爆头');
  });

  t('R25/26 摄魂：限1血、命中自愈1', function () {
    const st = game(); setEp(st, 5, 0); st.p[0].hp = 1;
    play(st, SK.DRAIN, SK.JI);
    eq(st.p[0].hp, 2, '自愈');
    eq(st.p[1].hp, 2, '1伤');
    const st2 = game(); setEp(st2, 5, 0); st2.p[0].hp = 2;
    const r = S.attemptAction(st2, 0, SK.DRAIN);
    eq(r.outcome, 'invalid', 'HP>1 不可用');
  });

  t('R45 互勾=铁索连环：双1血互勾后均存活且连环', function () {
    const st = game(); setEp(st, 5, 5); st.p[0].hp = st.p[1].hp = 1;
    play(st, SK.DRAIN, SK.DRAIN);
    ok(st.p[0].chainLink && st.p[1].chainLink, '连环成立');
    ok(st.p[0].hp > 0 && st.p[1].hp > 0, '均存活');
    ok(st.events.some(e => e.type === 'hidden' && e.name === '铁索连环'));
  });

  t('R44 净化：移除符咒并回血、清梦魇', function () {
    const st = game(); setEp(st, 5, 5);
    st.p[1].stickers = [{ owner: 0, age: 0 }, { owner: 0, age: 2 }];
    st.p[1].nightmare = true; st.p[1].hp = 3;
    play(st, SK.JI, SK.PURIFY);
    eq(st.p[1].stickers.length, 0);
    eq(st.p[1].hp, 3.5, '回合初梦魇-0.5 + n=2净化+1');
    ok(!st.p[1].nightmare);
  });

  t('R34 贴贴可被防御挡；无架势则贴上', function () {
    const st = game(); setEp(st, 5, 0);
    play(st, SK.CURSE, SK.GUARD);
    eq(st.p[1].stickers.length, 0, '被挡');
    const st2 = game(); setEp(st2, 5, 0);
    play(st2, SK.CURSE, SK.JI);
    eq(st2.p[1].stickers.length, 1, '贴上');
  });

  t('R36/37 天火引爆符咒（符咒仍存、原型制御可挡）', function () {
    const st = game(); setEp(st, 5, 0);
    st.p[1].stickers = [{ owner: 0, age: 0 }, { owner: 1, age: 0 }]; // 一枚属对手不算
    st.p[1].hp = 5;
    play(st, SK.FIRESTORM, SK.JI);
    eq(st.p[1].hp, 4, '只引爆自己的1枚');
    eq(st.p[1].stickers.length, 2, '符咒仍在');
    const st2 = game(); setEp(st2, 5, 5);
    st2.p[1].stickers = [{ owner: 0, age: 0 }];
    play(st2, SK.FIRESTORM, SK.PROTO);
    eq(st2.p[1].hp, 3, '原型制御挡天火');
  });

  t('R54 挑衅：不攻击则回合末-1；攻击则无事', function () {
    const st = game(); setEp(st, 0, 5);
    st.p[1].tauntActive = true;
    play(st, SK.JI, SK.GUN);
    eq(st.p[1].hp, 3, '用了枪不违约(受自己攻击?)'); // gun at 你——无防御 你-1
    eq(st.p[0].hp, 2, '枪命中你');
    const st2 = game(); setEp(st2, 0, 0); st2.p[1].tauntActive = true;
    play(st2, SK.JI, SK.JI);
    eq(st2.p[1].hp, 2, '未攻击违约-1');
  });

  t('R23 转移伤害拦截枪；坦克穿透', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.GUN, SK.TRANSFER);
    eq(st.p[1].hp, 3, '转移者无事');
    eq(st.p[0].hp, 2, '枪弹回自身');
    const st2 = game(); setEp(st2, 5, 5);
    play(st2, SK.TANK, SK.TRANSFER);
    eq(st2.p[1].hp, 2, '坦克破转移');
    eq(st2.p[0].hp, 3);
  });

  t('R60 双大雷互轰：均2伤、各禁用自己当回合用的大雷', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.BIG_T, SK.BIG_T);
    eq(st.p[0].hp, 1); eq(st.p[1].hp, 1);
    ok((st.p[0].cooldown[SK.BIG_T] || 0) > 0, 'P0 大雷被禁用');
    ok((st.p[1].cooldown[SK.BIG_T] || 0) > 0, 'P1 大雷被禁用');
  });

  t('R31 避雷针：情形A废雷反噬+回馈能量；情形B设守卫', function () {
    const st = game(); setEp(st, 4, 2);
    play(st, SK.ROD, SK.MINI_T);
    eq(st.p[1].hp, 2, '小雷使用者被反噬1');
    eq(st.p[0].ep, 2, '回馈小雷花费2'); // 4-4(rod cost)+2
    ok(st.actions[1].voided);
    const st2 = game(); setEp(st2, 4, 0);
    play(st2, SK.ROD, SK.JI);
    eq(st2.p[0].rodGuard, 3, '情形B守卫3回合');
  });

  t('R42/43 过载炮三阶段', function () {
    const st = game(); setEp(st, 5, 5);
    play(st, SK.CANNON, SK.JI);           // 阶段1: 目标-1
    eq(st.p[1].hp, 2);
    setEp(st, 5, 5); st.p[1].hp = 3;
    play(st, SK.CANNON, SK.JI);           // 阶段2: 目标-1
    eq(st.p[1].hp, 2); eq(st.p[0].ep, 0, '耗光ジ');
    setEp(st, 5, 5); st.p[1].hp = 3; st.p[1].ep = 5;
    play(st, SK.CANNON, SK.CHARGE);   // 阶段3: 目标-1+失ジ, 自损1（电脑蓄能避免同回合补ジ干扰断言）
    eq(st.p[1].hp, 2); eq(st.p[1].ep, 0);
    eq(st.p[0].hp, 2, '自损1');
    eq(st.p[0].ep, 0);
  });

  t('R52 快速模式防御连击上限', function () {
    const st = game('fast'); setEp(st, 0, 0);
    st.p[0].guardStreak = 2;
    const r = S.attemptAction(st, 0, SK.GUARD);
    eq(r.outcome, 'invalid', '第3次被拒');
    st.p[0].guardStreak = 1;
    const r2 = S.attemptAction(st, 0, SK.GUARD);
    eq(r2.outcome, 'ok', '第2次允许');
  });

  t('R10 聚能环连击收益', function () {
    const st = game(); setEp(st, 5, 0);
    play(st, SK.RING, SK.JI);
    eq(st.p[0].ep, 3, '首用 5-3+1');
    setEp(st, 0, 0);
    play(st, SK.RING, SK.JI);   // 连续第2次：花费0，+2
    eq(st.p[0].ep, 2, '2用(连续) +2');
    setEp(st, 0, 0);
    play(st, SK.RING, SK.JI);   // 第3次：+3
    eq(st.p[0].ep, 3, '3用 +3');
  });

  t('R32 激光眼连续使用免爆破珠', function () {
    const st = game(); setEp(st, 3, 0); st.p[0].boom = 1;
    play(st, SK.LASER_EYE, SK.JI);   // 首次 1ジ+1爆珠
    eq(st.p[1].hp, 2);
    eq(st.p[0].ep, 2);
    eq(st.p[0].boom, 0);
    eq(st.p[0].lastSkill, SK.LASER_EYE);
    setEp(st, 5, 0); st.p[0].boom = 0;
    play(st, SK.LASER_EYE, SK.JI);   // 连续 2ジ
    eq(st.p[1].hp, 1);
    eq(st.p[0].boom, 0, '无需爆珠');
  });

  t('R22 藤甲：自身反弹架势，对手被挂火弱(下回合火伤+1)', function () {
    const st = game(); setEp(st, 5, 5); st.p[0].hp = st.p[1].hp = 3;
    // 回合1：你穿藤甲(自身反弹架势)，对手枪击；反弹 + 给对手挂火弱
    play(st, SK.ARMOR, SK.GUN);
    eq(st.p[0].hp, 3, '藤甲反弹，你无事');
    eq(st.p[1].hp, 2, '枪被反弹');
    ok(st.p[1].fireWeakNext, '对手被挂火弱(下回合火伤+1)');
    // 回合2：对手火弱生效；你坦克(火)破防命中 → 伤害+1
    st.p[1].hp = 3; setEp(st, 5, 0);
    play(st, SK.TANK, SK.JI);
    eq(st.p[1].hp, 1, '火弱+1：坦克1+1=2伤');   // 3-2
    eq(st.p[0].hp, 3, '你无伤');
  });

  t('R22 藤甲火弱：天火(直扣血 rawDamage)也吃+1 & 地雷反击火弱+1', function () {
    // 天火路径：贴符咒 → 藤甲→对手火弱 → 天火引爆，直扣血应+1
    const st = game(); setEp(st, 9, 9); st.p[0].hp = st.p[1].hp = 3;
    play(st, SK.CURSE, SK.JI);            // 回合1：P0贴符咒
    play(st, SK.ARMOR, SK.JI);            // 回合2：P0穿藤甲→P1火弱；符咒age→2
    ok(st.p[1].fireWeakNext, '火弱就位');
    st.p[1].hp = 3; setEp(st, 9, 0);
    play(st, SK.FIRESTORM, SK.JI);        // 回合3：天火引爆，火弱+1
    eq(st.p[1].hp, 1, '天火1+1=2伤(直扣血也吃火弱)');

    // 地雷路径：攻击者持火弱引雷，地雷火伤+1
    const st2 = game(); setEp(st2, 9, 9); st2.p[0].hp = st2.p[1].hp = 3;
    st2.p[0].fireWeakNext = true;         // 下回合 P0 火弱
    st2.p[1].mineArmed = true;            // 直接预埋地雷
    st2.p[0].hp = 3; setEp(st2, 9, 0);
    play(st2, SK.GUN, SK.JI);             // P0 攻击引雷
    eq(st2.p[0].hp, 1, '地雷1+1=2伤(攻击者火弱)');
  });

  t('R48 回魂：挑衅当回合死亡→下回合复活1血无限能量→回合末即死', function () {
    const st = game(); setEp(st, 2, 1); st.p[0].hp = 1; st.p[1].hp = 1;
    // 回合1：你(1血)挑衅电脑；电脑枪击你
    X.startTurn(st);
    S.attemptAction(st, 0, SK.TAUNT);   // 花2ジ，不贷款
    S.attemptAction(st, 1, SK.GUN);
    X.resolveActions(st); X.endTurn(st);
    eq(st.p[0].hp, 0, '你被击倒');
    ok(st.p[0].reviveNext, '回魂触发(待复活)');
    eq(st.p[1].hp, 1, '电脑未死');
    // 回合2：电脑需满足挑衅（攻击），你复活
    X.startTurn(st);
    eq(st.p[0].hp, 1, '复活');
    ok(st.p[0].infiniteEnergy, '无限能量');
    st.p[1].ep = 1;   // 保证电脑能出枪
    S.attemptAction(st, 0, SK.JI);      // 免费
    eq(st.p[0].ep, 0, '免费出招');
    S.attemptAction(st, 1, SK.GUN);     // 满足挑衅，打你
    X.resolveActions(st); X.endTurn(st);
    eq(st.p[0].hp, 0, '复活回合结束即死');
    eq(st.p[1].hp, 1, '电脑存活');
    eq(st.winner, 1, '电脑胜');
  });

  t('R1 回合上限死局判定', function () {
    const st = game('standard', { next: function () { return 0.9; } });
    setEp(st, 99, 99);
    for (let i = 0; i < 200 && !st.over; i++) {
      X.startTurn(st);
      if (st.over) break;
      S.attemptAction(st, 0, SK.JI); S.attemptAction(st, 1, SK.JI);
      X.resolveActions(st); X.endTurn(st);
    }
    ok(st.over, '上限触发');
    eq(st.winner, 'draw', '平局');
  });

  /* 模糊：随机对局 500 场不得崩溃/死循环 */
  t('Fuzz 500 随机对局无异常', function () {
    const rnd = mulberry32(42);
    for (let g = 0; g < 500; g++) {
      const st = game('standard', { next: rnd });
      setEp(st, 0, 0);
      let guard = 0;
      for (let i = 0; i < 60 && !st.over; i++) {
        X.startTurn(st);
        if (st.over) break;
        const pick = function (pid) {
          const p = st.p[pid];
          const avail = R.AVAILABLE_2P.filter(function (s) {
            if (!S.canUseSkillInMode(st, s.key)) return false;
            if (s.key === SK.DRAIN && p.hp > 1) return false;
            if (s.key === SK.RAILGUN && p.elec < 1) return false;
            if (s.key === SK.LASER_EYE && p.lastSkill !== SK.LASER_EYE && p.boom < 1) return false;
            return true;
          });
          const k = avail[Math.floor(rnd() * avail.length)].key;
          S.attemptAction(st, pid, k, { bead: rnd() < 0.5 ? 'elec' : 'boom' });
        };
        pick(0); pick(1);
        X.resolveActions(st); X.endTurn(st);
        if (++guard > 5000) throw new Error('疑似死循环');
      }
      ok(st.over, '对局应结束 #' + g);
    }
  });

  t("R9' 蓄能珠只供下一回合：回合末未使用即清空", function () {
    const st = game(); setEp(st, 5, 5);
    // R1 蓄能电珠 → 持有 1 枚
    play(st, SK.CHARGE, SK.JI, { bead: 'elec' }, null);
    eq(st.p[0].elec, 1, 'R1 蓄能后持有 1 电珠');
    // R2 不使用 → 回合末清空
    setEp(st, 5, 5);
    play(st, SK.JI, SK.JI);
    eq(st.p[0].elec, 0, 'R2 末未使用 → 电珠清空');
    // R3 再蓄能 → R4 电磁炮可用（证明「下一回合」确实可用）
    setEp(st, 5, 5);
    play(st, SK.CHARGE, SK.JI, { bead: 'elec' }, null);
    eq(st.p[0].elec, 1, 'R3 再蓄能');
    setEp(st, 5, 5);
    play(st, SK.RAILGUN, SK.JI);
    eq(st.actions[0].outcome, 'ok', 'R4 电磁炮成功发动');
    eq(st.p[0].elec, 0, 'R4 电磁炮消耗电珠');
  });

  t('R45 铁索连环：天火与爆头也共享伤害（文档口径）', function () {
    const st = game(); setEp(st, 5, 5);
    st.p[0].chainLink = st.p[1].chainLink = true;
    st.p[0].hp = 3; st.p[1].hp = 3;
    X.rawDamage(st, 1, 1, '天火', 'firestorm', { type: R.DMG.FIRE });
    eq(st.p[1].hp, 2, '天火命中目标');
    eq(st.p[0].hp, 2, '铁索把天火共享给另一方');
    st.p[0].hp = 3; st.p[1].hp = 3;
    X.rawDamage(st, 1, 1, '爆头', 'headshot', {});
    eq(st.p[1].hp, 2, '爆头命中目标');
    eq(st.p[0].hp, 2, '铁索把爆头共享给另一方');
  });

  /* ============ 输出 ============ */
  const pass = results.filter(r => r.ok).length;
  const html = '<div class="sum">通过 ' + pass + ' / ' + results.length + '</div><ol>' +
    results.map(function (r) {
      return r.ok
        ? '<li class="pass">✔ ' + r.name + '</li>'
        : '<li class="fail">✘ ' + r.name + '<details><div><pre>' + (r.err || '') + '</pre></div></details></li>';
    }).join('') + '</ol>';
  document.getElementById('out').innerHTML = html;
})();
