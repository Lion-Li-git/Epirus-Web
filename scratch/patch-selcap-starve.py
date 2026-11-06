import io
p = 'tools/probe-cem-arm.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

old = """    if (SEL_CAP > 0) {
      const ordCap = [];
      for (const k of order) {
        SEL_STAT.checked++;
        const mc = scored[k] && scored[k].maxCard;
        const sh = mc ? mc.share : null;
        if (sh != null && sh > SEL_CAP) { SEL_STAT.blocked++; if (sh > SEL_STAT.worstSeen) SEL_STAT.worstSeen = sh; continue; }
        ordCap.push(k);
      }
      if (!ordCap.length) { SEL_STAT.starvedIter++; }
      order = ordCap;
    }"""
assert s.count(old) == 1, 'filter block not found'
new = """    /* 一整代全被 cap 挡下时：σ/均值照旧重拟合（否则搜索直接饿死），但**产物一格不许动** ⇒ 11-01 第一版没写这条，
     *   把 keep 清空后在 `scored[keep[0]]` 上当场炸。 */
    let capStarved = false;
    if (SEL_CAP > 0) {
      const ordCap = [];
      for (const k of order) {
        SEL_STAT.checked++;
        const mc = scored[k] && scored[k].maxCard;
        const sh = mc ? mc.share : null;
        if (sh != null && sh > SEL_CAP) { SEL_STAT.blocked++; if (sh > SEL_STAT.worstSeen) SEL_STAT.worstSeen = sh; continue; }
        ordCap.push(k);
      }
      if (!ordCap.length) { SEL_STAT.starvedIter++; capStarved = true; }
      else order = ordCap;
    }"""
s = s.replace(old, new)

old2 = """    const bf = scored[keep[0]].fit;
    if (MASTERY_ON && MASTERY_GATE === 'elite') {"""
assert s.count(old2) == 1, 'update block not found'
new2 = """    const bf = scored[keep[0]].fit;
    if (capStarved) { /* 这一代没有过 cap 的粒子 ⇒ 产物棘轮不动（计数已记 starvedIter） */ }
    else if (MASTERY_ON && MASTERY_GATE === 'elite') {"""
s = s.replace(old2, new2)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
