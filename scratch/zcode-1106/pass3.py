# -*- coding: utf-8 -*-
# 刀2下半：hpNow 尸体 / 页脚与色标 hp/de 支 / relLines / 卡片 / INFO / 断言 / ftab 标题
import io
p = 'champion-map/viewer.mjs'
t = io.open(p, encoding='utf-8', newline='').read()
def rep(a, b):
    global t
    assert a in t, '锚点没中: ' + a[:60]
    t = t.replace(a, b, 1)

# 1) hpNow 孤儿尸体（函数头已被换注释，体残留）
rep("""/* 11-07 H5 撤场：hpNow（旧页面口径读数）退出 */
  const v = (st.ftab === 'long') ? d.hpl2 : d.Hp5;
  return (v === null || v === undefined || !isFinite(v)) ? null : v;
}
""", "/* 11-07 H5 撤场：hpNow（旧页面口径读数）整台退出（体随头一起删） */\n")

# 2) 谱系 tooltip 的 examG 片段 → 四格卷批次
rep("'\\\\n名次 ' + d.rk + '/' + N + ' ‖ 考卷第 ' + d.rkExam + ' 名 ‖ exam=' + (d.examG === null ? '未标档' : d.examG) + ' 局/组合'",
    "'\\n名次 ' + d.rk + '/' + N + ' ‖ 四格卷 R=100 · seed=77000（2026-11-07 全图批）'")

# 3) 1D 注释 cosmetic
rep("     §E314：必须用 Hp5 而不是 H5 —— 纵轴位置已经是 Hp5 + T·S，蓝条若还画 H5 就变成\"位置与分解两个口径\"",
    "     §E314（口径随尺走）：纵轴位置已经是 X̄₄ + T·S，蓝条画的就是 X̄₄（同一把尺的两个分解项）")

# 4) 谱系页脚 hp/de 支
rep("var foot1 = '行 = 家族（按首次出现排，上→下即时间推进）· 横轴 = 训练时刻 · 颜色 = ' + (st.color === 'hp' ? '页面口径夺1率' : st.color === 'de' ? '部署脆弱性 Δε' : st.color === 'sc' ? '当选键（绝对值）' : 'F（' + (st.ftab === 'long' ? '长程桌 5 血' : '默认桌 3 血') + '）') +",
    "var foot1 = '行 = 家族（按首次出现排，上→下即时间推进）· 横轴 = 训练时刻 · 颜色 = ' + (st.color === 'sc' ? '当选键（绝对值）' : 'F（' + (st.ftab === 'long' ? '长程桌 5 血' : '默认桌 3 血') + '）') +")
rep("""    (st.color === 'sc' ? '（绿=强 ‖ 红=落后 ‖ 橙=判不动 ‖ 灰=未测）'
      : st.color === 'de' ? '（红=脆 ‖ 蓝=吃探索 ‖ 白=不敏感）'""",
    """    (st.color === 'sc' ? '（绿=强 ‖ 红=落后 ‖ 橙=判不动 ‖ 灰=未测）'""")

# 5) 3D 底注单尺化
rep("g.fillText('三维行为轴（x3/y3/z3）· 左键拖动 = 平移 · 右键拖动 = 旋转 · 滚轮 = 缩放 · 颜色 = F（' + (st.ruler === 'exam4' ? 'X̄₄ + T·S，四格卷' : '线上口径势 = Hp5 + T·S，参照') + '）⇒ 第三轴是行为不是深度' +",
    "g.fillText('三维行为轴（x3/y3/z3）· 左键拖动 = 平移 · 右键拖动 = 旋转 · 滚轮 = 缩放 · 颜色 = F（X̄₄ + T·S，四格卷）⇒ 第三轴是行为不是深度' +")

# 6) 谱系图例 hp/de 支撤
rep(""" : st.color === 'hp' ? ('页面口径夺1率（实测 ' + NHP() + ' 枚 · ' + (st.ftab === 'long' ? '长程桌 Hplong5(参照)' : '默认桌 Hp5(参照)') + '）') : st.color === 'de' ? ('部署脆弱性 Δε（实测 ' + NEPS + ' 枚 · 脆 ' + NBRIT + '）') : st.color === 'sc' ? ('当选键（绝对值 · 实测 ' + NSEL + ' 枚）') : '训练方法家族') +""",
    """ : st.color === 'sc' ? ('当选键（绝对值 · 实测 ' + NSEL + ' 枚）') : '训练方法家族') +""")

# 7) 色标 barDraw hp/de 支撤
rep("""  if (st.color === 'hp') { /* 页面口径是渐变，但**两端要重标**（色标区间换成实测 p02..p98，不是 F 的区间）*/
    for (var hi = 0; hi < 150 * devicePixelRatio; hi++) { var hrgb = rampRGB(1 - hi / (150 * devicePixelRatio));
      cg.fillStyle = 'rgb(' + hrgb[0] + ',' + hrgb[1] + ',' + hrgb[2] + ')'; cg.fillRect(0, hi, 18 * devicePixelRatio, 1); } }
  if (st.color === 'de') { /* Δε 用**发散**色标：白 = 0（口径不敏感），红 = 开探索就掉，蓝 = 开了反而强 */
    for (var di = 0; di < 150 * devicePixelRatio; di++) { var t = 1 - di / (150 * devicePixelRatio);   /* 顶 = +6，底 = −6 */
      cg.fillStyle = t >= 0 ? mix('#dce6f5', '#ff6b6b', t) : mix('#dce6f5', '#57a6ff', -t);
      cg.fillRect(0, di, 18 * devicePixelRatio, 1); } }
""", "")

# 8) 色标两端标签 s1/s2 的 hp/de 支撤
rep("""    : st.color === 'hp' ? ('页面 1st 高 ' + EPR()[1].toFixed(1) + '%（红）' + (st.ftab === 'long' ? ' ‖ 长程桌' : ''))
    : st.color === 'de' ? ('Δε +' + 6 + 'pt（红 = 脆）')
    : st.color === 'sc' ? ('当选键 高 ' + SCR()[1].toFixed(1) + '（红）· 实测 ' + NSEL + ' 枚')""",
    """    : st.color === 'sc' ? ('当选键 高 ' + SCR()[1].toFixed(1) + '（红）· 实测 ' + NSEL + ' 枚')""")
rep("""    : st.color === 'hp' ? ('页面 1st 低 ' + EPR()[0].toFixed(1) + '%（蓝）· 灰 = 没读数（' + (N - NHP()) + ' 枚） ‖ 尺 = coords.'
      + (st.ftab === 'long' ? 'Hplong5（长程桌·参照）' : 'Hp5（默认桌·参照）'))   /* 两档同一套取数：见上面 hpNow 那段 */
    : st.color === 'de' ? ('Δε −6pt（蓝 = 开了探索反而强）· 白 = 不敏感 · 灰 = 未测（' + (N - NEPS) + '）‖ 脆（≥3.41）' + NBRIT + ' 枚 ‖ 吃探索（<0）' + NSTRONG + ' 枚')
    : st.color === 'sc' ? ('当选键 低 ' + SCR()[0].toFixed(1) + '（蓝）· 灰 = 未测（' + (N - NSEL) + ' 枚）‖ 这一档画的是**绝对值**（不对某一枚包取差）')""",
    """    : st.color === 'sc' ? ('当选键 低 ' + SCR()[0].toFixed(1) + '（蓝）· 灰 = 未测（' + (N - NSEL) + ' 枚）‖ 这一档画的是**绝对值**（不对某一枚包取差）')""")

# 9) 底图标签单尺化
rep("s1.textContent = '底图 = F（' + (st.ruler === 'exam4' ? 'X̄₄ + T·S，四格卷' : 'Hp5 + T·S，参照') + '）· 蓝 = 低 → 红 = 高';",
    "s1.textContent = '底图 = F（X̄₄ + T·S，四格卷）· 蓝 = 低 → 红 = 高';")

# 10) relLines 的"页面口径"行撤
rep("""  var hpd = hpNow(d), hpi = hpNow(INC);   /* 跟着当前桌形走：卡片上那句"页面口径"必须和点色是同一把尺 */
  out.push('　　　　　页面口径' + (st.ftab === 'long' ? '（长程桌）' : '（默认桌）') + ' ' +
    (hpd === null || hpi === null ? '这一档没读数' : (hpd >= hpi ? '+' : '') + (hpd - hpi).toFixed(1) + 'pt') +
    (d.hp === null || INC.hp === null ? '' : '（实测两 seed 均值 ' + (d.hp >= INC.hp ? '+' : '') + (d.hp - INC.hp).toFixed(1) + 'pt）'));
""", "  /* 11-07 H5 撤场：\"页面口径配对差\"那行随 hpNow 一起退（四格卷的相对读数 = 上面那行 F 差） */\n")

# 11) 卡片上的 Hp/H考卷 → 四格夺1率
rep("'F = ' + Ftxt(d) + '（' + BANDLBL + ' ' + Fv(INC).toFixed(3) + '）· Hp = ' + d.Hp5.toFixed(1) + ' · H考卷 = ' + d.",
    "'F = ' + Ftxt(d) + '（' + BANDLBL + ' ' + Fv(INC).toFixed(3) + '）· 四格夺1率（当前桌）= ' + H4STR(d) + ' ‖ H考卷 = ' + d.")

# 12) INFO 快照的 EPR 项撤
rep("var _fr0 = FR(), _cb0 = colBand(), _epr0 = EPR(), _nhp0 = NHP(), _nw = 0;", "var _fr0 = FR(), _cb0 = colBand(), _nhp0 = NHP(), _nw = 0;")
rep("+ ' ‖ EPR 域=[' + _epr0[0].toFixed(1) + ', ' + _epr0[1].toFixed(1) + '] ‖ 页面口径有读数 ' + _nhp0 + '/' + N", "+ ' ‖ 四格卷有读数 ' + _nhp0 + '/' + N")

# 13) 断言里的 st.ruler 赋值撤（单尺无此态）
rep("    try {\n      st.ruler = 'exam4';\n      var a0 = Fv(P[0]), keep = { w2: st.w2, w3: st.w3, w5: st.w5, w8: st.w8 };",
    "    try {\n      var a0 = Fv(P[0]), keep = { w2: st.w2, w3: st.w3, w5: st.w5, w8: st.w8 };")

# 14) ftabrow 标题更新（四格卷短/长程）
rep('title="§E617 头号尺 F 用哪张桌的读数（全局口径，不是颜色的一档）。&#10;默认（3血短程）= 在册那把 Hp5(参照·旧5P卷)/F，历史引用都指着它；',
    'title="§E617 头号尺 F 用哪张桌的读数（全局口径，不是颜色的一档）。&#10;四格卷：短程 = X2..X8 列（3血）‖ 长程 = X2L..X8L 列（5血），同一批 seed=77000 · R=100；旧 H5 参照系已撤场（历史读数在表与 git 史里）；')

io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('刀2下半完成')
