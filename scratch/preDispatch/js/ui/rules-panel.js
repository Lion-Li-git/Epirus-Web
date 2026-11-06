/* rules-panel.js —— 对局页内的「规则说明」栏（v1.8.1 · 玩家向）
 * 读引擎常量渲染桌子/技能/难度表；其余是给人看的规则正文（不写裁定号、不写改动史）。
 * 由 ui.js 的 showTab('rules') 调 EpirusRulesPanel.render()。 */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var CAT = { energy: '能量', attack: '攻击', defense: '防御', special: '特殊' };
  var TGT = { self: '自己', enemy: '其他玩家', other: '其他玩家（受益者）' };
  function qa(q, a) { return '<div class="qa"><b>Q：' + q + '</b><br>' + a + '</div>'; }
  function renderModes(R) {
    var el = document.getElementById('rules-modes'); if (!el) return;
    var t = '<table><tr><th>桌型</th><th>初始血量</th><th>回合上限</th><th>终局收缩</th></tr>';
    var sd = R.SUDDEN_DEATH;
    var g = { 3: R.MAX_ROUNDS, 4: R.MAX_ROUNDS, 5: 140 };
    [3, 4, 5].forEach(function (hp) {
      var maxR = g[hp];
      var sdShow = sd >= maxR ? '不触发（回合上限先结束）' : ('第 ' + sd + ' 回合起，每回合末全员 -1');
      var label = hp === 5 ? '2~5 人 · 5 血（长程）' : ('2~5 人 · ' + hp + ' 血');
      t += '<tr><td><b>' + label + '</b></td><td>' + hp + '</td><td>' + maxR + '</td><td>' + sdShow + '</td></tr>';
    });
    el.innerHTML = t + '</table><p class="src">终局收缩的起点可以在对局设置里改；默认值下只有 5 血长程桌会在上限前进入收缩。</p>';
  }
  function renderSkills(R) {
    var el = document.getElementById('rules-skills'); if (!el) return;
    var t = '<table><tr><th>技能</th><th>类别</th><th>费用</th><th>优先级</th><th>目标</th><th>作用</th><th>多人</th></tr>';
    R.skills.forEach(function (s) {
      var cost = (s.cost == null || s.cost === '') ? '—（非固定）' : esc(s.cost);
      var needs = s.energyNeeds || {};
      var bead = Object.keys(needs).map(function (k) { return '＋' + needs[k] + ' ' + (k === 'elec' ? '电珠' : k === 'boom' ? '爆珠' : k); }).join(' ');
      t += '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(CAT[s.cat] || '') + '</td><td>' + cost + (bead ? '<br><span class="src">' + bead + '</span>' : '') + '</td><td>' + esc(s.pri) + '</td><td>' + esc(TGT[s.target] || '') + '</td><td>' + esc(s.desc || '') + '</td><td>' + ((R.MULTI_ONLY || []).indexOf(s.key) >= 0 ? '多人' : '') + '</td></tr>';
    });
    el.innerHTML = t + '</table>';
  }
  function renderTiers(B) {
    var el = document.getElementById('rules-tiers'); if (!el || !B) return;
    var play = { 'lv:sparring': '更常试新招，适合熟悉规则', 'lv:regular': '正常发挥（默认）', 'lv:hard': '几乎每手取最优，最难看穿' };
    var who = function (x) {
      if (x.poolMix) return '整个冠军池按力度加权抽';
      if (x.pool === 'soft') return '最弱一批冠军' + (x.scriptMix ? '，另掺脚本对手' : '');
      if (x.pool === 'hard') return '最强一批冠军';
      return '';
    };
    var t = '<table><tr><th>难度</th><th>对手从哪来</th><th>说明</th></tr>';
    (B.DIFF_TIERS || []).forEach(function (x) { t += '<tr><td><b>' + esc(x.name) + '</b></td><td>' + esc(who(x)) + '</td><td>' + esc(play[x.id] || '') + '</td></tr>'; });
    el.innerHTML = t + '</table>';
  }
  function renderStyles(B) {
    var el = document.getElementById('rules-styles'); if (!el || !B) return;
    var t = '<table><tr><th>风格</th><th>打法</th></tr>';
    var hand = { 'st:aggro': '一有机会就压血，节奏快', 'st:breakdef': '先攒能量，等大牌', 'st:reflectmix': '爱用反弹与连招，出招有节奏', 'st:combocounter': '读你最近几次出招再反制', 'st:toolkit': '爱用低性价比卡与冷门卡', 'st:mix': '什么都用一点，不押单一套路' };
    (B.STYLES || []).forEach(function (x) {
      t += '<tr><td><b>' + esc(x.name) + '</b></td><td>' + esc(hand[x.id] || '') + '</td></tr>';
    });
    el.innerHTML = t + '</table>';
  }
  function render() {
    var box = document.getElementById('rules-body'); if (!box) return;
    var R = window.EpirusRules, B = window.EpirusBots;
    if (!R || !R.skills) { box.innerHTML = '<p>规则数据没加载成功，请刷新页面。</p>'; return; }
    var h = '';
    h += '<h2>怎么玩</h2><p>2~5 人对战：每人每回合同时选一个技能和一个目标，一起结算；活到最后的人赢。人数和血量是两根独立的轴——2~5 人都能配 3/4/5 血；4 血主要多一格血，5 血（长程）回合上限更长、会进入终局收缩。</p>';
    h += '<h2>一回合怎么走</h2><ol>';
    h += '<li><b>同时选招</b>：所有人各选一个技能和目标（架势、自增益类不用选目标）。</li>';
    h += '<li><b>按优先级结算</b>：5 → 4 → 3 → 2 → 1；同一优先级同时生效。</li>';
    h += '<li><b>相抵只在互为目标时发生</b>：两家同时打同一个第三人，两击都落地。</li>';
    h += '<li><b>目标</b>：攻击/负面技能必须指名活人；目标中途死了，这一击落空；双枪射手要选两个不同的人。</li>';
    h += '<li><b>回合末</b>：结算死亡、挑衅义务、符咒、禁用回合数。</li>';
    h += '</ol>';
    h += '<h2>怎么算赢</h2><p>最后一名存活者获胜；同一回合全员倒下算平局（有回魂例外）。打满回合上限则比剩余血量，并列才平局；如果全员同时倒下，累计造成伤害最多者胜。过了终局收缩起点后，每回合末所有存活者各扣 1 血——拖时间不是免费的。</p>';
    h += '<h2>桌子参数</h2><p class="src">按本程序实际配置现读。</p><div id="rules-modes"></div>';
    h += '<h2>技能表</h2><p>费用单位是 ジ（能量）；“—”表示费用不固定（按第几次使用变价，见“作用”）。有些牌还要蓄能珠（电珠/爆珠）。标“多人”的牌只能在 3 人以上使用。</p><div id="rules-skills"></div>';
    h += '<h2>常见问题</h2>';
    h += qa('小雷（雷击之枪）挡什么？', '无效化目标本回合的<b>攻击类</b>行动，不阻止防御/架势。三家小雷连成环时整环作废；最基础的防御、反弹、原型制御不吃小雷。');
    h += qa('大雷（真正的落雷）为什么最重？', '5 ジ，2 点电伤 + 禁用目标正在用的技能 4 回合 + 非防御类技能无效化；与本回合目标交互过的第三方也吃 2 点电伤与 3 回合禁用。防御类可以挡下这 2 点电。');
    h += qa('全息屏障是给自己套盾吗？', '不是，是给<b>其他玩家</b>套盾，被套者获得原型制御式架势。想拆盾要去打施放者。');
    h += qa('反弹能把大雷弹回去吗？', '不能，雷电不被反弹；防御、金刚盾、原型制御可以挡。反弹族弹的是技能伤害。');
    h += qa('挑衅有什么强制力？', '被挑衅者下回合必须使出一个攻击类技能，否则回合末扣 1 血；多人桌可以同时压多个目标。');
    h += qa('铁索连环会一直连着吗？', '不会。同一回合互用摄魂指法才连上，连上后受伤会传给直接相连者（同量同类型、不再递归），共享过一次立刻解除，要再连得重新互勾。');
    h += qa('地雷是范围伤害吗？', '是。被攻击引爆没有次数上限；因吃到地雷伤害而引爆的会合并成一次伤害。地雷伤害没有来源，不被铁索共享、不被转移。');
    h += qa('激光眼能一发破掉整套防御吗？', '能。单个激光眼即可让目标本回合所有防御类失效并转移伤害。');
    h += qa('回魂复活那回合能随便放技能吗？', '只免花费、不免条件：需要蓄能珠或前置状态的技能仍要满足条件。被挑衅者死亡不会复活，反而给施放者挂梦魇。');
    h += '<h2>难度与风格</h2><p>难度由两件事一起决定：<b>桌上坐的是哪一批冠军</b>（冠军池按力度分带，简单档从最弱一批抽、困难档只从最强一批抽、普通档按力度加权抽），以及这枚冠军每手给多少“发挥空间”（越简单越常试新招）。简单档还会额外掺入脚本对手；2 人桌换用专门为 1v1 训的 2P 冠军池。风格只是口味，不排强弱。</p><div id="rules-tiers"></div><div id="rules-styles"></div>';
    box.innerHTML = h;
    renderModes(R); renderSkills(R); renderTiers(B); renderStyles(B);
  }
  window.EpirusRulesPanel = { render: render };
})();
