import io
p = 'tools/proto2/arch2.mjs'
s = io.open(p, encoding='utf-8', newline='').read()
orig = s

# 1) 容器版本表：代 3 = v:92
a = 'const GEN_LATEST = 2;'
assert s.count(a) == 1, 'gen_latest'
s = s.replace(a, """const GEN_LATEST = 2;      /* ⚠ Stage C 之前不翻默认：翻了 ⇒ 现有尺读不了 v:91（那是最后一步，删除清单见任务 #18） */
const GEN_NEW = 3;         /* 代 3 = v:92：键层按决策键分组（keySplit）⇒ 新臂显式 gen=3 才走这条路 */""", 1)

b = 'const V_FOR_GEN = { 1: 90, 2: 91 };'
assert s.count(b) == 1, 'v_for_gen'
s = s.replace(b, 'const V_FOR_GEN = { 1: 90, 2: 91, 3: 92 };', 1)

# 2) 装载器：允许读代 2 与代 3（读侧兼容 ≠ 出货侧兼容）
c = """  if (gen !== GEN_LATEST) {"""
assert s.count(c) == 1, 'gen_check'
s = s.replace(c, """  if (gen !== GEN_LATEST && gen !== GEN_NEW) {""", 1)

# 3) layout：keySplit（默认随代：代 3 开、代 2 关；显式覆盖）
d = "  const gen = o.gen == null ? GEN_LATEST : Number(o.gen);"
assert s.count(d) == 1, 'gen_read'
s = s.replace(d, d + """
  /* ⚑ Stage A（10-31 夜）· 键内自由度上提到键层：`keySplit` ⇒ 两级 softmax 的**键层按决策键分组**，
   *   「蓄能」在候选表里本来就是两枚同键不同珠（policy.js:680 的 bead='elec'/'boom'）。旧口径下键层取
   *   bestOf ⇒ **任何键级目标/门/审计都看不见珠种**，包只能继承起点的抽签（今晚实测：OB3S 起点键级蒸馏
   *   576 次蓄成爆珠 ⇒ 开火窗 0.2%、净分 −21.6%）。拆成 charge#elec / charge#boom 之后珠种进入"选哪个动作"这一层。
   *   三条硬规矩与 inter/tinter 同款：① 代 2 默认 0 ⇒ 现役包逐位不变；② **不加观测维、不动参数量**
   *   （C.cand 里本来就有 beadIsElec/beadIsBoom）；③ 段表不变 ⇒ 变异/蒸馏/冻结的账全部照旧。 */
  const keySplit = (o.keySplit == null) ? (Number(o.gen) >= GEN_NEW ? 1 : 0) : (Number(o.keySplit) > 0 ? 1 : 0);""", 1)

e = "    seatH, actH, hid, hid2, selfDim, ctxDim, candIn, interK, interStride, tinterK, tinterStride, seg, n: off,"
assert s.count(e) == 1, 'L_return'
s = s.replace(e, "    seatH, actH, hid, hid2, selfDim, ctxDim, candIn, interK, interStride, tinterK, tinterStride, seg, n: off, keySplit,", 1)

# 4) install() 里定义单源 DK（决策键），两条尾与 tape 都用它
f = "  const L = layout(o2);"
assert s.count(f) == 1, 'L_assign'
s = s.replace(f, f + """
  /* 决策键的**唯一实现**（两条前向尾 + wantTape 的 keys 都走这里 ⇒ 工具读 tape.keys 就不会长出第二份口径） */
  const CHARGE_KEY = (W.EpirusRules && W.EpirusRules.SK && W.EpirusRules.SK.CHARGE) || 'charge';
  const DK = (c) => (c && L.keySplit && c.key === CHARGE_KEY && c.bead) ? (c.key + '#' + c.bead) : (c ? c.key : null);""", 1)

# 5) 两条尾的分组换成 DK
g = """    const bestOf = {}, kSum = {}, kProb = {}, keys = [];
    for (let i = 0; i < n; i++) {
      const k = cands[i].key;
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }
      if (logits[i] > bestOf[k]) bestOf[k] = logits[i];
    }"""
assert s.count(g) == 2, ('tails', s.count(g))
s = s.replace(g, """    const bestOf = {}, kSum = {}, kProb = {}, keys = [];
    for (let i = 0; i < n; i++) {
      const k = DK(cands[i]);
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }
      if (logits[i] > bestOf[k]) bestOf[k] = logits[i];
    }""")

h = "    for (let i = 0; i < n; i++) { const k = cands[i].key; kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }"
assert s.count(h) == 2, ('ksum', s.count(h))
s = s.replace(h, "    for (let i = 0; i < n; i++) { const k = DK(cands[i]); kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }")

i2 = """    for (let i = 0; i < n; i++) {
      const k = cands[i].key;
      const within = kSum[k] > 0 ? Math.exp((logits[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;"""
assert s.count(i2) == 2, ('within', s.count(i2))
s = s.replace(i2, """    for (let i = 0; i < n; i++) {
      const k = DK(cands[i]);
      const within = kSum[k] > 0 ? Math.exp((logits[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;""")

# 6) tape 带决策键（工具单源的落点）
j = "TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.keys.push(cands[i].key); }"
assert s.count(j) == 1, 'tape_keys'
s = s.replace(j, "TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.keys.push(DK(cands[i])); }", 1)

# 7) 容器 dims 带上 keySplit（读侧据此复原语义；packDims 的键序与 policy2 的同源）
k2 = "const d = { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK || 0, tinter: L.tinterK || 0, gen: L.gen };"
assert s.count(k2) == 1, 'packDims'
s = s.replace(k2, "const d = { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK || 0, tinter: L.tinterK || 0, gen: L.gen, keySplit: L.keySplit || 0 };", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('arch2 patched, bytes %d -> %d' % (len(orig), len(s)))
