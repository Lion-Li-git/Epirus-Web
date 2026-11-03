import io
p = 'tools/proto2/arch2.mjs'
raw = io.open(p, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')
orig = len(s)

def rep(a, b, want=1):
    global s
    assert s.count(a) == want, ('anchor', a[:70], s.count(a), want)
    s = s.replace(a, b, want)

# 0) layout 自己的代闸也要放开（否则 gen=3 直接抛）
rep("""  if (gen !== GEN_LATEST) throw new Error('layout: 只实现代 ' + GEN_LATEST + '（收到 gen=' + gen + '）；代 1 """,
    """  if (gen !== GEN_LATEST && gen !== GEN_NEW) throw new Error('layout: 只实现代 ' + GEN_LATEST + '/' + GEN_NEW + '（收到 gen=' + gen + '）；代 1 """)

rep('const GEN_LATEST = 2;',
    """const GEN_LATEST = 2;      /* ⚠ Stage C 之前不翻默认：翻了 ⇒ 现有尺读不了 v:91（那是最后一步，删除清单见任务 #18） */
const GEN_NEW = 3;         /* 代 3 = v:92：键层按决策键分组（keySplit）⇒ 新臂显式 gen=3 才走这条路 */""")

rep('const V_FOR_GEN = { 1: 90, 2: 91 };', 'const V_FOR_GEN = { 1: 90, 2: 91, 3: 92 };')

rep("""  if (gen !== GEN_LATEST) {""", """  if (gen !== GEN_LATEST && gen !== GEN_NEW) {""")

rep("  const gen = o.gen == null ? GEN_LATEST : Number(o.gen);",
    """  const gen = o.gen == null ? GEN_LATEST : Number(o.gen);
  /* ⚑ Stage A（10-31 夜）· 键内自由度上提到键层：`keySplit` ⇒ 两级 softmax 的**键层按决策键分组**。
   *   「蓄能」在候选表里本来就是两枚同键不同珠（policy.js:680 的 bead='elec'/'boom'）。旧口径下键层取
   *   bestOf ⇒ **任何键级目标/门/审计都看不见珠种**，包只能继承起点的抽签（今晚实测：OB3S 起点键级蒸馏
   *   576 次蓄成爆珠 ⇒ 开火窗 0.2%、净分 −21.6%）。拆成 charge#elec / charge#boom 之后珠种进入"选哪个动作"这一层。
   *   三条硬规矩与 inter/tinter 同款：① 代 2 默认 0 ⇒ 现役包逐位不变；② **不加观测维、不动参数量**
   *   （C.cand 里本来就有 beadIsElec/beadIsBoom）；③ 段表不变 ⇒ 变异/蒸馏/冻结的账全部照旧。 */
  const keySplit = (o.keySplit == null) ? (gen >= GEN_NEW ? 1 : 0) : (Number(o.keySplit) > 0 ? 1 : 0);""")

rep("    seatH, actH, hid, hid2, selfDim, ctxDim, candIn, interK, interStride, tinterK, tinterStride, seg, n: off,",
    "    seatH, actH, hid, hid2, selfDim, ctxDim, candIn, interK, interStride, tinterK, tinterStride, seg, n: off, keySplit,")

rep("  const L = layout(o2);",
    """  const L = layout(o2);
  /* 决策键的**唯一实现**（两条前向尾 + wantTape 的 keys 全走这里 ⇒ 工具读 tape.keys 就不会长出第二份口径） */
  const CHARGE_KEY = (W.EpirusRules && W.EpirusRules.SK && W.EpirusRules.SK.CHARGE) || 'charge';
  const DK = (c) => (c && L.keySplit && c.key === CHARGE_KEY && c.bead) ? (c.key + '#' + c.bead) : (c ? c.key : null);""")

TAIL_OLD = """    const bestOf = {}, kSum = {}, kProb = {}, keys = [];
    for (let i = 0; i < n; i++) {
      const k = cands[i].key;
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }
      if (logits[i] > bestOf[k]) bestOf[k] = logits[i];
    }"""
TAIL_NEW = """    const bestOf = {}, kSum = {}, kProb = {}, keys = [];
    for (let i = 0; i < n; i++) {
      const k = DK(cands[i]);
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }
      if (logits[i] > bestOf[k]) bestOf[k] = logits[i];
    }"""
rep(TAIL_OLD, TAIL_NEW, 2)

rep("    for (let i = 0; i < n; i++) { const k = cands[i].key; kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }",
    "    for (let i = 0; i < n; i++) { const k = DK(cands[i]); kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }", 2)

WITHIN_OLD = """    for (let i = 0; i < n; i++) {
      const k = cands[i].key;
      const within = kSum[k] > 0 ? Math.exp((logits[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;"""
WITHIN_NEW = """    for (let i = 0; i < n; i++) {
      const k = DK(cands[i]);
      const within = kSum[k] > 0 ? Math.exp((logits[i] - bestOf[k]) / temp) / kSum[k] : 1 / n;"""
rep(WITHIN_OLD, WITHIN_NEW, 2)

rep("TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.keys.push(cands[i].key); }",
    "TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.keys.push(DK(cands[i])); }")

rep("const d = { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK || 0, tinter: L.tinterK || 0, gen: L.gen };",
    "const d = { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK || 0, tinter: L.tinterK || 0, gen: L.gen, keySplit: L.keySplit || 0 };")

out = s.replace(chr(10), NL) if NL == chr(13) + chr(10) else s
io.open(p, 'w', encoding='utf-8', newline='').write(out)
print('arch2 patched (NL=%r), bytes %d -> %d' % (NL, orig, len(s)))
