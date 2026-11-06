import sys
src = open(r'D:/code/Epirus-Web/scratch/mutgrid/pb-orig.mjs', encoding='utf-8').read()
a = src.index('export function gridPickByRarity')
b = src.index('export function ', a + 10)
body = src[a:b]
subs = {
 '1': ("for (const e of gated) { const c = cellOf(e); pop[c] = (pop[c] || 0) + 1; }",
       "for (const e of band) { const c = cellOf(e); pop[c] = (pop[c] || 0) + 1; }"),
 '2': ("const gated = list.filter(function (e) { return e.gateOk !== false; });",
       "const gated = list;"),
 '3': ("    if (ca !== cb) return ca - cb;                                   // 先取最稀的格\n", ""),
 '4': ("const band = gated.filter(function (e) { return (Number(e.score) || 0) >= top - (Number(tolPt) || 0) / 100; });",
       "const band = gated.slice();"),
}
old, new = subs[sys.argv[1]]
assert body.count(old) == 1, 'anchor in gridPickByRarity body count=%d' % body.count(old)
open(r'D:/code/Epirus-Web/scratch/mutgrid/tools/pick-best.mjs', 'w', encoding='utf-8').write(src[:a] + body.replace(old, new) + src[b:])
print('mutation %s applied inside gridPickByRarity' % sys.argv[1])
