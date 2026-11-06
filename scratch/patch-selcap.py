import io
p = 'tools/probe-cem-arm.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

# 1) whitelist
o = "'arenaPool', 'arenaShapes', 'arenaDivK'], 'probe-cem-arm');"
assert s.count(o) == 1, 'whitelist anchor'
s = s.replace(o, "'arenaPool', 'arenaShapes', 'arenaDivK', 'selCap'], 'probe-cem-arm');")

# 2) parse near arenaDivK parse
o2 = "const ARENA_DIVK = Number(arg('arenaDivK', 0)) || 0;   /* 0 = 关；>0 时与 mastery 门互斥（见下） */"
assert s.count(o2) == 1, 'divk anchor'
s = s.replace(o2, o2 + """
/* `--selCap=`（千问 · 11-01，PREREG-2026-11-01-SELECT-FLOOR）：当选面的**单键出手占比上限**（veto，不进 fit）。
 *   只读 arena2 已经交出的 `maxCard.share` ⇒ 零新测量、零新代码路径。默认 0 = 关（逐字不变，回归腿对在册产物）。
 *   零通过的那一代：不入精英、不更新产物，只计数；整轮一次都没过 ⇒ 末尾响亮报 + meta 记 passed=0（不许静默退回无 cap 的 best）。 */
const SEL_CAP = Number(arg('selCap', 0)) || 0;
const SEL_STAT = { checked: 0, blocked: 0, starvedIter: 0, accepted: 0, worstSeen: 0 };""")

# 3) filter right after `order` is finalized (before mastery elite block)
o3 = "    } else order = scored.map(function (s, i) { return i; }).sort(function (a, b) { return scored[b].fit - scored[a].fit; });"
assert s.count(o3) == 1, 'order anchor'
s = s.replace(o3, o3 + """
    if (SEL_CAP > 0) {
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
    }""")

# 4) count accepted best updates (no-mastery path) and print/meta
o4 = "    } else if (bf > bestFit) { bestFit = bf; best = cand[keep[0]]; }"
assert s.count(o4) == 1, 'best update anchor'
s = s.replace(o4, "    } else if (bf > bestFit) { bestFit = bf; best = cand[keep[0]]; if (SEL_CAP > 0) SEL_STAT.accepted++; }")

print('part1 ok')
io.open(p, 'w', encoding='utf-8', newline='').write(s)
