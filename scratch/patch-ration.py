import io
p = 'tools/proto2/supfit-gd.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

anchor = "const v7Pick = (state, pid, cs) => {"
assert s.count(anchor) == 1, 'v7Pick anchor missing'

NEW = '\n'.join([
 "/* 定量配给的混合教师（千问 · 11-01，用户 11-01：『用一堆大雷本来就没有什么用处，我给大雷要求才 0.2，",
 " *   你剩下的资源不就可以拿去分配给电磁炮等等了吗』+『不能纯靠单一教师』）。",
 " * 形状：每条贵线**只用到桶线下限的若干倍**，超了就把它的地盘还给兑现链——剂量上限住在教师里，",
 " *   这样标签本身就在教『分配』，而不是教『某条线打到满』。",
 " * ⚑ 与 §十 的三档单线教师（ring / ringchain / bigt）的区别：那三档各自收敛到一条线且 5P 全在 15~16，",
 " *   说明问题不是顺序而是**剂量**。计数器读 state.events（与 scanChargeRounds 同一口径：ok 才算一次）。 */",
 "const RATION = { bigT: 1, laserEye: 1, ring: 1 };",
 "const castCount = (state, pid, key) => {",
 "  let n = 0;",
 "  for (const e of (state.events || [])) if (e.type === 'action' && e.outcome === 'ok' && e.pid === pid && e.key === key) n++;",
 "  return n;",
 "};",
 "const rationPick = (state, pid, cs) => {",
 "  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)",
 "    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });",
 "  if (laser && castCount(state, pid, R.SK.LASER_EYE) < RATION.laserEye) return laser;",
 "  const bt = pickKey(cs, R.SK.BIG_T);",
 "  if (bt && castCount(state, pid, R.SK.BIG_T) < RATION.bigT) return bt;",
 "  const rg = pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.RAILGUN);",
 "  if (rg) return rg;",
 "  const me = state.p[pid] || {};",
 "  const ring = pickKey(cs, R.SK.RING);",
 "  if (ring && (me.ringStreak > 0 || castCount(state, pid, R.SK.RING) < RATION.ring)) return ring;",
 "  return pickChain(state, pid, cs, R);",
 "};",
 "",
])
s = s.replace(anchor, NEW + anchor, 1)

brk = "  : TEACHER === 'ringchain'"
assert s.count(brk) == 1, 'ringchain branch missing'
s = s.replace(brk, "  : TEACHER === 'ration'\n    ? (state, pid, cs) => rationPick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]\n" + brk, 1)

lst = "'ring', 'ringchain', 'allround'];"
assert s.count(lst) == 1
s = s.replace(lst, "'ring', 'ringchain', 'ration', 'allround'];")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
