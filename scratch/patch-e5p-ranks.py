import io

p = 'tools/eval-5p.mjs'
raw = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')
orig = len(s)

a = """for (const s of [champ, ctrl]) {
  console.log('[' + s.label + '] 1st=' + s.pct(s.ranks[0], s.total) +
    ' 严胜=' + s.pct(s.strictFirst, s.total) + ' 并列=' + s.pct(s.tieOnlyFirst, s.total) +
    '  2nd=' + s.pct(s.ranks[1], s.total) + '  3rd=' + s.pct(s.ranks[2], s.total) +
    '  4th=' + s.pct(s.ranks[3], s.total) + '  5th=' + s.pct(s.ranks[4], s.total) +
    '   | top2=' + s.pct(s.ranks[0] + s.ranks[1], s.total) + ' top3=' + s.pct(s.ranks[0] + s.ranks[1] + s.ranks[2], s.total));"""

b = """/* 名次格按**这张桌实际有几人**印（同 `style-exam.mjs` 里 `N >= 4 ?` 那条口径）。
 *   旧写法固定印 4th/5th ⇒ 3P 档上 `s.ranks[3]` 是 undefined ⇒ 打成 `4th=NaN%`；
 *   而 `top3` 在 3P 恒等于 100% —— 一格没有信息量的读数印在表里，比不印更容易被误读。 */
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
for (const s of [champ, ctrl]) {
  const rk = [];
  for (let i = 1; i < Math.min(N + 1, ORD.length); i++) rk.push('  ' + ORD[i] + '=' + s.pct(s.ranks[i], s.total));
  console.log('[' + s.label + '] 1st=' + s.pct(s.ranks[0], s.total) +
    ' 严胜=' + s.pct(s.strictFirst, s.total) + ' 并列=' + s.pct(s.tieOnlyFirst, s.total) +
    rk.join('') +
    '   | top2=' + s.pct(s.ranks[0] + s.ranks[1], s.total) + (N >= 4 ? ' top3=' + s.pct(s.ranks[0] + s.ranks[1] + s.ranks[2], s.total) : ''));"""

assert s.count(a) == 1, ('anchor', s.count(a))
s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('eval-5p 名次格改完（NL=%r）字符 %d → %d' % (nl, orig, len(s)))
