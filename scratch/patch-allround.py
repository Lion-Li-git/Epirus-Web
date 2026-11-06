import io
p = 'tools/proto2/supfit-gd.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

anchor = "const v7Pick = (state, pid, cs) => {"
assert s.count(anchor) == 1

NEW = '''/* 全能教师（千问 · 11-01，波次 4 之后）：把 §一/§七 量出来的三道门一次打开——
 *   环 = 经济底座（把收入抬过 ep≥5 ⇒ 大雷才进菜单）‖ 电珠链 = 兑现电磁炮 ‖ 爆珠 = 激光眼的门票。
 * 优先级：破防 > 兑现电珠 > 落雷 > 开环 > 补珠（缺哪颗补哪颗，两颗都有就补电珠当链底盘）> 弃权。
 * ⚠ 这不是"把四个技能都写进规则"：每条都只是**该技能的门 + 桶线的定义**，行为仍要靠网络自己学出来。 */
const allRoundPick = (state, pid, cs) => {
  const me = state.p[pid] || {};
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser) return laser;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec'); if (rg) return rg;
  const bt = pickKey(cs, R.SK.BIG_T); if (bt) return bt;
  const ring = pickKey(cs, R.SK.RING); if (ring) return ring;
  if (!(me.boom > 0)) { const cb = pickKey(cs, R.SK.CHARGE, 'boom'); if (cb) return cb; }
  if (!(me.elec > 0)) { const ce = pickKey(cs, R.SK.CHARGE, 'elec'); if (ce) return ce; }
  return pickKey(cs, R.SK.CHARGE, 'elec');
};
'''
s = s.replace(anchor, NEW + "\n" + anchor, 1)

brk = "  : TEACHER === 'ring'"
assert s.count(brk) == 1
s = s.replace(brk, "  : TEACHER === 'allround'\n    ? (state, pid, cs) => allRoundPick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]\n" + brk, 1)

lst = "const TEACHER_KNOWN = ['chain', 'v7mix', 'toolkit', 'chainmix', 'minit', 'bigt', 'lasereye', 'ring'];"
assert s.count(lst) == 1
s = s.replace(lst, "const TEACHER_KNOWN = ['chain', 'v7mix', 'toolkit', 'chainmix', 'minit', 'bigt', 'lasereye', 'ring', 'allround'];")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
