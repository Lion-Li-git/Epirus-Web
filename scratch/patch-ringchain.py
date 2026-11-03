import io
p = 'tools/proto2/supfit-gd.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

anchor = "const v7Pick = (state, pid, cs) => {"
assert s.count(anchor) == 1
NEW = '\n'.join([
 "/* 环+链双兑现教师（千问 · 11-01，接 §九 的机制读数）：链先兑现电珠，其次落雷，再次开环，最后蓄电珠。",
 " * 动机：`ring` 教师（环优先）拿到环 ✔ + 大雷 ✔ 但 5P 只有 15.7（收入全喂环、不兑现）；",
 " * `chain` 教师（兑现优先）拿到 5P 43.6~64 但大雷 0（每拍先花电珠 ⇒ ep 攒不到 5）。这一档是把两者串在一条",
 " * 去向上：**能兑现就兑现，兑现不了才开环** ⇒ 问的是『收入去向』能不能同时给出桶线与强度。 */",
 "const ringChainPick = (state, pid, cs) => pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.BIG_T) ||",
 "  pickKey(cs, R.SK.RING) || pickKey(cs, R.SK.CHARGE, 'elec') || pickKey(cs, R.SK.CHARGE);",
 "",
])
s = s.replace(anchor, NEW + anchor, 1)

brk = "  : TEACHER === 'ring'"
assert s.count(brk) == 1
s = s.replace(brk, "  : TEACHER === 'ringchain'\n    ? (state, pid, cs) => ringChainPick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]\n" + brk, 1)

lst = "const TEACHER_KNOWN = ['chain', 'v7mix', 'toolkit', 'chainmix', 'minit', 'bigt', 'lasereye', 'ring', 'allround'];"
assert s.count(lst) == 1
s = s.replace(lst, "const TEACHER_KNOWN = ['chain', 'v7mix', 'toolkit', 'chainmix', 'minit', 'bigt', 'lasereye', 'ring', 'ringchain', 'allround'];")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
