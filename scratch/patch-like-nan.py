import io

p = 'tools/proto2/supfit-gd.mjs'
raw = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')
orig_len = len(s)

a = "function like(pv, list) {\n  let llW = 0, nW = 0, hit = 0, n = 0;\n  const byKey = {};"
b = ("/* ⚑ 留出集里出现**训练集没有的类**时（10-31 晚 v7mix 的 holo 键触发），`1/类频` 权重根本不存在：\n"
     " *   旧写法照旧 `nW += WKEY[c]` ⇒ nW 被毒成 NaN，而 JS 里 **NaN 是 falsy** ⇒ `ll` 静默落回哨兵 −99，\n"
     " *   打印看着像\"这枚包差到读不出\"，其实是分母被吃掉了（与 pg-train 那笔 NaN 事故同族）。\n"
     " *   现在：这类组不进加权均值、单独计数并响亮印出（带计入分母）。 */\n"
     "function like(pv, list) {\n"
     "  let llW = 0, nW = 0, hit = 0, n = 0, noW = 0;\n"
     "  const noWKeys = {};\n"
     "  const byKey = {};")
assert s.count(a) == 1, ('A', s.count(a))
s = s.replace(a, b)

a2 = "    const c = cls(gr);\n    n++; llW += WKEY[c] * Math.log(Math.max(1e-12, p)); nW += WKEY[c];"
b2 = ("    const c = cls(gr);\n"
      "    const w = WKEY[c];\n"
      "    if (!(w > 0)) { noW++; noWKeys[c] = (noWKeys[c] || 0) + 1; continue; }\n"
      "    n++; llW += w * Math.log(Math.max(1e-12, p)); nW += w;")
assert s.count(a2) == 1, ('A2', s.count(a2))
s = s.replace(a2, b2)

a3 = "  return { ll: nW ? llW / nW : -99, agree: n ? hit / n : 0, wAgree: wTot ? wHit / wTot : 0, n, byKey };\n}"
b3 = ("  return { ll: nW ? llW / nW : -99, agree: n ? hit / n : 0, wAgree: wTot ? wHit / wTot : 0, n, noW, noWKeys, byKey };\n}\n"
      "/* 印出被吃掉的类（带分母），−99 从此只可能真的是\"整批读不出\" */\n"
      "const noWLine = (tag, r) => (r.noW ? ('  \\u2691 ' + tag + '有 ' + r.noW + ' 组落在训练集没有的类 ⇒ 未计入加权似然（计入分母 n=' +\n"
      "  r.n + '）：' + Object.entries(r.noWKeys).map(([k, v]) => k + '×' + v).join(' ‖ ') + '\\n') : '');")
assert s.count(a3) == 1, ('A3', s.count(a3))
s = s.replace(a3, b3)

# 在起点与终评两处打印后面接上这条线
a4 = "  ' ‖ 加权一致率 ' + (100 * fin.wAgree).toFixed(1) + '%（起点 ' + (100 * base.wAgree).toFixed(1) + '%）');"
b4 = ("  ' ‖ 加权一致率 ' + (100 * fin.wAgree).toFixed(1) + '%（起点 ' + (100 * base.wAgree).toFixed(1) + '%）');\n"
      "process.stdout.write(noWLine('起点（留出卷）', base) + noWLine('终评（留出卷）', fin));")
assert s.count(a4) == 1, ('A4', s.count(a4))
s = s.replace(a4, b4)

# meta 也记下（读数可追溯）
a5 = "agree: fin.agree, ll: fin.ll, wAgree: fin.wAgree, nTest: fin.n, nTrain: finTrain.n,"
b5 = "agree: fin.agree, ll: fin.ll, wAgree: fin.wAgree, nTest: fin.n, nTrain: finTrain.n, testClassNotInTrain: fin.noW || 0, startClassNotInTrain: base.noW || 0,"
if s.count(a5) == 1:
    s = s.replace(a5, b5)
    print('  ok meta 字段')
else:
    print('  !! meta 字段锚点命中 %d（跳过，不硬改）' % s.count(a5))

io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('like() 修完（NL=%r），字符 %d → %d' % (nl, orig_len, len(s)))
