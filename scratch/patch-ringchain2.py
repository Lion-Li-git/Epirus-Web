import io
p = 'tools/proto2/supfit-gd.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

old = ("const ringChainPick = (state, pid, cs) => pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.BIG_T) ||\n"
       "  pickKey(cs, R.SK.RING) || pickKey(cs, R.SK.CHARGE, 'elec') || pickKey(cs, R.SK.CHARGE);")
assert s.count(old) == 1, 'ringChainPick body not found'
new = ("const ringChainPick = (state, pid, cs) => pickKey(cs, R.SK.BIG_T) || pickKey(cs, R.SK.RING) || pickChain(state, pid, cs, R);")
s = s.replace(old, new)

note_old = "const ringChainPick"
o2 = "/* 环+链双兑现教师（千问 · 11-01，接 §九 的机制读数）：链先兑现电珠，其次落雷，再次开环，最后蓄电珠。"
assert s.count(o2) == 1
o2n = "/* 环+链双兑现教师（千问 · 11-01，接 §九 的机制读数）：落雷 > 开环 > 链底盘（`pickChain`，它自带『无珠且 ep≥3 才蓄』的经济规则）。"
s = s.replace(o2, o2n)

n2 = " * 第一版这里自己写了『蓄电珠』兜底 ⇒ 留出标签塌成 ji+charge#elec 两键、炮/环/雷一个都没有——"
assert s.count(" * `chain` 教师（兑现优先）拿到 5P 43.6~64 但大雷 0（每拍先花电珠 ⇒ ep 攒不到 5）。这一档是把两者串在一条",1)
s = s.replace(" * 去向上：『能兑现就兑现，兑现不了才开环』 ⇒ 问的是『收入去向』能不能同时给出桶线与强度。 */",
              " * ⚑ 第二版改回用 `pickChain` 当底盘：第一版自己写『蓄电珠』兜底 ⇒ 留出标签塌成 ji+charge#elec 两键，\n"
              " *   正是 chain-lib 头注记过的『天真链不会经济』那个坑（蓄 15.2 次/局、炮 0.05 次/局）。 */")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
