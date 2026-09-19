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
    /* v1.5.18（第三方复核 §2-3 实测）：**上面那一条其实什么都没守住**。
     * 它的构造是三次都拿 0.1 去比 0.5 ⇒ 把 `judge3` 改成 `judge`（只判一次）**照样绿**：
     * 测试锁住了一个输出，没锁住规则里的那个"3"。下面这组才是真正的判据 ——
     * "胜、胜、负"：judge3 ⇒ 不爆头；judge（只判一次）⇒ 会爆头 ⇒ 改坏了必红。 */
    const st4 = game('standard', seqRng([0.1, 0.1, 0.6])); setEp(st4, 5, 0);
    play(st4, SK.SNIPE, SK.JI);
    eq(st4.p[1].hp, 2, '三轮必须**全胜**才爆头（2 胜 1 负 ⇒ 只有普通 1 点伤害）');
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
    ok(st.p[0].chains.indexOf(1) >= 0 && st.p[1].chains.indexOf(0) >= 0, '连环成立');
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

  t('R37 天火：**不需要目标**，引爆全场自己贴的符咒（每个目标各受其枚数伤害）', function () {
    /* 用户报的 UI bug 的根因（v1.5.107）：卡面错声明成 `target:'enemy'` ⇒ UI 弹目标选择、AI 按对手造候选，
     * 而引擎也只在 `you = state.p[t]` 上引爆。权威口径：README「你贴出的符咒引爆」·
     * `RULES-2P:240`「**每个目标**每枚符咒受 1 火伤害」· `RULES-NP:322` 列为「仅空指」。
     * 本用例**能反证**：旧实现只会打中"选中的那一个" ⇒ 两个受害者里必有一个满血。 */
    const st = S.createState('multi', { next: function () { return 0.9; } }, 3);
    st.p[1].stickers = [{ owner: 0, age: 0 }];              // 0 号贴的 1 枚
    st.p[2].stickers = [{ owner: 0, age: 1 }, { owner: 2, age: 0 }];   // 1 枚是我的 + 1 枚不是我的
    st.p[0].ep = 2;
    X.startTurn(st);
    S.attemptAction(st, 0, R.SK.FIRESTORM);
    S.attemptAction(st, 1, R.SK.JI);
    S.attemptAction(st, 2, R.SK.JI);
    X.resolveActions(st); X.endTurn(st);
    eq(st.p[1].hp, 2, '受害者 1：我贴的 1 枚 ⇒ 1 点火伤');
    eq(st.p[2].hp, 2, '受害者 2：我贴的 1 枚 ⇒ 1 点火伤（**别人贴的那枚不算**）');
    eq(R.byKey[R.SK.FIRESTORM].target, 'self', '卡面声明必须是"不需要目标"⇒ UI 不再弹目标选择');
  });

  t('结算顺序裁定（v1.5.106 用户裁定）：同层内**资源型先结算** ⇒ 过载炮第 3 发吃到目标本回合刚生的ジ', function () {
    /* 复核 §10-4 实测：同层原先按座位轮换 ⇒ 炮手 0 号先手只吃到 6、炮手 3 号后手 9 ジ全没 ⇒
     * **同一发炮差 3 ジ，纯粹由座位决定**。用户裁定：资源型（ENERGY 类 = ジ/蓄能/聚能环）先结算。
     * 本用例**能反证**：2 人局的旧顺序是恒等（炮手先）⇒ 会读到目标 ep=3（先清空、后 +3）；
     * 修好后是 0（环先 +3、炮随后清空）。 */
    const st = game(); setEp(st, 5, 0);
    st.p[0].cannonCount = 2;        // 本次出手即第 3 发（出招即计次 ⇒ 结算时读到 3）
    st.p[1].ringStreak = 2;         // 连续第 3 次 ⇒ 结算 +3
    play(st, SK.CANNON, SK.RING);
    eq(st.p[1].ep, 0, '资源型先算：环 +3 之后被炮清空 ⇒ 目标终局 0（旧顺序会留下 3）');
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

  t('R10 被小雷无效化的聚能环**不续计**（v1.5.105 修：出招即计次 + 复位漏 voided ⇒ 打断反而送 +3）', function () {
    /* 用户实盘（`results/epirus-battle-26回合.txt:52-64`）：
     *   第 9 回合 玩家1 聚能环 被 玩家2 雷击之枪 无效化 ⇒ 本回合无ジ进账（这部分原本就是对的）；
     *   第 10 回合 玩家1 再聚能环 ⇒ **直接 +3**（最高档）。
     * 根因：`state.js:190` 出招即 `ringStreak++`，而 `endTurn` 的复位只看 `outcome === 'ok'`，
     *       `setVoid` 只置 `voided` ⇒ 被废的那次照样算"续"。
     * 本用例是**能反证**的：旧实现第二回合会读到 ep=5（免费续 + 吃满档）/ streak=2，
     * 修好后是 ep=1（按"首次"花 3 得 1）/ streak=0。 */
    const st = game(); setEp(st, 5, 5);
    play(st, SK.RING, SK.MINI_T);            // 小雷 无效化 聚能环
    ok(st.actions[0].voided, '聚能环必须被无效化');
    eq(st.p[0].ep, 2, '被废 ⇒ 本回合没有环的收入（5-3）');
    eq(st.p[0].ringStreak, 0, '被废 ⇒ 连击计数必须归零（不得算作"续"）');
    setEp(st, 3, 5);
    play(st, SK.RING, SK.JI);                // 再来一次：必须按"首次"算（花 3 得 1）
    eq(st.p[0].ep, 1, '重新按首次算：3-3+1（旧实现会免费续 +2 ⇒ 5）');
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

  t('R58 藤甲覆盖面 +1 回合（用户裁定）：贴上**当回合**就吃火伤 +1，持续到下回合结束', function () {
    /* 旧文 R22「仅在下回合内有效」= 把藤甲当**纯预置 debuff**；用户 2026-09-18 要求它
     * **多覆盖一回合**（贴上就被利用）。实现：贴上时同时点亮 `fireWeakNow`（本回合）与
     * `fireWeakNext`（下回合）；到期沿用既有机制（回合末清 Now、Next 在回合开始被消费）。
     * 本用例**能反证**：旧实现只挂 Next ⇒ **当回合**那发坦克只吃 1 点（下面第一断言会红）。
     * ⚠️ 之所以要三人局：两人局里"贴上者"当回合已经没有第二个动作能去打那个目标。 */
    const st = S.createState('multi', { next: function () { return 0.9; } }, 3);
    st.p[0].ep = 9; st.p[1].ep = 9; st.p[2].hp = 6;
    function turn(k0, k1, o0, o1) {
      st.events = []; X.startTurn(st);
      S.attemptAction(st, 0, k0, o0); S.attemptAction(st, 1, k1, o1); S.attemptAction(st, 2, R.SK.JI);
      X.resolveActions(st); X.endTurn(st);
    }
    // 回合1：0 号把藤甲贴到 2 号（pri3），1 号**当回合**就用坦克（火）打 2 号 ⇒ 应吃 +1
    turn(R.SK.ARMOR, R.SK.TANK, { target: 2 }, { target: 2 });
    eq(st.p[2].hp, 4, '当回合：坦克 1 + 藤甲 1 = 2 点（旧实现只挂下回合 ⇒ 这里会是 5）');
    st.p[0].ep = 9; st.p[1].ep = 9;
    turn(R.SK.JI, R.SK.TANK, null, { target: 2 });
    eq(st.p[2].hp, 2, '下回合：仍然 2 点（Next 被提升为 Now）');
    st.p[0].ep = 9; st.p[1].ep = 9;
    turn(R.SK.JI, R.SK.TANK, null, { target: 2 });
    eq(st.p[2].hp, 1, '第三回合：只剩基础 1 点（buff 已到期）');
  });

  t('R59 地雷时效：**当前回合 + 其后两个回合**（用户裁定），第三回合结束后卸下；触发即失效；再埋=刷新', function () {
    /* 旧文 R38「持续**直到被触发**」= 永久。用户裁定取 **3 回合**（千问实测：严格单回合会把这张牌
     * 打成废牌 —— 引爆 1.90→0.08 次/局）。
     * 本用例**能反证**：旧实现（永久）第 4 回合仍然 `mineArmed` ⇒ 最后一个断言会红。 */
    const st = game(); setEp(st, 9, 9);
    play(st, SK.MINE, SK.JI);                 // 回合1 埋雷 ⇒ 计数 3 → 回合末 2
    ok(st.p[0].mineArmed && st.p[0].mineTurns === 2, '回合1 结束后仍在（覆盖本回合 + 后两回合）');
    play(st, SK.JI, SK.JI);                   // 回合2
    ok(st.p[0].mineArmed && st.p[0].mineTurns === 1, '回合2 结束后仍在（后两回合的第 1 个）');
    play(st, SK.JI, SK.JI);                   // 回合3：武装着走完这回合，回合末减到 0
    ok(!st.p[0].mineArmed && st.p[0].mineTurns === 0, '回合3 结束后卸下（旧实现是永久 ⇒ 本断言抓得住）');
    play(st, SK.JI, SK.JI);                   // 回合4：确认卸下后不会自己回来
    ok(!st.p[0].mineArmed, '回合4 仍卸下');

    // 已武装时再埋 ⇒ **刷新**计时（保留 R40"重新埋雷 = 刷新为新雷，同源不叠加"）
    const st2 = game(); setEp(st2, 9, 9);
    play(st2, SK.MINE, SK.JI);
    play(st2, SK.MINE, SK.JI);
    ok(st2.p[0].mineArmed && st2.p[0].mineTurns === 2, '再埋刷新为 3（回合末 2），不是叠加');
    // 触发即失效（N20 原文"地雷随后失效"）
    const st3 = game(); setEp(st3, 9, 9);
    st3.p[0].mineArmed = true; st3.p[0].mineTurns = 3;
    play(st3, SK.JI, SK.GUN);                 // 被枪打 ⇒ 触发
    ok(!st3.p[0].mineArmed && st3.p[0].mineTurns === 0, '触发即失效（含计时清零）');
  });

  t('R24 原型制御：**伤害总数 ≥3 各自转移给作用者**（用户口径：可挡伤害之和 · 按持有者 · 结算末尾决算）', function () {
    /* 原版 `README.md:257` / `RULES-2P.md:169`（R24）。用户口径（2026-09-19）：
     *   ① "伤害总数" = **可以生效、且会被原型制御挡住的伤害之和**，按持有者、在同一次结算内累加；
     *   ② **三个人各用枪打**同一个持有者 ⇒ 总 3 ⇒ **三人各被反 1 滴**，持有者不掉血；
     *   ③ **大雷(2，有来源) + 天火(1，无来源)** ⇒ 总 3 ⇒ **大雷被反 2**；天火**计入总数但不反**；
     *   ④ 只挨一发（总 1）⇒ 照旧只挡。
     * 本用例**能反证**：旧实现（只有"阻挡"）下三个攻击者一滴都不掉 ⇒ ② 那三条断言会红。 */
    const mk = function (key) { return { key: key, voided: false, outcome: 'ok', opt: null, target: null }; };
    // ② 三个人各用枪打同一个持有者（各 1 点）⇒ 总 3 ⇒ 三人各被反 1
    const st = S.createState('multi', { next: function () { return 0.9; } }, 4);
    st.actions = [mk(R.SK.PROTO), mk(R.SK.JI), mk(R.SK.JI), mk(R.SK.JI)];
    for (const src of [1, 2, 3]) X.deliverDamage(st, { amt: 1, type: R.DMG.NORMAL, source: src, via: R.SK.GUN }, 0, { reason: '测试' });
    X.protoReflectAll(st);
    eq(st.p[0].hp, 3, '持有者不掉血（三发全被挡：3/3/3/3 里 0 号仍是 3）');
    eq(st.p[1].hp, 2, '攻击者 1 被反 1（旧实现会停在 3）');
    eq(st.p[2].hp, 2, '攻击者 2 被反 1');
    eq(st.p[3].hp, 2, '攻击者 3 被反 1');
    // ③ 大雷(2，有来源) + 天火(1，无来源) ⇒ 总 3 ⇒ 只反有来源的那一份
    const st2 = S.createState('multi', { next: function () { return 0.9; } }, 3);
    st2.actions = [mk(R.SK.PROTO), mk(R.SK.JI), mk(R.SK.JI)];
    X.deliverDamage(st2, { amt: 2, type: R.DMG.ELECTRIC, source: 1, via: R.SK.BIG_T }, 0, { reason: '测试' });
    X.protoNote(st2, 0, null, 1, R.DMG.FIRE, 'firestorm');     // 天火那一份（与引擎同一条 protoNote 路径）
    X.protoReflectAll(st2);
    eq(st2.p[0].hp, 3, '持有者不掉血');
    eq(st2.p[1].hp, 1, '大雷被反 2（3−2）');
    // ④ 对照：只挨一发 ⇒ 只挡不反
    const st3 = S.createState('multi', { next: function () { return 0.9; } }, 3);
    st3.actions = [mk(R.SK.PROTO), mk(R.SK.JI), mk(R.SK.JI)];
    X.deliverDamage(st3, { amt: 1, type: R.DMG.NORMAL, source: 1, via: R.SK.GUN }, 0, { reason: '测试' });
    X.protoReflectAll(st3);
    eq(st3.p[0].hp, 3, '持有者不掉血');
    eq(st3.p[1].hp, 3, '攻击者不掉血（总数 1 < 3）');
  });

  t('铁索连环的传导**不被原型制御挡住**（用户口径；回归钉）', function () {
    /* 传导发生在 `rawDamage` 内部（直接 `op.hp -= hit`，不经过 `deliverDamage`）⇒ 天然不被任何架势挡。
     * 这条是**回归钉**（旧实现也过）：钉住它别被"顺手把传导也接进架势判定"改坏。 */
    const mk = function (key) { return { key: key, voided: false, outcome: 'ok', opt: null, target: null }; };
    const st = S.createState('multi', { next: function () { return 0.9; } }, 3);
    st.actions = [mk(R.SK.PROTO), mk(R.SK.JI), mk(R.SK.JI)];
    st.p[2].chains = [0]; st.p[0].chains = [2];              // 0 号与 2 号互索（铁索连环）
    X.rawDamage(st, 2, 1, '枪', R.SK.GUN, { type: R.DMG.NORMAL, source: 1 });
    eq(st.p[2].hp, 2, '被直接打中的 2 号掉 1 点');
    eq(st.p[0].hp, 2, '持有原型制御的 0 号**照样吃传导**（不能被挡）');
  });

  t('R60 净化清除**自身全部持续状态**（用户裁定）：藤甲/地雷/避雷针/符咒/大雷禁用/梦魇', function () {
    /* 用户口径："藤甲与地雷既然成了 buff，就一并会被净化掉（同样会被净化掉的还有避雷针、符咒、
     * 大雷禁用效果、以及几乎不会出现的梦魇）"。
     * 本用例**能反证**：旧实现只清 `stickers / nightmare / tauntPending` 三项 ⇒ 下面
     * `fireWeakNext / mineArmed / mineTurns / rodGuard / cooldown` 五条断言在旧代码上会红。 */
    const st = game(); setEp(st, 9, 9);
    st.p[0].nightmare = true;
    st.p[0].tauntPending = true;
    st.p[0].fireWeakNow = true; st.p[0].fireWeakNext = true;
    st.p[0].mineArmed = true; st.p[0].mineTurns = 3;
    st.p[0].rodGuard = 4;
    st.p[0].cooldown = { bigT: 2 };
    st.p[0].hp = 5;                              // 给足血：梦魇回合开始 -0.5HP（R50）不参与断言
    play(st, SK.PURIFY, SK.JI);
    eq(st.p[0].fireWeakNow, false, '藤甲火弱（本回合）被清');
    eq(st.p[0].fireWeakNext, false, '藤甲火弱（下回合那份）被清（旧实现漏这条）');
    eq(st.p[0].mineArmed, false, '地雷被清（旧实现漏）');
    eq(st.p[0].mineTurns, 0, '地雷计时清零');
    eq(st.p[0].rodGuard, 0, '避雷针被清（旧实现漏）');
    eq(Object.keys(st.p[0].cooldown).length, 0, '大雷禁用被清（旧实现漏）');
    eq(st.p[0].nightmare, false, '梦魇被清');
    eq(st.p[0].tauntPending, false, '挑衅被清');
    // B) 符咒与回血（n-1 规则）—— 单独一局，别让其它状态的价格混进血量断言
    const st2 = game(); setEp(st2, 9, 9);
    st2.p[0].stickers = [{ owner: 1, age: 0 }, { owner: 1, age: 1 }];
    st2.p[0].hp = 2;
    play(st2, SK.PURIFY, SK.JI);
    eq(st2.p[0].stickers.length, 0, '符咒被清');
    eq(st2.p[0].hp, 3, '两枚符咒 ⇒ 回 1 血（n-1 规则）');
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

  t('R45 铁索连环：天火与爆头也共享伤害（文档口径；v1.5.18 起连边**一次性**）', function () {
    /* v1.5.18（用户裁定，按原文修正）：原文「**下一次**当其中一个角色受到伤害时，另一个也受到相同伤害」
     * ⇒ 共享过一次连边即解除。本用例原先连续打两次、指望连边还在 —— 那正是"持久光环"的错误语义。 */
    const st = game(); setEp(st, 5, 5);
    st.p[0].chains = [1]; st.p[1].chains = [0];
    st.p[0].hp = 3; st.p[1].hp = 3;
    X.rawDamage(st, 1, 1, '天火', 'firestorm', { type: R.DMG.FIRE });
    eq(st.p[1].hp, 2, '天火命中目标');
    eq(st.p[0].hp, 2, '铁索把天火共享给另一方');
    eq(st.p[1].chains.length, 0, '共享一次后连边解除（一次性）');
    st.p[0].chains = [1]; st.p[1].chains = [0];      // 重新互勾才有连边（真实路径见 np-test N8/D30）
    st.p[0].hp = 3; st.p[1].hp = 3;
    X.rawDamage(st, 1, 1, '爆头', 'headshot', {});
    eq(st.p[1].hp, 2, '爆头命中目标');
    eq(st.p[0].hp, 2, '铁索把爆头共享给另一方');
  });

  t('过载炮新规：打穿防御与反弹，但被任何攻击类技能抵消', function () {
    // ① 打穿防御
    let st = game(); setEp(st, 5, 5); st.p[0].hp = 3; st.p[1].hp = 3;
    play(st, R.SK.CANNON, R.SK.GUARD);
    eq(st.p[1].hp, 2, '过载炮应穿过防御造成 1 伤');
    // ② 打穿反弹（且不被反弹回打）
    st = game(); setEp(st, 5, 5); st.p[0].hp = 3; st.p[1].hp = 3;
    play(st, R.SK.CANNON, R.SK.REFLECT);
    eq(st.p[1].hp, 2, '过载炮应穿过反弹造成 1 伤');
    eq(st.p[0].hp, 3, '反弹不应回打施法者');
    // ③ 被任意攻击类技能抵消：对手回击 → 炮哑火
    st = game(); setEp(st, 5, 5); st.p[0].hp = 3; st.p[1].hp = 3;
    play(st, R.SK.CANNON, R.SK.GUN);
    eq(st.p[1].hp, 3, '对手回击时过载炮应被抵消，目标不掉血');
    ok(st.p[0].hp <= 2, '回击的枪应命中施法者');
    // ④ 大雷（附加效果）不属于 ATK_EFFECT，不能抵消过载炮的“回击”条件
    st = game(); setEp(st, 5, 5); st.p[0].hp = 3; st.p[1].hp = 3;
    ok(R.ATK_EFFECT.indexOf(R.SK.BIG_T) < 0, '大雷不在 ATK_EFFECT 里');
    ok(R.ATK_EFFECT.indexOf(R.SK.CANNON) >= 0, '过载炮自身属于 ATK_EFFECT');
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
