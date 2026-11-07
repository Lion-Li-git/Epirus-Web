# -*- coding: utf-8 -*-
import io
p = 'CHANGELOG.md'
t = io.open(p, encoding='utf-8', newline='').read()
anchor = "  - **统一权重滑杆 + H5 系全撤场"
add = """  - **底图跟随补课 + 小标签短/长程全显（11-07 晚 · ZCode · 用户实测三连）**：① 底图跟随仍未成功的真因 = **位图层（ensureField→buildBitmap）的重建判据没有权重/尺维** —— ISO 场层修了、位图层漏了（§E623 那族的第二层，与 §E623 当年"两层各自有洞"同形）⇒ 判定补第九项 `FL.fk === FKEY()`；② 小标签只显示长程四格 ⇒ 改**短程 + 长程 + X̄₄短/X̄₄长 + 加权差(长−短) 全显示**（X4T 按桌形参数化、H4STR 加桌形参数）；③ "2.0 被标历代上槽"查实为**池成员标签**（该档语义 = 历代上槽 ∪ 池成员，§E606；页面 lin='历代上槽' 19 枚全是 1.8/v7，2.0 点 sh 全空 = 确无上槽史）。四视图 99/0 ‖ meta 15/15（非整轮）。
"""
assert anchor in t
t = t.replace(anchor, add + anchor, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('CHANGELOG 已补')
