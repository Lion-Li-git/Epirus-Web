# -*- coding: utf-8 -*-
# 刀3：底图位图层 fk 维（用户：底图跟随没成功——§E623 位图判定八项里没有权重/尺）+ 去重 T + 小标签短/长程+加权差
import io
p = 'champion-map/viewer.mjs'
t = io.open(p, encoding='utf-8', newline='').read()
def rep(a, b):
    global t
    NL = chr(10)
    a2 = a.replace(NL, chr(13) + NL)   # 混合换行兜底：CRLF 文件上 LF 锚也能中
    if a in t: t = t.replace(a, b, 1)
    elif a2 in t:
        b2 = b.replace(NL, chr(13) + NL)
        t = t.replace(a2, b2, 1)
    else: raise AssertionError('锚点没中: ' + a[:60])

# 1) buildBitmap 重建判据补 fk（位图层的内容吃 Fv ⇒ Fv 的每个自由度都要在键里，§E623 同族第 N 次）
rep("  if (!FL || FL.key !== k2 || FL.tv !== st.T || FL.bgc !== st.bg || FL.col !== st.color || FL.tab !== st.ftab || FL.cov !== COV_MED || FL.vis !== visSig) buildBitmap(k2, visSig);",
    "  /* 11-07 晚：fk（尺/T/权重/桌形）是第九项 —— 用户实测\"底图颜色跟随并没有成功\"：ISO 场层修了，\n"
    "   *   位图层（这一层）的判定漏了权重维 ⇒ 拖倾向滑杆底图纹丝不动。Fv 的每个自由度都必须在键里（§E617 总规矩）。 */\n"
    "  if (!FL || FL.key !== k2 || FL.tv !== st.T || FL.bgc !== st.bg || FL.col !== st.color || FL.tab !== st.ftab || FL.cov !== COV_MED || FL.vis !== visSig || FL.fk !== FKEY()) buildBitmap(k2, visSig);")
rep("  FL = { c: c, px: dta, img: img, cg: cg, cix: CIX9, alp: ALP9, key: key, tv: st.T, bgc: st.bg, col: st.color, tab: st.ftab, cov: COV_MED,",
    "  FL = { c: c, px: dta, img: img, cg: cg, cix: CIX9, alp: ALP9, key: key, tv: st.T, bgc: st.bg, col: st.color, tab: st.ftab, cov: COV_MED, fk: FKEY(),")

# 2) 去重 T：HEAD（7719ba9b）已完成（tunebox 的 T 已换倾向滑杆，工具栏只剩一根）⇒ 本条作废

# 3) X̄₄ 按桌形参数化：X4T(d, L)；X4(d) = 当前桌
rep("""function X4(d) {
  /* 11-07 长程批并入：四格卷也有桌形维（multi=3血短程 ‖ long=5血长程），列名带 L 后缀 ⇒ Fv 的桌形自由度回来了 */
  var L = (st.ftab === 'long') ? 'L' : '', sw = 0, acc = 0;
  for (var i = 0; i < st.NS4.length; i++) { var n = st.NS4[i], x = d['X' + n + L];
    if (x !== null && x !== undefined && isFinite(x) && d['n' + n + L]) { acc += st['w' + n] * x; sw += st['w' + n]; } }
  return sw > 0 ? acc / sw : null;
}""",
    """function X4T(d, L) {
  /* 11-07 长程批并入：四格卷也有桌形维（multi=3血短程 ‖ long=5血长程），列名带 L 后缀 ⇒ Fv 的桌形自由度回来了 */
  var sw = 0, acc = 0;
  for (var i = 0; i < st.NS4.length; i++) { var n = st.NS4[i], x = d['X' + n + L];
    if (x !== null && x !== undefined && isFinite(x) && d['n' + n + L]) { acc += st['w' + n] * x; sw += st['w' + n]; } }
  return sw > 0 ? acc / sw : null;
}
function X4(d) { return X4T(d, (st.ftab === 'long') ? 'L' : ''); }""")

# 4) H4STR 按桌形参数化（缺省 = 当前桌）
rep("""function H4STR(d) { var L = (st.ftab === 'long') ? 'L' : '';
  return st.NS4.map(function (n) { var x = d['X' + n + L];
    return (x === null || x === undefined || !isFinite(x)) ? '–' : ((x * (1 - 1 / n) + 1 / n) * 100).toFixed(1); }).join('/'); }""",
    """function H4STR(d, L) { L = (L === undefined) ? ((st.ftab === 'long') ? 'L' : '') : L;
  return st.NS4.map(function (n) { var x = d['X' + n + L];
    return (x === null || x === undefined || !isFinite(x)) ? '–' : ((x * (1 - 1 / n) + 1 / n) * 100).toFixed(1); }).join('/'); }
function X4F(d, L) { var x = X4T(d, L); return (x === null || !isFinite(x)) ? '未测' : x.toFixed(3); }
function X4D(d) { var a = X4T(d, ''), b = X4T(d, 'L');
  return (a === null || b === null || !isFinite(a) || !isFinite(b)) ? '未测' : ((b - a >= 0 ? '+' : '') + (b - a).toFixed(3)); }""")

# 5) 地图/对比卡 tooltip：短程 + 长程 + 加权差 全显示（用户：只显示长程、没有加权差）
rep("""      '\\\\n名次 第 ' + d.rk + ' ‖ X̄₄(新标尺) ' + (X4(d) === null ? '未测' : X4(d).toFixed(3)) + (X4miss(d).length ? '（缺N:' + X4miss(d).join(',') + '）' : '') + ' ‖ 权重 ' + WSTR() +
      '\\\\nS ' + d.S.toFixed(2) + ' ‖ ' + H4STR(d);""",
    """      '\\\\n名次 第 ' + d.rk + ' ‖ 权重 ' + WSTR() +
      '\\\\n短程四格 h2/h3/h5/h8 ' + H4STR(d, '') + ' ‖ X̄₄短 ' + X4F(d, '') +
      '\\\\n长程四格 h2/h3/h5/h8 ' + H4STR(d, 'L') + ' ‖ X̄₄长 ' + X4F(d, 'L') + ' ‖ 加权差(长−短) ' + X4D(d) +
      '\\\\nS ' + d.S.toFixed(2);""")

# 6) 谱系卡的长程段 → 短/长/差 全显示
rep("""    '\\\\n长程四格 h2/h3/h5/h8 ' + (function () { var o = []; for (var i = 0; i < 4; i++) { var n = [2, 3, 5, 8][i], x = d['X' + n + 'L']; o.push((x === null || x === undefined || !isFinite(x)) ? '–' : ((x * (1 - 1 / n) + 1 / n) * 100).toFixed(1)); } return o.join('/'); })() +""",
    """    '\\\\n短程四格 ' + H4STR(d, '') + ' ‖ 长程四格 ' + H4STR(d, 'L') + ' ‖ 加权差(长−短) ' + X4D(d) +""")

io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('刀3 完成')
