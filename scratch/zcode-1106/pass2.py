# -*- coding: utf-8 -*-
# 刀2：倾向滑杆 + H5 提示/明细替换 + 标尺 UI 撤除 + 去重 T + 断言更新
import io
p = 'champion-map/viewer.mjs'
t = io.open(p, encoding='utf-8', newline='').read()
def rep(a, b):
    global t
    assert a in t, '锚点没中: ' + a[:60]
    t = t.replace(a, b, 1)

# A) st.wTilt + 派生函数
rep("  ruler: 'exam4', w2: 0.15, w3: 0.25, w5: 0.45, w8: 0.15,",
    "  wTilt: 0.5,   /* 统一权重参数（用户令）：0 = 最倾向 2P/3P ‖ 0.5 = 现状（15/25/45/15）‖ 1 = 最倾向 5P/8P；w2..w8 由 deriveW 派生 */\n"
    "  w2: 0.15, w3: 0.25, w5: 0.45, w8: 0.15,")
rep("function FKEY() { return st.T.toFixed(4) + '#wt' + st.wTilt + '#' + st.ftab; }",
    "function FKEY() { return st.T.toFixed(4) + '#wt' + st.wTilt + '#' + st.ftab; }\n"
    "/* 统一权重：三锚点分段线性（各锚点权重和 = 1 ⇒ 任意 tilt 下和恒 1） */\n"
    "function deriveW(tilt) {\n"
    "  var L = [0.45, 0.35, 0.15, 0.05], C = [0.15, 0.25, 0.45, 0.15], R = [0.05, 0.15, 0.45, 0.35];\n"
    "  var A = tilt <= 0.5 ? L : C, Bv = tilt <= 0.5 ? C : R, f = tilt <= 0.5 ? tilt * 2 : (tilt - 0.5) * 2;\n"
    "  return A.map(function (v, i) { return v + (Bv[i] - v) * f; });\n"
    "}\n"
    "function applyW(tilt) { var w = deriveW(tilt); st.w2 = w[0]; st.w3 = w[1]; st.w5 = w[2]; st.w8 = w[3]; }")

# B) 行定位：标尺下拉撤 + tunebox 里的 T 行换成倾向滑杆 + weightrow 行删
lines = t.split('\n')
ri = next(i for i, l in enumerate(lines) if 'id="rulerrow"' in l)
del lines[ri]
ti = next(i for i, l in enumerate(lines) if 'id="tunebox"' in l)
tlabel = next(i for i, l in enumerate(lines) if i > ti and '<label>T <input' in l)
wrow = next(i for i, l in enumerate(lines) if i > ti and 'id="weightrow"' in l)
lines[tlabel] = '  \'<label title="统一权重：最左 = 最倾向 2P/3P ‖ 最右 = 最倾向 5P/8P ‖ 中 = 出厂（15/25/45/15）">倾向 2P/3P ←→ 5P/8P <input type="range" id="wt" min="0" max="1" step="0.01" value="0.5"><span id="wtv">0.50</span></label>\' +'
del lines[wrow]
t = '\n'.join(lines)

# C) 监听替换
rep("""(function () {
  var NS = [2, 3, 5, 8];
  for (var i = 0; i < NS.length; i++) (function (n) {
    var el = document.getElementById('w' + n);
    el.addEventListener('input', function () { st['w' + n] = +el.value;
      document.getElementById('w' + n + 'v').textContent = (+el.value).toFixed(2);
      var ws = document.getElementById('wstr'); if (ws) ws.textContent = WSTR();
      recomputeVIS(); paintWin(); req(); });
  })(NS[i]);
  var rs = document.getElementById('ruler');
  if (rs) rs.addEventListener('change', function () { st.ruler = rs.value; recalcRank();
    recomputeVIS(); paintWin(); req(); });
  var tt0 = document.getElementById('tunetoggle'), tb0 = document.getElementById('tunebox');
  if (tt0 && tb0) tt0.addEventListener('click', function () {
    var on = tb0.style.display === 'none'; tb0.style.display = on ? 'inline' : 'none';
    tt0.innerHTML = '细调 <span id="wstr">' + WSTR() + '</span> ' + (on ? '▾' : '▸'); });
  var ws0 = document.getElementById('wstr'); if (ws0) ws0.textContent = WSTR();
})();""",
    """(function () {
  var wt = document.getElementById('wt');
  wt.addEventListener('input', function () { st.wTilt = +wt.value; applyW(st.wTilt);
    document.getElementById('wtv').textContent = (+wt.value).toFixed(2);
    var ws = document.getElementById('wstr'); if (ws) ws.textContent = WSTR();
    recomputeVIS(); paintWin(); req(); });
  var tt0 = document.getElementById('tunetoggle'), tb0 = document.getElementById('tunebox');
  if (tt0 && tb0) tt0.addEventListener('click', function () {
    var on = tb0.style.display === 'none'; tb0.style.display = on ? 'inline' : 'none';
    tt0.innerHTML = '细调 <span id="wstr">' + WSTR() + '</span> ' + (on ? '▾' : '▸'); });
  var ws0 = document.getElementById('wstr'); if (ws0) ws0.textContent = WSTR();
})();""")

# D) H4STR 助手 + 提示/明细换四格值
rep("function WSTR() { return '2P:' + Math.round(st.w2 * 100) + ' 3P:' + Math.round(st.w3 * 100) + ' 5P:' + Math.round(st.w5 * 100) + ' 8P:' + Math.round(st.w8 * 100); }",
    "function WSTR() { return '2P:' + Math.round(st.w2 * 100) + ' 3P:' + Math.round(st.w3 * 100) + ' 5P:' + Math.round(st.w5 * 100) + ' 8P:' + Math.round(st.w8 * 100); }\n"
    "/* 当前桌的四格夺1率串（由 excess 反解 p = X·(1−1/N)+1/N）；缺格 = – */\n"
    "function H4STR(d) { var L = (st.ftab === 'long') ? 'L' : '';\n"
    "  return st.NS4.map(function (n) { var x = d['X' + n + L];\n"
    "    return (x === null || x === undefined || !isFinite(x)) ? '–' : ((x * (1 - 1 / n) + 1 / n) * 100).toFixed(1); }).join('/'); }")
rep("      ' ‖ F ' + Ftxt(d) + ' ‖ Hp5(参照) ' + d.Hp5.toFixed(1);",
    "      ' ‖ F ' + Ftxt(d) + ' ‖ 四格 h2/h3/h5/h8 ' + H4STR(d);")
rep("      '\\\\nH5考卷(参照) ' + (d.H5 == null ? '未测' : d.H5.toFixed(1)) + ' ‖ S ' + d.S.toFixed(2) + ' ‖ Δε ' + (d.De5 == null ? '未测' : (d.De5 >= 0 ? '+' : '') + d.De5.toFixed(1));",
    "      '\\nS ' + d.S.toFixed(2) + ' ‖ ' + H4STR(d);")
rep("    row('Hp5 页面（参照）', function (d) { return d.Hp5.toFixed(1); });\n"
    "    row('H 考卷', function (d) { return d.H5 == null ? '未测' : d.H5.toFixed(1); });\n"
    "    row('Δε5（参照）', function (d) { return d.De5 == null ? '未测' : (d.De5 >= 0 ? '+' : '') + d.De5.toFixed(1); });",
    "    row('四格夺1率（当前桌）', function (d) { return H4STR(d); });")

# E) PROF 参照行撤
rep("var PROF = [['Hp5', 'Hp5 页面夺1（参照）', '%'], ['H5', 'H5 考卷夺1（参照）', '%'], ['De5', 'Δε5 单批（参照）', 'sgn'], ['de', 'Δε 两seed', 'sgn'],\n  ['Ge', '广度', 'f2'],",
    "var PROF = [['Ge', '广度', 'f2'],")

# F) 谱系 tooltip 长程 H5 段 → 长程四格串
rep("""    (d.hpl2 === null ? '\\\\n长程桌 未量' : '\\\\n长程桌 ' + d.hl2.toFixed(1) + '% ‖ 页面 ' + d.hpl2.toFixed(1) + '% ‖ F ' + Fl(d).toFixed(2)
      + (isFinite(d.Hp5) ? '（ΔHp ' + (d.hpl2 - d.Hp5 >= 0 ? '+' : '') + (d.hpl2 - d.Hp5).toFixed(1) + 'pt）' : '')) +""",
    "    '\\n长程四格 h2/h3/h5/h8 ' + (function () { var o = []; for (var i = 0; i < 4; i++) { var n = [2, 3, 5, 8][i], x = d['X' + n + 'L']; o.push((x === null || x === undefined || !isFinite(x)) ? '–' : ((x * (1 - 1 / n) + 1 / n) * 100).toFixed(1)); } return o.join('/'); })() +")

# G) 1D 三处
rep("g.fillText('纵轴 = F = Hp5 + T·S（Hp5 = 线上口径夺1率·参照 · F 越高越好）：'",
    "g.fillText('纵轴 = F = X̄₄ + T·S（X̄₄ = 四格加权 excess · F 越高越好）：'")
rep("""    var hNow = hpNow(d);   /* §E672 分解条必须拆**当下这一档的 F**：原来两档都拆 Hp5 ⇒ 长程档那两条加起来不等于点所在的那个 F */
    /* 11-07 exam4 尺：蓝条 = X̄₄（四格加权 excess，可为负 ⇒ 钳 0 画，精确值在提示行）；ref 尺照旧 = Hp5/100 */
    var hh = (st.ruler === 'exam4') ? Math.max(0, X4(d) || 0) : ((hNow === null || !isFinite(hNow)) ? d.Hp5 : hNow) / 100,
      ss = st.T * d.S, tot = hh + Math.abs(ss) || 1;""",
    """    /* 11-07 exam4 单尺：蓝条 = X̄₄（四格加权 excess，可为负 ⇒ 钳 0 画，精确值在提示行） */
    var hh = Math.max(0, X4(d) || 0), ss = st.T * d.S, tot = hh + Math.abs(ss) || 1;""")
rep("g.fillText('一维：位置 = ' + (st.sortBy === 'time' ? '训出时刻' : (st.ftab === 'long' && st.ruler !== 'exam4' ? '长程桌 F 名次' : 'F 名次')) + '（下方蓝条 = ' + (st.ruler === 'exam4' ? 'X̄₄ 四格加权 excess（' + WSTR() + '）' : (st.ftab === 'long' ? 'Hplong5 长程桌夺1率(参照)' : 'Hp5 线上口径夺1率(参照)')) + '，黄条 = T·S）· 悬停看明细 · 点一枚 = 选中（点空白取消）· 点家族图例可高亮', pad, h - 14 * devicePixelRatio);",
    "g.fillText('一维：位置 = ' + (st.sortBy === 'time' ? '训出时刻' : (st.ftab === 'long' ? '长程桌 F 名次' : 'F 名次')) + '（下方蓝条 = X̄₄ 四格加权 excess（' + WSTR() + '），黄条 = T·S）· 悬停看明细 · 点一枚 = 选中（点空白取消）· 点家族图例可高亮', pad, h - 14 * devicePixelRatio);")

io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('刀2（上半）完成')
