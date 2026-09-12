/* Epirus — 界面：对局交互 / 回合演示 / 训练场调度（全部本地，无依赖） */
(function () {
  'use strict';
  const R = window.EpirusRules, S = window.EpirusState, X = window.EpirusResolve;
  const Play = window.EpirusPlay, Bots = window.EpirusBots;
  const P = window.EpirusPolicy, Trainer = window.EpirusTrainer, Champ = window.EpirusChampion;

  const $ = function (id) { return document.getElementById(id); };
  const NAME = ['你', '电脑'];
  const CAT_NM = { energy: '能量', attack: '攻击', defense: '防御', special: '特殊' };
  const MODE_NM = { standard: '标准', fast: '快速', lucky: '欧皇', multi: '多人', long: '长程(5血)' };
  /* v1.4.0：多人族模式（3-5 人可用）。加长程模式时必须同时登记在这里，
   * 否则 newGame / 人数切换会把用户选的模式悄悄改回 multi。 */
  const MULTI_MODES = ['multi', 'long'];

  /* ---------- 小工具 ---------- */
  function skillName(key) { return R.byKey[key] ? R.byKey[key].name : key; }
  function byName(key) { return R.byKey[key] ? R.byKey[key].name : key; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 对局状态 ---------- */
  const B = {
    state: null, modeKey: 'standard', diff: 'medium', players: 2, multi: false,
    roundStarted: false, locked: false, snap: null, aiKey: null,
    evCursor: 0, transcript: [], aiHistory: [],
    roundStartSnapshot: null, warnedChampNoTrain: false, undoUsed: false
  };

  function newGame() {
    const n = B.players || 2;
    B.multi = n > 2;
    if (typeof syncDiffOptions === 'function') syncDiffOptions();
    syncModeOptions();   // v1.4.0：按人数校验模式（原来无条件改回 'multi'，会吃掉用户选的长程模式）
    B.state = S.createState(B.modeKey, null, n);
    B.roundStarted = false; B.locked = false; B.aiKey = null;
    B.evCursor = 0; B.transcript = []; B.aiHistory = [];
    B.roundStartSnapshot = null; B.warnedChampNoTrain = false; B.undoUsed = false;
    closeOverlay();
    buildSkillGrid();
    renderSide(0); renderSide(1);
    logClear('新对局：' + (B.multi ? n + ' 人 · ' + (MODE_NM[B.modeKey] || '多人') : MODE_NM[B.modeKey] + '模式') + ' · 难度=' + diffName(B.diff) +
      ' · 对手AI=' + aiInfo().source + ' · 每人初始 ' + B.state.mode.hp + ' 血');
    hint('请选择技能出招 —— 双方同时出手，按优先级结算。');
  }

  function diffName(d) {
    if (d === 'champ') return '冠军（最强）';
    const st = styleOf(d);
    if (st) return st.name;
    return d === 'easy' ? '简单' : d === 'medium' ? '中等' : '困难（最新高水平AI）';
  }

  /* ---------- 侧栏渲染 ---------- */
  function panelHtml(pid) {
    const st = B.state, p = st.p[pid];
    const full = Math.min(Math.floor(p.hp), 8);
    let hearts = '';
    for (let i = 0; i < full; i++) hearts += '♥';
    if (p.hp - Math.floor(p.hp) >= 0.45 && full < 8) hearts += '♡';
    if (p.hp > 8) hearts += ' ×' + p.hp;
    const chips = ['ジ', '电', '爆'].map(function (k, i) {
      const v = k === 'ジ' ? p.ep : (k === '电' ? p.elec : p.boom);
      return '<span class="stat">' + k + ' <b>' + v + '</b></span>';
    }).join('');

    const badges = [];
    if (p.hp <= 0) badges.push(['已淘汰', 'red']);
    if (p.mineArmed) badges.push(['地雷', 'warn']);
    if (p.rodGuard > 0) badges.push(['避雷针守卫', 'blue']);
    if (p.chains && p.chains.length) badges.push(['铁索连环×' + p.chains.length, 'pur']);
    if (p.nightmare) badges.push(['梦魇-0.5/回合', 'warn']);
    if (p.vampire) badges.push(['吸血鬼公爵', 'pur']);
    if (p.baguaExtra) badges.push(['无极变速·本回合', 'blue']);
    if (p.fireWeakNow) badges.push(['藤甲·火伤+1', 'warn']);
    if (p.tauntActive) badges.push(['被挑衅·必须攻击', 'warn']);
    if (p.infiniteEnergy) badges.push(['回魂·无限能量', 'gold']);
    if (p.stickers.length) badges.push(['符咒×' + p.stickers.length, 'pur']);
    const cd = Object.keys(p.cooldown).filter(function (k) { return p.cooldown[k] > 0; });
    if (cd.length) badges.push(['禁用中:' + cd.map(skillName).join('/') + '×' + cd.length, 'warn']);

    return '<h3>' + (pid === 0 ? '🧑 ' : '🤖 ') + esc(p.name) + '</h3>' +
      '<div class="statbar"><span class="stat">HP <b>' + p.hp + '</b></span>' + chips + '</div>' +
      '<div class="hearts">' + (hearts || '') + '</div>' +
      '<div class="badges">' + (badges.map(function (bd) { return '<span class="badge ' + bd[1] + '">' + bd[0] + '</span>'; }).join('') || '<span class="dim" style="font-size:11px">无状态</span>') + '</div>';
  }

  function renderSide(pid) {
    if (B.multi) {
      if (pid === 0) { $('side-0').innerHTML = panelHtml(0); return; }
      let h = '';
      for (let i = 1; i < B.state.p.length; i++) {
        h += '<div class="mpanel' + (B.state.p[i].hp <= 0 ? ' dead' : '') + '">' + panelHtml(i) + '</div>';
      }
      $('side-1').innerHTML = h;
      return;
    }
    $('side-' + pid).innerHTML = panelHtml(pid);
  }

  /* ---------- 技能面板 ---------- */
  function costLabel(s) {
    switch (s.key) {
      case R.SK.JI: return '免费 · 得1ジ';
      case R.SK.CHARGE: return '1ジ · 得能量珠';
      case R.SK.RING: return '首3ジ · 连发免费';
      case R.SK.CANNON: return '相位:2ジ→全ジ→全ジ+1血';
      case R.SK.LASER_EYE: return '首1ジ+爆珠 · 连用2ジ';
      case R.SK.RAILGUN: return '2ジ+电珠';
      default: return (s.cost === 0 ? '免费' : s.cost + 'ジ');
    }
  }
  function buildSkillGrid() {
    const grid = $('skillgrid');
    const st = B.state;
    // 不可用（ジ/珠子不足或条件不满足）的技能直接置灰不可点——不再"能点但显示无效"
    const legalMap = {};
    if (!st.over) { for (const l of Play.legalActions(st, 0)) legalMap[l.key] = l; }
    grid.innerHTML = '';
    for (const s of R.skills) {
      const modeOk = S.canUseSkillInMode(st, s.key);
      const cd = (st.p[0].cooldown[s.key] || 0);
      const multiOnly = R.MULTI_ONLY.indexOf(s.key) >= 0 && !S.canUseSkillInMode(st, s.key);
      const la = legalMap[s.key];
      const unaffordable = !multiOnly && modeOk && cd <= 0 && !st.over && (!la || !la.affordable);
      const btn = document.createElement('button');
      btn.className = 'skillbtn c-' + s.cat;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name;
      const ct = document.createElement('span'); ct.className = 'ct';
      ct.textContent = multiOnly ? '多人模式' : (cd > 0 ? ('禁用剩' + cd + '回合') : costLabel(s));
      btn.appendChild(nm); btn.appendChild(ct);
      btn.title = '【' + CAT_NM[s.cat] + ' · 优先级' + (s.pri || 3) + '】手势：' + (s.gesture || '—') + '\n' + s.desc;
      btn.disabled = multiOnly || !modeOk || cd > 0 || st.over || unaffordable;
      if (multiOnly) btn.title += '\n（多人专用（2 人局不开放），见 docs/RULES-NP.md N14）';
      else if (!modeOk) btn.title += '\n（本模式不可用）';
      else if (unaffordable) btn.title += '\n（ジ/珠子不足或条件不满足，本回合无法发动）';
      btn.onclick = function () { pickSkill(s.key); };
      grid.appendChild(btn);
    }
  }

  /* ---------- 对局流程 ---------- */
  function hint(txt) { $('battle-hint').textContent = txt; }
  function logClear(first) {
    const lb = $('logbox'); lb.innerHTML = '';
    if (first) addLog('div', 'rnd', esc(first));
  }
  function addLog(tag, cls, html) {
    const lb = $('logbox');
    const el = document.createElement(tag);
    el.className = cls || 'ev';
    el.innerHTML = html;
    lb.appendChild(el);
    lb.scrollTop = lb.scrollHeight;
  }
  function logEvents(list, rootCls) {
    for (const e of list) {
      const t = evText(e);
      if (t) addLog('div', t.cls || 'ev', t.html);
    }
  }

  function ensureRound() {
    if (B.roundStarted) return;
    X.startTurn(B.state);
    // startTurn 副作用（梦魇/回魂等）立即入日志
    const evs = B.state.events;
    if (B.evCursor < evs.length) logEvents(evs.slice(B.evCursor));
    B.evCursor = evs.length;
    B.roundStarted = true;
    // startTurn 的副作用可能改变资源（如回魂=无限能量），同步刷新技能可用性
    buildSkillGrid(); renderSide(0); renderSide(1);
    if (B.state.over) { finish(); return; }
  }

  function pickSkill(key) {
    if (B.locked || B.state.over) return;
    if (key === R.SK.CHARGE) {
      openModal('<h3>蓄能：存哪种能量珠？</h3>', [
        { label: '⚡ 电能（电磁炮用）', fn: function () { closeModal(); doPick(key, 'elec'); } },
        { label: '💥 爆破能（激光眼用）', fn: function () { closeModal(); doPick(key, 'boom'); } }
      ]);
      return;
    }
    doPick(key, null);
  }

  function doPick(key, bead, target) {
    if (B.multi) return doPickMulti(key, bead, target);
    if (B.locked) return;
    B.locked = true;
    // 悔一步基准：回合开始前（startTurn 前）快照，撤销可回退到本回合开始
    if (!B.roundStarted) B.roundStartSnapshot = S.cloneState(B.state);
    ensureRound();
    if (B.state.over) { B.locked = false; return; }
    const idx0 = B.state.events.length;
    // 同时行动：AI 基于“行动前状态”决策，看不到玩家本回合动作/效果
    const preState = S.cloneState(B.state);
    const preLegal = Play.legalActions(preState, 1);
    const aiKey = chooseAI(preState, preLegal);
    // 玩家出招
    S.attemptAction(B.state, 0, key, bead ? { bead: bead } : null);
    const humanPick = key;
    hint('你选择了【' + skillName(key) + '】，电脑思考中…');
    setTimeout(function () {
      // 电脑出招（用先决策好的 aiKey）
      S.attemptAction(B.state, 1, aiKey, { bead: B.state.p[1].elec > B.state.p[1].boom ? 'boom' : 'elec' });
      const aiPick = aiKey;
      // 结算
      X.resolveActions(B.state);
      X.endTurn(B.state);
      // 回合日志
      const events = B.state.events.slice(idx0);
      const a0 = B.state.actions[0], a1 = B.state.actions[1];
      const mark = function (a) {
        if (!a || a.outcome === 'ok') return '';
        return a.outcome === 'insufficient' ? '（ジ不足·未发动）' : a.outcome === 'banned' ? '（禁用无效）' : '（无效）';
      };
      addLog('div', 'rnd', '第 ' + B.state.round + ' 回合：你=【' + skillName(humanPick) + '】' + mark(a0) + ' 电脑=【' + skillName(aiPick) + '】' + mark(a1));
      logEvents(events);
      // 记录 transcript（纯文本，供导出复查）
      const lines = events.map(function (e) {
        const t = evText(e);
        return t ? t.html.replace(/<[^>]+>/g, '') : null;
      }).filter(Boolean);
      B.transcript.push({
        round: B.state.round,
        human: skillName(humanPick) + mark(a0),
        ai: skillName(aiPick) + mark(a1),
        lines: lines
      });
      persistBattle();
      B.evCursor = B.state.events.length;
      // 每回合结算后重建技能网格：ジ/珠子变化后，原本不可用的技能要即时解锁（或反之变灰）
      buildSkillGrid(); renderSide(0); renderSide(1);
      B.locked = false;
      B.roundStarted = false;
      if (B.state.over) { finish(); return; }
      hint('第 ' + (B.state.round + 1) + ' 回合准备 —— 请出招（出招前可“悔一步”）。');
    }, 160 + Math.random() * 120);
  }

  /* ---------- 多人（3-5）对局 ---------- */
  /* 3P 冠军包（多人自对战训练产物）：不兼容/缺失返回 null */
  let multiChampCache;
  function resetMultiChampCache() { multiChampCache = undefined; }
  function loadMultiChamp() {
    if (multiChampCache !== undefined) return multiChampCache;
    let pack = null;
    try {
      const raw = localStorage.getItem('epirus.champion3p');
      if (raw) pack = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    multiChampCache = P.unpack(pack);                      // 旧版/损坏包 → null
    if (!multiChampCache && typeof window.EPIRUS_CHAMPION_3P !== 'undefined') {
      multiChampCache = P.unpack(window.EPIRUS_CHAMPION_3P);   // 回退内置包
    }
    return multiChampCache;
  }
  /* 当前多人对局实际用的是哪个 AI（供 UI 显示与探针断言） */
  function styleOf(id) {
    const list = (Bots.STYLES || []);
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* 模式切换时重建难度下拉：
   * 多人 = 5 个具名风格 + 冠军；2 人 = 原来的 简单/中等/困难（v1.0 口径不变）。 */
  function syncDiffOptions() {
    const sel = $('sel-diff'); if (!sel) return;
    const want = B.multi
      ? (Bots.STYLES || []).map(function (x) { return { v: x.id, t: x.name }; }).concat([{ v: 'champ', t: '冠军（最强）' }])
      : [{ v: 'easy', t: '简单' }, { v: 'medium', t: '中等' }, { v: 'hard', t: '困难（最新高水平AI）' }];
    const valid = want.some(function (o) { return o.v === B.diff; });
    sel.innerHTML = want.map(function (o) { return '<option value="' + o.v + '">' + o.t + '</option>'; }).join('');
    if (!valid) B.diff = B.multi ? 'st:combocounter' : (B.diff === 'champ' ? 'hard' : 'medium');
    if (B.diff === 'champ') B.diff = 'champ';
    sel.value = B.diff;
    if (!sel.value) { sel.value = want[0].v; B.diff = want[0].v; }
  }

  function aiInfo() {
    if (!B.multi) return { source: B.diff === 'hard' ? '2人冠军' : '脚本', champ: B.diff === 'hard' };
    if (B.diff === 'champ') {
      return loadMultiChamp()
        ? { source: '3P 冠军', champ: true }
        : { source: '脚本·多人强档（冠军包缺失/不兼容，已回退）', champ: false, fallback: true };
    }
    const st = styleOf(B.diff);
    return { source: '风格·' + (st ? st.name : B.diff), champ: false };
  }

  /* 目标启发：用训练器的 v2 口径（反锁 + 必杀优先 + 打领先者），避免互相抵消死循环 */
  function pickTargetFor(state, pid, key) {
    const T = window.EpirusTrainer;
    if (T && T.pickTargetN) return T.pickTargetN(state, pid, key);
    const def = R.byKey[key];
    if (!def || def.target === 'self') return null;
    const opps = S.opponentsOf(state, pid);
    if (!opps.length) return null;
    return opps[0];
  }

  /* 多人 AI：困难 = 3P 冠军（缺失则回退脚本自适应） */
  function chooseAIMulti(state, pid, legal) {
    function finish(res) {
      const key = (typeof res === 'string') ? res : (res && res.key);
      const t1 = (res && typeof res === 'object' && res.target != null) ? res.target : pickTargetFor(state, pid, key);
      let t2 = null;
      if (key === R.SK.DUAL_GUN || key === R.SK.MIRROR) {
        const rest = S.opponentsOf(state, pid).filter(function (o) { return o !== t1; });
        t2 = rest.length ? rest[0] : null;
      }
      return { key: key, target: t1, target2: t2 };
    }
    if (B.diff === 'champ') {
      const c = loadMultiChamp();
      if (c) {
        B.aiFallback = false;
        const base = legal.filter(function (l) { return l.affordable; });
        const legalForAI = base.length ? base : [{ key: R.SK.JI, affordable: true }];
        return finish(P.choose(state, pid, legalForAI, c, { temp: 0.15 }));
      }
      B.aiFallback = true;                                  // 冠军缺失 → 显式回退，不静默
      return finish(DN.hard.pick(state, pid, legal));
    }
    B.aiFallback = false;
    const st = styleOf(B.diff);
    return finish((st ? st.pick : Bots.pickBalanced)(state, pid, legal));
  }

  /* 人类玩家被淘汰后：AI 自行打完剩余回合（观战） */
  function autoRunRest() {
    let guard = 0;
    while (!B.state.over && B.state.p[0].hp <= 0 && guard++ < 200) {
      const idx0 = B.state.events.length;
      X.startTurn(B.state);
      if (B.state.over) break;
      const preState = S.cloneState(B.state);
      const N = B.state.p.length;
      const picks = [];
      for (let pid = 1; pid < N; pid++) {
        picks.push(preState.p[pid].hp > 0 ? chooseAIMulti(preState, pid, Play.legalActions(preState, pid)) : null);
      }
      for (let pid = 1; pid < N; pid++) {
        if (!picks[pid - 1]) continue;
        const b = B.state.p[pid];
        S.attemptAction(B.state, pid, picks[pid - 1].key, { bead: b.elec > b.boom ? 'boom' : 'elec', target: picks[pid - 1].target, target2: picks[pid - 1].target2 });
      }
      X.resolveActions(B.state);
      X.endTurn(B.state);
      addLog('div', 'rnd', '第 ' + B.state.round + ' 回合（观战）');
      logEvents(B.state.events.slice(idx0));
    }
    B.evCursor = B.state.events.length;
    B.locked = false;
    B.roundStarted = false;
    if (B.state.over) finish();
  }

  /* 双枪射手：第二个目标 */
  function pickSecondTarget(key, bead, t1) {
    const opps = S.opponentsOf(B.state, 0).filter(function (o) { return o !== t1; });
    const title = key === R.SK.MIRROR ? '选择输出对象（目标 2/2）' : '选择目标 2/2';
    if (!opps.length) return doPickMulti(key, bead, t1, null);
    openModal('<h3>' + title + '：' + R.byKey[key].name + '</h3>', opps.map(function (o) {
      return {
        label: '👉 ' + B.state.p[o].name + '（HP ' + B.state.p[o].hp + '）',
        fn: function () { closeModal(); doPickMulti(key, bead, t1, o); }
      };
    }));
  }

  function doPickMulti(key, bead, target, target2) {
    if (B.locked || B.state.over) return;
    const def = R.byKey[key];
    if (target === undefined) {
      const opps = S.opponentsOf(B.state, 0);
      if (def && def.target !== 'self' && opps.length > 1) {
        const need2 = key === R.SK.DUAL_GUN || key === R.SK.MIRROR;
        const title = key === R.SK.MIRROR ? '选择复制对象（目标 1/2）' : '选择目标' + (need2 ? ' 1/2' : '');
        openModal('<h3>' + title + '：' + def.name + '</h3>', opps.map(function (o) {
          return {
            label: '👉 ' + B.state.p[o].name + '（HP ' + B.state.p[o].hp + '）',
            fn: function () {
              closeModal();
              if (need2) return pickSecondTarget(key, bead, o);
              doPickMulti(key, bead, o, null);
            }
          };
        }));
        return;
      }
      target = opps.length ? opps[0] : null;
    }
    B.locked = true;
    if (!B.roundStarted) B.roundStartSnapshot = S.cloneState(B.state);
    ensureRound();
    if (B.state.over) { B.locked = false; return; }
    const idx0 = B.state.events.length;
    const preState = S.cloneState(B.state);
    const N = B.state.p.length;
    const picks = [];
    for (let pid = 1; pid < N; pid++) {
      picks.push(preState.p[pid].hp > 0 ? chooseAIMulti(preState, pid, Play.legalActions(preState, pid)) : null);
    }
    S.attemptAction(B.state, 0, key, { bead: bead, target: target, target2: target2 });
    hint('你选择了【' + skillName(key) + (target != null ? ' → ' + B.state.p[target].name : '') + '】，对手思考中…');
    setTimeout(function () {
      for (let pid = 1; pid < N; pid++) {
        if (!picks[pid - 1]) continue;
        const b = B.state.p[pid];
        S.attemptAction(B.state, pid, picks[pid - 1].key, { bead: b.elec > b.boom ? 'boom' : 'elec', target: picks[pid - 1].target, target2: picks[pid - 1].target2 });
      }
      X.resolveActions(B.state);
      X.endTurn(B.state);
      const events = B.state.events.slice(idx0);
      const mark = function (a) {
        if (!a || a.outcome === 'ok') return '';
        return a.outcome === 'insufficient' ? '（ジ不足·未发动）' : a.outcome === 'banned' ? '（禁用无效）' : '（无效）';
      };
      const parts = [];
      for (let pid = 0; pid < N; pid++) {
        const a = B.state.actions[pid];
        const tg = (a && a.target != null && a.target !== pid) ? '→' + B.state.p[a.target].name : '';
        parts.push(B.state.p[pid].name + '=【' + skillName(a ? a.key : R.SK.JI) + tg + '】' + mark(a));
      }
      addLog('div', 'rnd', '第 ' + B.state.round + ' 回合：' + parts.join('  '));
      logEvents(events);
      const lines = events.map(function (e) {
        const t = evText(e);
        return t ? t.html.replace(/<[^>]+>/g, '') : null;
      }).filter(Boolean);
      B.transcript.push({ round: B.state.round, line: parts.join('  '), human: parts[0], ai: parts.slice(1).join(' '), lines: lines });
      persistBattle();
      B.evCursor = B.state.events.length;
      buildSkillGrid(); renderSide(0); renderSide(1);
      B.locked = false;
      B.roundStarted = false;
      if (B.state.over) { finish(); return; }
      if (B.state.p[0].hp <= 0) { hint('你已被淘汰，自动观战至结束…'); autoRunRest(); return; }
      hint('第 ' + (B.state.round + 1) + ' 回合准备 —— 请出招（出招前可“悔一步”）。');
    }, 160 + Math.random() * 120);
  }

  /* 测试钩子（tools/np-probe.mjs 用）：只暴露对象引用，不改变游戏逻辑 */
  if (typeof window !== 'undefined') window.EpirusUI = { B: B, newGame: newGame, aiInfo: aiInfo, showRecap: showRecap, refresh: function () { buildSkillGrid(); renderSide(0); renderSide(1); } };

  function chooseAI(state, legal) {
    const d = B.diff;
    if (d === 'hard') {
      // 困难 = 最新高水平AI：优先用（本地或内置）自对战冠军；无冠军则退回“困难·自适应”
      const c = Champ.store.load();
      if (c) {
        // 只在“可负担”技能里选：AI 绝不主动贷款自爆
        const base = legal.filter(l => l.affordable);
        const legalForAI = base.length ? base : [{ key: R.SK.JI, affordable: true }];
        // 播放口径：与训练口径一致（temp0.15，纯策略）。
        // 不再用运行时"连招防护"——改为训练时加入"连招反制"对手，让 AI 自己学会别被看穿。
        return P.choose(state, 1, legalForAI, c, { temp: 0.15 });
      }
      return Bots.pickAdaptive(state, 1, legal);
    }
    if (d === 'easy') return Bots.DIFFICULTY.easy.pick(state, 1, legal);
    return Bots.pickBalanced(state, 1, legal);
  }

  /* 悔一步：回到本回合出招前快照 */
  function rebuildLog() {
    const lb = $('logbox'); lb.innerHTML = '';
    addLog('div', 'rnd', '（悔一步）回到上一回合开始前');
    for (const r of B.transcript) {
      addLog('div', 'rnd', '第 ' + r.round + ' 回合：' + (r.line ? r.line : '你=【' + r.human + '】 电脑=【' + r.ai + '】'));
      for (const l of r.lines) addLog('div', 'ev', l);
    }
  }

  function undo() {
    if (B.locked) { hint('结算中不能悔一步'); return; }
    if (B.state.over) { hint('对局已结束，请点“再来一局”'); return; }
    if (B.undoUsed) { hint('本局已用过“悔一步”，为避免“看答案重答”不再允许'); return; }
    if (!B.roundStartSnapshot || !B.transcript.length) {
      hint('暂无可悔的一步（至少完成一回合后才能“悔一步”）'); return;
    }
    B.undoUsed = true;
    B.state = S.cloneState(B.roundStartSnapshot);
    B.roundStarted = false;
    B.transcript.pop();
    B.evCursor = B.state.events.length;
    B.aiHistory = [];
    rebuildLog();
    buildSkillGrid(); renderSide(0); renderSide(1);
    hint('已悔一步：回到上一回合开始前，请重新出招。');
  }

  function finish() {
    persistBattle();
    buildSkillGrid();
    const w = B.state.winner;
    let title, cls = 'gold';
    if (w === 0) { title = '🎉 你赢了！'; }
    else if (w === 'draw') { title = '🤝 平局'; }
    else { title = '💀 ' + (B.state.p[w] ? B.state.p[w].name : '电脑') + ' 获胜'; cls = 'red'; }
    const lines = ['共进行 ' + B.state.round + ' 回合'];
    for (const pp of B.state.p) lines.push(pp.name + ' HP ' + pp.hp);
    openOverlay('<h2 style="color:var(--' + (w === 0 ? 'green' : w === 'red' ? 'red' : 'gold') + ')">' + title + '</h2>' +
      '<p>' + lines.join(' · ') + '</p>',
      [{ label: '📜 查看本局复盘', fn: showRecap }, { label: '再来一局', fn: newGame }]);
  }

  /* 本局复盘：不清空对局，展示逐回合记录（方便看完再决定） */
  function showRecap() {
    const rows = [];
    for (const r of B.transcript) {
      rows.push('<div class="rnd">第 ' + r.round + ' 回合：' + esc(r.line || ('你=【' + r.human + '】 电脑=【' + r.ai + '】')) + '</div>');
      for (const l of r.lines) rows.push('<div class="ev">' + esc(l) + '</div>');
    }
    openOverlay('<h2>📜 本局复盘（共 ' + B.state.round + ' 回合）</h2>' +
      '<div style="max-height:54vh;overflow:auto;text-align:left;font-size:12px;line-height:1.5;background:#141a2e;border-radius:8px;padding:8px 10px">' +
      (rows.join('') || '<div>暂无记录</div>') + '</div>',
      [{ label: '导出记录', fn: exportLog }, { label: '关闭', fn: closeOverlay }, { label: '再来一局', fn: newGame }]);
  }
  /* 上局记录：从 localStorage 读（即使已点过“再来一局”也还在） */
  function showLastBattle() {
    let txt = '';
    try { txt = localStorage.getItem('epirus.lastBattle') || ''; } catch (e) { txt = ''; }
    if (!txt) { hint('暂无上局记录'); return; }
    openOverlay('<h2>📄 上局记录</h2>' +
      '<div style="max-height:54vh;overflow:auto;text-align:left;font-size:12px;line-height:1.5;white-space:pre-wrap;background:#141a2e;border-radius:8px;padding:8px 10px">' +
      esc(txt) + '</div>',
      [{ label: '关闭', fn: closeOverlay }]);
  }

  /* 导出当前对局记录（纯文本，用于复查；同时存 localStorage） */
  /* 组装对局记录纯文本（导出 / 自动保存共用） */
  function buildBattleText() {
    let txt = 'Epirus 拍手游戏 对局记录\n模式=' + MODE_NM[B.modeKey] + '  难度=' + diffName(B.diff) + '\n\n';
    for (const r of B.transcript) {
      txt += '第 ' + r.round + ' 回合：' + (r.line ? r.line : '你=【' + r.human + '】 电脑=【' + r.ai + '】') + '\n';
      for (const l of r.lines) txt += '   - ' + l + '\n';
    }
    const w = B.state.winner;
    txt += '\n结果：' + (w === 0 ? '你赢了' : w === 'draw' ? '平局' : (B.state.p[w] ? B.state.p[w].name + ' 获胜' : '平局')) + '（共 ' + B.state.round + ' 回合）\n';
    return txt;
  }
  // 每回合自动保存到 localStorage（对局结束也不清空，便于复查/调试）
  function persistBattle() {
    if (!B.transcript.length) return;
    try { localStorage.setItem('epirus.lastBattle', buildBattleText()); } catch (e) { /* ignore */ }
  }
  function exportLog() {
    if (!B.transcript.length) { hint('还没有对局记录可导出'); return; }
    persistBattle();
    const blob = new Blob([buildBattleText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'epirus-battle-' + B.state.round + '回合.txt';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- 事件文案 ---------- */
  function nm(pid) { return (B.state && B.state.p[pid]) ? B.state.p[pid].name : (NAME[pid] || pid); }
  function evText(e) {
    const dim = { cls: 'ev dim' }, g = { cls: 'ev gold' }, p = { cls: 'ev pur' }, d = { cls: 'ev dmg' }, h = { cls: 'ev heal' };
    switch (e.type) {
      case 'insufficient': return { cls: 'ev dim', html: '💸 ' + nm(e.pid) + ' ジ不足，' + (R.byKey[e.skill] ? R.byKey[e.skill].name : e.skill) + ' 未发动' };
      case 'damage': {
        const why = e.reason && e.reason !== e.via ? '（' + esc(e.reason) + '）' : '';
        return { cls: 'ev dmg', html: '💥 ' + nm(e.to) + ' 受 ' + e.amt + ' 点伤害' + why };
      }
      case 'heal': return { cls: 'ev heal', html: '💚 ' + nm(e.pid) + ' 回复 ' + e.amt + ' 血' + (e.reason ? '（' + esc(e.reason) + '）' : '') };
      case 'ep': return { cls: 'ev', html: '🔋 ' + nm(e.pid) + ' ジ ' + (e.delta > 0 ? '+' : '') + e.delta };
      case 'bead': return { cls: 'ev', html: (e.delta > 0 ? '✨ ' + nm(e.pid) + ' 获得' : '✖ ' + nm(e.pid) + ' 消耗') + (e.kind === 'elec' ? ' 1 电珠' : ' 1 爆珠') };
      case 'beadExpire': return { cls: 'dim', html: '⏳ ' + nm(e.pid) + ' 的' + (e.kind === 'elec' ? '电珠' : '爆珠') + '过期（蓄能珠只供下一回合）' };
      case 'mineArm': return { cls: 'ev', html: '💣 ' + nm(e.pid) + ' 埋下地雷' };
      case 'guardSet': return { cls: 'ev dim', html: '🛡 ' + nm(e.pid) + ' 摆出【' + skillName(e.key) + '】架势' };
      case 'holoSet': return { cls: 'ev dim', html: '🛡 ' + nm(e.pid) + ' 用【全息屏障】护住 ' + nm(e.target) + '（本回合视为原型制御架势）' };
      case 'blocked': return { cls: 'ev dim', html: '🛡 ' + nm(e.to) + ' 的【' + (e.by || '架势') + '】挡下伤害' + (e.judge ? '（判定成功）' : '') };
      case 'reflect': {
        const guardName = e.by === 'armor' ? '藤甲' : '反弹';
        return { cls: 'ev gold', html: '↩ ' + nm(e.from) + ' 的攻击被 ' + nm(e.to) + ' 的【' + guardName + '】弹回 → 伤害落到 ' + nm(e.from) };
      }
      case 'transfer': return { cls: 'ev gold', html: '↩ ' + nm(e.to) + ' 使用【转移伤害】，伤害弹回给 ' + nm(e.from) };
      case 'curse': return { cls: 'ev pur', html: '🧧 ' + nm(e.owner) + ' 给 ' + nm(e.pid) + ' 贴上符咒' };
      case 'curseBlock': return { cls: 'ev dim', html: '🧧 符咒被 ' + nm(e.pid) + ' 的架势挡下' };
      case 'firestorm': return e.n > 0 ? { cls: 'ev dmg', html: '🔥 ' + nm(e.pid) + ' 引燃 ' + e.n + ' 枚符咒！' } : { cls: 'ev dim', html: nm(e.pid) + ' 放天火，但没有可引爆的符咒' };
      case 'taunt': return { cls: 'ev pur', html: '📣 ' + nm(e.pid) + ' 对 ' + nm(e.target) + ' 挑衅（下回合必须攻击）' };
      case 'tauntCheck': return { cls: 'ev dim', html: '⚖ 挑衅检查 ' + nm(e.pid) + '：' + (e.ok ? '已攻击 ✓' : '未攻击 → 回合末 -1') };
      case 'voided': return { cls: 'ev dim', html: '🚫 ' + nm(e.pid) + ' 的技能被无效化' + (e.by ? '（' + byName(e.by) + '）' : '') };
      case 'voidedBy': return { cls: 'ev dim', html: '🚫 ' + nm(e.pid) + ' 的技能被【' + skillName(e.by) + '】无效化' };
      case 'voidImmune': return { cls: 'ev gold', html: '🛡 ' + nm(e.pid) + ' 的【' + skillName(e.key) + '】豁免了无效化' };
      case 'cancel': return { cls: 'ev gold', html: '⚔ 双方攻击相抵，均无效' };
      case 'clash': return { cls: 'ev gold', html: '⚔ 高优先级攻击阻止了对方攻击' };
      case 'thunderRing': return { cls: 'ev gold', html: '🌩 双方互放小雷成环 —— 两雷皆无效果' };
      case 'rod': return e.mode === 'A'
        ? { cls: 'ev gold', html: '☂ ' + nm(e.pids[0]) + ' 的避雷针：所有雷系技能无效，施术者反噬 1 电并获得其能量' }
        : { cls: 'ev blue', html: '☂ ' + nm(e.pids[0]) + ' 架起避雷针（3 回合内免雷一次）' };
      case 'rodBlock': return { cls: 'ev gold', html: '☂ ' + nm(e.pid) + ' 的避雷针挡下雷击' };
      case 'ban': return { cls: 'ev dmg', html: '🌩 ' + nm(e.pid) + ' 被雷劈中：多数技能禁用 3 回合（防御/反弹/金刚盾/ジ 除外）' };
      case 'hidden': return { cls: 'ev pur', html: '🌑 触发隐藏技能【' + e.name + '】' + (e.pid != null ? '（' + nm(e.pid) + '）' : '') + (e.to != null ? ' → ' + nm(e.to) : '') };
      case 'bigTChain': return { cls: 'ev dmg', html: '⚡ ' + nm(e.from) + ' 的大雷连带：' + nm(e.to) + ' 受 1 点电伤' + (e.kind === 'attack' ? '（其攻击被无效）' : '（被目标攻击）') };
      case 'mirror': return { cls: 'ev pur', html: '🪞 ' + nm(e.pid) + ' 镜面反射：复制 ' + nm(e.from) + ' 的【' + skillName(e.key) + '】→ ' + nm(e.to) };
      case 'mirrorNoEffect': return { cls: 'ev dim', html: '🪞 ' + nm(e.pid) + ' 镜面反射：' + nm(e.from) + ' 本回合' + (e.key ? '的【' + skillName(e.key) + '】' : '无行动') + '无可复制' };
      case 'revive': return { cls: 'ev gold', html: '👻 ' + nm(e.pid) + ' 回魂复活！本回合无限能量' };
      case 'vampire': return { cls: 'ev pur', html: '🧛 ' + nm(e.pid) + ' 觉醒【吸血鬼公爵】：摄魂自愈 2、受光伤 +1' };
      case 'purify': return { cls: 'ev heal', html: '🧼 ' + nm(e.pid) + ' 净化：清除 ' + e.curses + ' 枚符咒与负面状态' };
      case 'curseExpire': return { cls: 'ev dim', html: '🧧 ' + nm(e.pid) + ' 的符咒到期（' + e.n + ' 枚消失）' };
      case 'headshot': return { cls: 'ev dmg', html: '🎯 爆头！' + nm(e.to) + ' 额外 -1' };
      case 'death': return { cls: 'ev dmg', html: '☠ ' + nm(e.pid) + ' 死亡（' + esc(e.reason || '') + '）' };
      case 'mine': return null; // 与 damage 事件重复，跳过
      default: return null;
    }
  }

  /* ---------- 弹层 ---------- */
  function openModal(html, buttons) {
    $('modal-card').innerHTML = html +
      '<div class="btns">' + buttons.map(function (b) {
        return '<button id="mbtn">' + b.label + '</button>';
      }).join('') + '</div>';
    const btns = $('modal-card').querySelectorAll('#mbtn');
    buttons.forEach(function (b, i) { btns[i].onclick = b.fn; });
    $('modal-root').classList.remove('hidden');
  }
  function closeModal() { $('modal-root').classList.add('hidden'); }
  function openOverlay(html, buttons) {
    $('overlay-card').innerHTML = html +
      '<div class="btns" style="display:flex;justify-content:center;gap:10px">' +
      buttons.map(function (b) { return '<button id="obtn">' + b.label + '</button>'; }).join('') + '</div>';
    const btns = $('overlay-card').querySelectorAll('#obtn');
    buttons.forEach(function (b, i) { btns[i].onclick = b.fn; });
    $('overlay-root').classList.remove('hidden');
  }
  function closeOverlay() { $('overlay-root').classList.add('hidden'); }

  /* ---------- Tab ---------- */
  function showTab(which) {
    $('tab-battle').classList.toggle('on', which === 'battle');
    $('tab-train').classList.toggle('on', which === 'train');
    $('page-battle').classList.toggle('hidden', which !== 'battle');
    $('page-train').classList.toggle('hidden', which !== 'train');
    if (which === 'train') { drawChart(); renderChampState(); }
  }

  /* ---------- 训练场 ---------- */
  let lastTrainer = null;
  let stats = { swaps: 0 };
  function renderChampState() {
    const c = Champ.store.load();
    const el = $('tr-has');
    let label = c ? '已保存本地冠军' : '无（困难难度将代打中等逻辑）';
    if (!c && typeof window !== 'undefined' && window.EPIRUS_CHAMPION_META) {
      const m = window.EPIRUS_CHAMPION_META;
      label = '内置冠军 · ' + (m.source || '?') + ' · ' + (m.seeds != null ? m.seeds + '×' : '') + (m.gens != null ? m.gens + '代' : '') + (m.ts ? ' · ' + m.ts : '');
    }
    el.textContent = label;
  }
  function exportTrainCsv() {
    const trainer = (remoteHistory && remoteHistory.length)
      ? { history: remoteHistory, gen: remoteHistory[remoteHistory.length - 1].gen }
      : lastTrainer;
    if (!trainer || !trainer.history || !trainer.history.length) { alert('还没有训练历史可导出（先训练）。'); return; }
    Champ.saveTrainLogCSV(trainer);
  }
  function stopRemote() {
    if (remoteES) remoteES.close();
    remoteES = null; remoteActive = false;
    $('tr-state').textContent = '已断开显示（服务端可能仍在完成本批训练）';
  }
  function resetServerTrain() {
    fetch(remoteBase() + '/reset').then(function (r) { return r.json(); }).then(function () {
      remoteHistory = []; remoteDoneSeeds = {}; stats.swaps = 0;
      $('tr-state').textContent = '服务端已重置（新种子）'; $('tr-progress').style.width = '0%';
      renderSeedStatus(); drawChart();
    }).catch(function () { $('tr-remote').textContent = '重置失败：服务未启动？'; });
  }
  function doEval() {
    const rows = Champ.quickEval(30, Date.now() % 100000);
    if (!rows) { $('tr-evalbox').innerHTML = '<p style="color:var(--red)">还没有冠军可评测，先训练。</p>'; return; }
    renderEval(rows, '评测：冠军 vs 8 脚本基准（各 30 局）');
  }
  function renderEval(rows, title) {
    let h = '<h4 style="margin:12px 0 2px">' + title + '</h4><table class="eval"><tr><th>对手</th><th>胜</th><th>平</th><th>负</th><th>胜率</th></tr>';
    for (const r of rows) {
      h += '<tr><td>' + r.name + '</td><td>' + r.w + '</td><td>' + r.d + '</td><td>' + r.l + '</td><td>' + (r.wr * 100).toFixed(0) + '%</td></tr>';
    }
    h += '</table>';
    $('tr-evalbox').innerHTML = h;
  }

  /* ---------- 远程训练（Node 服务，SSE 实时进度） ---------- */
  let remoteES = null;
  let remoteHistory = [];   // 累积的远程 rec（跨批保留，供 CSV + 曲线）
  let remoteParents = [];   // 本轮各种子的父种子 id（-1=无父代/现有冠军），用于 CSV 的 parent_seed_id
  let remoteActive = false; // 当前是否处于远程训练（画图用）
  let remoteStart = 0;      // 本次批次的起始代（来自 start 事件）
  let remoteDoneSeeds = {}; // 已早停/完成的种子：{seed: {reason, gen, wr}}
  let remoteGens = 500;     // 本次批次要新增的代
  let remoteRetry = null;   // 服务未启动时的自动探测定时器
  function remoteBase() {
    const port = ($('tr-port').value || '8787');
    return 'http://127.0.0.1:' + port;
  }
  // 探测服务是否可达；1.5s 无响应视为未启动（避免 file:// 页连不上时一直"探测中"）
  function fetchProbe(base) {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const tid = setTimeout(function () { if (ctl) ctl.abort(); }, 1500);
    return fetch(base + '/', ctl ? { signal: ctl.signal } : undefined).then(function (r) {
      clearTimeout(tid); return { ok: r.ok };
    }).catch(function () { clearTimeout(tid); return { ok: false }; });
  }
  let remoteN = 2;
  function connectRemoteTrain() {
    const gens = Math.max(1, Number($('tr-remote-gens').value || 500));
    remoteGens = gens;
    const nPlayers = Math.max(2, Math.min(5, parseInt($('tr-n') && $('tr-n').value, 10) || 2));
    remoteN = nPlayers;
    // 多人：每代评估更重（一局有 N 个人），默认种群/局数自动拉高
    const pop = Math.max(6, parseInt($('tr-pop').value, 10) || (nPlayers > 2 ? 32 : 14));
    const gpoIn = Math.max(2, parseInt($('tr-gpo') && $('tr-gpo').value, 10) || (nPlayers > 2 ? 20 : 5));
    const seedsN = Math.max(1, Math.min(8, parseInt($('tr-seeds').value, 10) || 3));
    const roundsN = Math.max(1, Math.min(20, parseInt($('tr-rounds').value, 10) || 1));
    const fresh = $('tr-fresh') && $('tr-fresh').checked;
    const base = remoteBase();
    if (remoteRetry) { clearInterval(remoteRetry); remoteRetry = null; }
    if (remoteES) { remoteES.close(); remoteES = null; }
    stats.swaps = 0;
    remoteHistory = []; remoteDoneSeeds = {};
    $('tr-remote').textContent = '正在探测服务…';
    // 先探测服务是否已启动：未启动则提示双击 launcher 并自动重试（页面上"一键"体验）
    fetchProbe(base).then(function (res) { if (res.ok) openRemote(base, gens, pop, gpoIn, fresh, seedsN, roundsN, nPlayers); else waitForServer(base, gens, pop, gpoIn, fresh, seedsN, roundsN, nPlayers); });
  }
  function waitForServer(base, gens, pop, gpoIn, fresh, seedsN, roundsN, nPlayers) {
    $('tr-remote').textContent = '服务未启动。请双击 tools/start-train-server.cmd 启动（或 node server/train-server.mjs）——检测到后自动连接…';
    if (remoteRetry) clearInterval(remoteRetry);
    remoteRetry = setInterval(function () {
      fetchProbe(base).then(function (res) { if (res.ok) { clearInterval(remoteRetry); remoteRetry = null; openRemote(base, gens, pop, gpoIn, fresh, seedsN, roundsN, nPlayers); } });
    }, 2000);
  }
  function renderSeedStatus() {
    const el = $('tr-seeds-status');
    if (!el) return;
    // 必须按「轮-种子」分组：每轮种子号都会从 0 重新开始，只按 seed 分组会让第二轮之后的行永远不更新
    // （第二轮 gen 从 0 起，永远不大于第一轮的 gen，旧代码的 `r.gen > by[s].gen` 判定直接失效）
    const by = {}, order = [];
    for (const r of remoteHistory) {
      const s = r.seed != null ? r.seed : 0;
      const rd = r.round != null ? r.round : 0;
      const k = rd + '-' + s;
      if (!by[k]) { by[k] = { round: rd, seed: s, gen: -1, best: null, champAge: null, sigma: null, swaps: 0 }; order.push(k); }
      const d = by[k];
      if (r.gen > d.gen) { d.gen = r.gen; d.best = r.best; d.champAge = r.champAge; d.sigma = r.sigma; }
      if (r.champChanged) d.swaps++;
    }
    if (!order.length) { el.innerHTML = ''; return; }
    const maxRound = order.reduce(function (m, k) { return Math.max(m, by[k].round); }, 0);
    const out = [];
    // 历史轮：各压成一行摘要
    for (let rd = 0; rd < maxRound; rd++) {
      const same = order.filter(function (k) { return by[k].round === rd; });
      if (!same.length) continue;
      let best = -1;
      for (const k of same) if (by[k].best != null && by[k].best > best) best = by[k].best;
      out.push('<div style="opacity:.62">第' + (rd + 1) + '轮完成 · ' + same.length + ' 种子 · 最高最优分 ' + (best >= 0 ? best.toFixed(3) : '--') + '</div>');
    }
    // 当前轮：逐种子实时行
    for (const k of order.filter(function (x) { return by[x].round === maxRound; })) {
      const d = by[k], done = remoteDoneSeeds[k];
      const seg = ['第' + (d.round + 1) + '轮 · 种子' + d.seed, '世代' + d.gen,
        (d.best != null ? '最优' + d.best.toFixed(3) : '最优-'),
        '更换' + d.swaps + '次',
        (d.champAge != null ? '蝉联' + d.champAge + '代' : ''),
        (d.sigma != null ? 'σ' + d.sigma.toFixed(3) : '')];
      out.push('<div>' + seg.filter(Boolean).join('  ') + (done ? '  ⚠' + done.reason : '') + '</div>');
    }
    el.innerHTML = out.join('');
  }
  function openRemote(base, gens, pop, gpoIn, fresh, seedsN, roundsN, nPlayers) {
    if (remoteES) { remoteES.close(); remoteES = null; }
    remoteActive = true;
    $('tr-remote').textContent = '连接中…';
    const es = new EventSource(base + '/train?gens=' + gens + '&pop=' + pop + '&gpo=' + gpoIn + (fresh ? '&fresh=1' : '') + '&seeds=' + seedsN + '&rounds=' + roundsN + '&n=' + (nPlayers || 2));
    remoteES = es;
    es.onopen = function () { $('tr-remote').textContent = '已连接，服务端训练中（可切去对战）'; };
    es.onmessage = function (ev) {
      let d = {}; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d.type === 'start' && d.n > 2) {
        remoteStart = 0;
        $('tr-remote').textContent = '多人训练（' + d.n + ' 人）已启动：' + d.gens + ' 代 · 每代 ' + d.pop + ' 个体 · 每人 ' + d.gpo + ' 局 · ' + (d.workers != null ? d.workers + ' 个 worker' : '串行') + (d.fresh ? ' · 从头训练' : ' · 热启动');
      } else if (d.type === 'start') {
        remoteStart = d.fresh ? 0 : (d.from || 0);
        const n = d.seeds || seedsN, rd = d.rounds || roundsN;
        $('tr-remote').textContent = d.fresh
          ? '已重置，从头训练（' + rd + ' 轮 × ' + n + ' 种子，清空旧冠军）'
          : rd + ' 轮 × ' + n + ' 种子（每轮 ' + gens + ' 代），继续精修现有冠军';
      } else if (d.type === 'roundStart') {
        remoteParents = (d.parents || []).map(function (p) { return p && p.seedId != null ? p.seedId : -1; });
        const par = (d.parents && d.parents.length) ? ('｜' + d.parents.map(function (p, i) { return '种子' + i + '←' + ((p && p.label) || '随机'); }).join(' ')) : '';
        $('tr-state').textContent = '第 ' + (d.round + 1) + '/' + d.rounds + ' 轮开始（' + d.seeds + ' 种子 × ' + d.gens + ' 代）' + par;
      } else if (d.type === 'lineage') {
        $('tr-state').textContent = '第 ' + (d.round + 1) + ' 轮种子谱系：' + d.parents.map(function (p, i) { return '种子' + i + '←' + p.label; }).join('  ');
      } else if (d.type === 'gen' && d.n > 2) {
        const r = d.rec;
        remoteHistory.push({ round: 0, seed: 0, parentSeed: -1, gen: r.gen, best: r.best, sigma: r.sigma, baseline: null });
        $('tr-state').textContent = '多人（' + d.n + '人）训练中… 第 ' + r.gen + ' 代 · 1st ' + (r.firstRate * 100).toFixed(0) + '% / top2 ' + (r.top2Rate * 100).toFixed(0) + '%';
        $('tr-progress').style.width = Math.min(100, (r.gen + 1) / gens * 100) + '%';
        renderSeedStatus();
        drawChart();
      } else if (d.type === 'gen') {
        const r = d.rec;
        const sd = d.seed != null ? d.seed : 0;
        const rd = d.round != null ? d.round : 0;
        remoteHistory.push({ round: rd, seed: sd, parentSeed: (remoteParents[sd] != null ? remoteParents[sd] : -1), gen: r.gen, best: r.best, champChanged: r.champChanged, champAge: r.champAge, sigma: r.sigma, baseline: r.baseline });
        if (r.champChanged) stats.swaps++;
        $('tr-state').textContent = '远程训练中… 第 ' + (rd + 1) + ' 轮 · 世代 ' + r.gen;
        $('tr-progress').style.width = Math.min(100, (r.gen - remoteStart) / gens * 100) + '%';
        renderSeedStatus();
        drawChart();   // 实时画多条种子曲线（y 轴自适应，最优分可>1）
      } else if (d.type === 'seedDone') {
        remoteDoneSeeds[(d.round != null ? d.round : 0) + '-' + d.seed] = { reason: d.reason, gen: d.gen, wr: d.wr };
        $('tr-remote').textContent = 'R' + (d.round != null ? d.round : 0) + ' 种子' + d.seed + ' 已早停：' + d.reason + '（第' + d.gen + '代，真实胜率 ' + (d.wr != null ? (d.wr * 100).toFixed(0) + '%' : '--') + '）';
        renderSeedStatus();
      } else if (d.type === 'seedEval') {
        $('tr-state').textContent = '第 ' + ((d.round || 0) + 1) + ' 轮收尾评估… 种子' + d.seed + ' 真实胜率 ' + (d.wr * 100).toFixed(0) + '%';
      } else if (d.type === 'roundDone') {
        const bestSeedTxt = d.bestSeed != null && d.bestSeed >= 0 ? (' 最优=种子' + d.bestSeed) : ' 保留现有冠军';
        $('tr-state').textContent = '第 ' + (d.round + 1) + '/' + d.rounds + ' 轮完成：冠军真实胜率 ' + (d.champWr != null ? (d.champWr * 100).toFixed(0) + '%' : '--') + bestSeedTxt;
      } else if (d.type === 'done' && d.n > 2) {
        $('tr-progress').style.width = '100%';
        $('tr-state').textContent = '多人（' + d.n + '人）训练完成：1st ' + (d.firstRate * 100).toFixed(1) + '% / top2 ' + (d.top2Rate * 100).toFixed(1) + '%（' + d.secs + 's）';
        $('tr-remote').textContent = '多人冠军已写入 js/bundled-champion-3p.js；对局困难档即时生效；再点一次可继续训练';
        remoteActive = false;
        es.close(); remoteES = null;
        if (d.champ) {
          window.EPIRUS_CHAMPION_3P = d.champ;
          try { localStorage.removeItem('epirus.champion3p'); } catch (e) { /* ignore */ }
          resetMultiChampCache();
          renderChampState();
        }
      } else if (d.type === 'done') {
        $('tr-progress').style.width = '100%';
        const bestSeedTxt = d.bestSeed != null && d.bestSeed >= 0 ? (' 最优=种子' + d.bestSeed) : ' 保留现有冠军';
        $('tr-state').textContent = '远程训练完成：' + (d.rounds || roundsN) + ' 轮 × ' + (d.seeds || seedsN) + ' 种子 (' + d.secs + 's)，冠军真实胜率 ' + (d.champWr != null ? (d.champWr * 100).toFixed(0) + '%' : '--') + bestSeedTxt;
        $('tr-remote').textContent = '训练完成（' + (d.rounds || roundsN) + ' 轮 × ' + (d.seeds || seedsN) + ' 种子' + bestSeedTxt + '），冠军已写入 js/bundled-champion.js；再点一次可继续训练';
        remoteActive = false;
        es.close(); remoteES = null;
        // 把冠军拉进内存，困难档无需刷新即可生效
        fetch(base + '/champion').then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.champion) {
            window.EPIRUS_CHAMPION = j.champion;
            try { localStorage.removeItem('epirus.champion.v3'); } catch (e) { /* ignore */ }
            renderChampState();
            $('tr-remote').textContent = '冠军已载入内存（困难档即时生效；刷新页面可持久化到内置文件）；再点一次可继续训练';
          }
        });
      } else if (d.type === 'error') { $('tr-remote').textContent = '服务错误：' + d.msg; }
    };
    es.onerror = function () {
      remoteActive = false;
      $('tr-remote').textContent = '连接中断。请确认服务仍在运行（tools/start-train-server.cmd）。';
      es.close(); remoteES = null;
    };
  }

  /* ---------- 图表 ---------- */
  function drawChart() {
    const cv = $('chart');
    if (!cv || $('page-train').classList.contains('hidden')) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = 220;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    let hist = null;
    if (remoteHistory.length) hist = remoteHistory;
    else if (lastTrainer && lastTrainer.history && lastTrainer.history.length)
      hist = lastTrainer.history.map(function (r) { return { seed: 0, gen: r.gen, best: r.best, baseline: r.baseline }; });
    if (!hist || !hist.length) { g.fillStyle = '#8b93c4'; g.font = '13px sans-serif'; g.fillText('训练历史将显示在此，连接远程训练或先训练一次', 16, h / 2); return; }
    // 按「轮-种子」分组：每轮种子号都从 0 重新开始，只按 seed 分组会把各轮曲线首尾相接成锯齿
    const bySeries = {}, keys = [];
    for (const r of hist) {
      const s = r.seed != null ? r.seed : 0;
      const rd = r.round != null ? r.round : 0;
      const k = rd + '-' + s;
      if (!bySeries[k]) { bySeries[k] = { round: rd, seed: s, arr: [] }; keys.push(k); }
      bySeries[k].arr.push(r);
    }
    keys.sort(function (a, b) { return bySeries[a].round - bySeries[b].round || bySeries[a].seed - bySeries[b].seed; });
    const pad = 38;
    let maxV = 1;
    for (const k of keys) for (const r of bySeries[k].arr) if (r.best > maxV) maxV = Math.ceil(r.best * 100) / 100;
    if (!(maxV > 0)) maxV = 1;
    // x 轴按「轮」连续推进：第 N 轮的曲线接在第 N-1 轮右侧（不再各自从 0 起、叠在旧图上）
    let genMax = 0, roundMax = 0;
    for (const k of keys) {
      const s = bySeries[k];
      if (s.round > roundMax) roundMax = s.round;
      for (const r of s.arr) if (r.gen > genMax) genMax = r.gen;
    }
    const stride = genMax + 1;
    const span = Math.max(1, (roundMax + 1) * stride - 1);
    const X = function (rd, gen) { return pad + (w - pad * 2) * ((rd * stride + gen) / span); };
    const Y = function (v) { return h - 20 - (h - 44) * Math.max(0, Math.min(maxV, v)) / maxV; };
    g.strokeStyle = '#2c3560'; g.beginPath();
    for (let x = pad; x <= w - pad; x += 60) { g.moveTo(x, 10); g.lineTo(x, h - 20); }
    g.stroke();
    // 轮分界线 + 轮号（每轮一段横向区间）
    g.setLineDash([4, 4]);
    for (let rd = 1; rd <= roundMax; rd++) {
      const x = X(rd, 0);
      g.strokeStyle = '#3d4a7d'; g.beginPath(); g.moveTo(x, 10); g.lineTo(x, h - 20); g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = '#8b93c4'; g.font = '11px sans-serif';
    for (let rd = 0; rd <= roundMax; rd++) {
      const x = X(rd, 0);
      g.fillStyle = '#6f7aa8'; g.fillText('R' + (rd + 1), x + 3, h - 6);
    }
    g.strokeStyle = '#8b93c4'; g.font = '11px sans-serif';
    g.fillText(maxV.toFixed(2), 4, Y(maxV) + 4); g.fillText((maxV / 2).toFixed(2), 4, Y(maxV / 2) + 4); g.fillText('0', 4, Y(0) + 4);
    g.fillText('上限 ' + maxV.toFixed(2), w - 62, 14);
    const COLORS = ['#5ad0ff', '#ff8fa3', '#7be08a', '#ffc94d', '#c39bff', '#7fd7ff', '#ff9f6b', '#9be0c3'];
    keys.forEach(function (k, si) {
      const ser = bySeries[k], arr = ser.arr, color = COLORS[si % COLORS.length];
      g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
      arr.forEach(function (r, i) { const x = X(ser.round, r.gen), y = Y(r.best); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      g.fillStyle = color;
      arr.forEach(function (r) { if (r.baseline != null) g.fillRect(X(ser.round, r.gen) - 2, Y(r.baseline) - 2, 3, 3); });
    });
    g.fillStyle = '#8b93c4'; g.font = '11px sans-serif';
    const shown = keys.length > 8 ? keys.slice(keys.length - 8) : keys;
    const lg = (keys.length > 8 ? '… ' : '') + shown.map(function (k) { return 'R' + (bySeries[k].round + 1) + 's' + bySeries[k].seed; }).join(' ');
    g.fillText('各轮种子最优分曲线（' + lg + '；点=对基线真实胜率）', pad, 12);
  }

  /* ---------- 导出/导入 ---------- */
  function exportChamp() {
    const c = Champ.store.load();
    if (!c) { alert('还没有冠军可导出'); return; }
    const blob = new Blob([Champ.store.exportJSON(c)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'epirus-champion.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function importChamp(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = function () {
      const r = Champ.store.importJSON(String(rd.result));
      if (!r.ok) {
        alert('导入失败：' + champReasonText(r.reason, r));
        return;
      }
      Champ.store.save(r.policy);
      renderChampState();
      alert('冠军策略导入成功，可用于“困难·冠军”难度。');
    };
    rd.readAsText(file);
  }
  // 冠军包不兼容原因 → 中文提示
  function champReasonText(reason, info) {
    info = info || {};
    const want = info.want != null ? ('应为 ' + info.want) : '';
    const got = info.got != null ? ('实际 ' + info.got + '，') : '';
    switch (reason) {
      case 'version': return '版本不符（' + got + want + '），可能是旧版策略网络训练的冠军';
      case 'length': return '权重长度不符（' + got + want + '），旧版 1177≠新版 1633，无法复用';
      case 'feature': return '状态特征维度不符（' + got + want + '）';
      case 'hidden': return '隐藏层维度不符（' + got + want + '）';
      case 'no-version': return '缺少版本号，无法确认是否兼容';
      case 'parse-error': return 'JSON 解析失败';
      default: return '不是有效的冠军 JSON（' + (reason || 'unknown') + '）';
    }
  }
  function resetChamp() {
    openModal('<h3>确定清空本地冠军策略？</h3><p style="color:var(--dim);font-size:13px">之后“困难”难度将代打中等逻辑，直到重新训练或导入。</p>', [
      { label: '取消', fn: closeModal },
      { label: '清空', fn: function () { closeModal(); Champ.store.clear(); renderChampState(); } }
    ]);
  }

  /* v1.4.0：人数 ↔ 可用模式的一致性。
   * 2 人：只能用 standard；3-5 人：只能用 multi(3血) / long(5血)。
   * 用 option.disabled 而不是整体禁掉下拉 —— 否则 3 人局永远只能 3 血。 */
  function syncModeOptions() {
    const sel = $('sel-mode');
    if (!sel) return;
    const multi = (B.players || 2) > 2;
    for (let i = 0; i < sel.options.length; i++) {
      const isMulti = MULTI_MODES.indexOf(sel.options[i].value) >= 0;
      sel.options[i].disabled = multi ? !isMulti : isMulti;
    }
    if (multi && MULTI_MODES.indexOf(B.modeKey) < 0) B.modeKey = 'multi';
    if (!multi && MULTI_MODES.indexOf(B.modeKey) >= 0) B.modeKey = 'standard';
    sel.value = B.modeKey;
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $('tab-battle').onclick = function () { showTab('battle'); };
    $('tab-train').onclick = function () { showTab('train'); };
    $('sel-mode').onchange = function () { B.modeKey = $('sel-mode').value; newGame(); };
    syncModeOptions();   // 首屏同步一次
    $('btn-lastlog').onclick = showLastBattle;
    $('sel-players').onchange = function () {
      B.players = parseInt($('sel-players').value, 10) || 2;
      syncModeOptions();   // v1.4.0：3-5 人时把"标准"置灰、放开 multi/long 的选择
      syncDiffOptions();
      newGame();
    };
    $('sel-diff').onchange = function () { B.diff = $('sel-diff').value; hint('难度已切换：' + diffName(B.diff) + '（对局中即时生效）'); };
    $('btn-newgame').onclick = newGame;
    $('btn-undo').onclick = undo;
    $('btn-exportlog').onclick = exportLog;
    $('btn-train').onclick = connectRemoteTrain;
    $('btn-stop').onclick = stopRemote;
    $('btn-eval').onclick = doEval;
    $('btn-export').onclick = exportChamp;
    $('btn-reset').onclick = resetChamp;
    $('btn-train-csv').onclick = exportTrainCsv;
    $('btn-remote').onclick = resetServerTrain;
    $('file-import').onchange = function (ev) { importChamp(ev.target.files && ev.target.files[0]); ev.target.value = ''; };
    window.addEventListener('resize', function () { drawChart(); });
  }

  /* logbox 注入到 DOM（index.html 中 .logbox 属于电脑侧栏） */
  function ensureLog() {
    if ($('logbox')) return;
    const side1 = $('side-1');
    const box = document.createElement('div');
    box.className = 'logbox'; box.id = 'logbox';
    side1.appendChild(box);
  }

  bind();
  newGame();
  renderChampState();
  // P1：若加载时发现并清除了“旧架构/不兼容”的**本地**冠军，提示一次（内置冠军不兼容属于版本升级正常现象，不弹窗）
  const why0 = Champ.store.lastInvalidReason;
  if (why0 && why0.indexOf('builtin-') !== 0) {
    const why = champReasonText(why0);
    if (why) setTimeout(function () { alert('检测到旧版/不兼容的本地冠军，已自动清除：' + why); }, 300);
  }
})();
