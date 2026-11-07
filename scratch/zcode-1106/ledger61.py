# -*- coding: utf-8 -*-
import io
p = 'CHANGELOG.md'
t = io.open(p, encoding='utf-8', newline='').read()
anchor = "  - **长程四格卷全图批 + 滑杆 UX 收拢"
add = """  - **统一权重滑杆 + H5 系全撤场（11-07 晚 · ZCode · 用户令）**：① 四根权重滑杆并成**一根倾向滑杆**（三锚点分段线性：0=最倾向 2P/3P（45/35/15/5）‖ 0.5=现状（15/25/45/15）‖ 1=最倾向 5P/8P（5/15/45/35），任意档位权重和恒 1）；FKEY/deriveW/applyW 全链接，拖动即点色/底图/名次三路跟随。② **H5 系整族退出页面**：标尺下拉撤（单尺=四格卷）、Fv 的参照支/hpNow/Fl/EPR/epsagg 装载/节点 H5 字段（H5/Hp5/De5/hl2/hpl2/fl/hp/he/de）、颜色 hp/de 两档、PROF 参照行、明细/卡片/谱系 tooltip 的 H5 行——展示位全部换成四格对应值（X̄₄ + 当前桌夺1率串 H4STR + 长程四格串）；§E571（epsagg 同档）断言随之失主语撤。表与 git 史保留 H5 列作历史账。③ 重复的 T 撤（细调盒里那根为准）。**两个坑当场抓**：模板字面量吃单反斜杠（插入的提示串 `\\n` 在页面变成真换行 = 字符串未闭合，烘焙自证当场拦下）——按仓规改双反斜杠；烘焙自检失败支加"失败版内联落盘"牙（node --check 直接定位）。
"""
assert anchor in t
t = t.replace(anchor, add + anchor, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('CHANGELOG 已补')
