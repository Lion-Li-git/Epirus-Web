import io

p = 'tools/proto2/breadth2.mjs'
s = io.open(p, encoding='utf-8', newline='').read()
o = "    maxLandShare: ls.share, maxLandKey: ls.key, pierceMissing: mh.pierceMissing,"
assert s.count(o) == 1, 'breadth2 anchor missing'
n = ('    /* ⚑ 分母为 0 不许与『没塌缩』同形：一次伤害都没落地 ⇒ 份额**读不出**（null），不是 0.0%（11-01 池表抓到）。 */\n'
     '    maxLandShare: ls.total > 0 ? ls.share : null, maxLandKey: ls.key, landReadable: ls.total > 0, pierceMissing: mh.pierceMissing,')
s = s.replace(o, n)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

p2 = 'tools/proto2/pool-check.mjs'
s2 = io.open(p2, encoding='utf-8', newline='').read()
o2 = "const bpass = packs.filter((x) => x.breadth && x.breadth.maxLandShare <= COLLAPSE_LINE);"
assert s2.count(o2) == 1, 'bpass anchor missing'
s2 = s2.replace(o2, "const bpass = packs.filter((x) => x.breadth && x.breadth.maxLandShare != null && x.breadth.maxLandShare <= COLLAPSE_LINE);")

o3 = "(x.breadth ? '(' + (x.breadth.maxLandKey || '-') + (x.breadth.maxLandShare <= COLLAPSE_LINE ? ' ✔' : ' ✘塌缩') + ')' : '')"
assert s2.count(o3) == 1, 'column anchor missing'
n3 = ("(x.breadth ? '(' + (x.breadth.maxLandKey || '—') + (x.breadth.maxLandShare == null"
      " ? ' ⚠读不出：一次落地都没有' : (x.breadth.maxLandShare <= COLLAPSE_LINE ? ' ✔' : ' ✘塌缩')) + ')' : '')")
s2 = s2.replace(o3, n3)
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
