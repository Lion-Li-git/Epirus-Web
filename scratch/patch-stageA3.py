import io

def load(p):
    raw = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), nl

def save(p, s, nl):
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)

def rep(s, a, b, want=1, tag=''):
    assert s.count(a) == want, ('anchor' + tag, a[:70], s.count(a), want)
    return s.replace(a, b, want)

# ============ 1) 浏览器镜像 js/train/policy2.js ============
p1 = 'js/train/policy2.js'
s, nl1 = load(p1)
s = rep(s, """  const V_GEN2 = 91;                       // 与 arch2 的 V_FOR_GEN[2] 同值（两处都要改时由 browser-parity 当场红）
  const GEN = 2;""",
"""  const V_GEN2 = 91;                       // 与 arch2 的 V_FOR_GEN[2] 同值（两处都要改时由 browser-parity 当场红）
  const V_GEN3 = 92;                       // 代 3 = v:92（键层按决策键分组；与 arch2 的 V_FOR_GEN[3] 同值）
  const GEN = 2;""", 1, '-p1ver')

s = rep(s, """    if (o.v !== V_GEN2) return { ok: false, reason: 'version', got: o.v, want: V_GEN2 };""",
"""    if (o.v !== V_GEN2 && o.v !== V_GEN3) return { ok: false, reason: 'version', got: o.v, want: V_GEN2 + '/' + V_GEN3 };""", 1, '-p1v')

s = rep(s, """    if (o.dims.gen !== GEN) return { ok: false, reason: 'gen', got: o.dims.gen, want: GEN };""",
"""    if (o.dims.gen !== GEN && o.dims.gen !== 3) return { ok: false, reason: 'gen', got: o.dims.gen, want: GEN + '|3' };
    if ((o.dims.keySplit || 0) > 0 && o.dims.gen < 3) return { ok: false, reason: 'keySplit-on-old-gen', got: o.dims.keySplit, want: 0 };""", 1, '-p1g')

s = rep(s, """    const L = {""",
"""    /* 代 3：`keySplit` ⇒ 键层按决策键分组（charge 的 elec/boom 上提到键层）。规则与 arch2 的 DK 逐字同，
     *   由 selftest3 腿 E（浏览器镜像 parity）+ browser-parity 钉住，不靠人记。 */
    const CHARGE_KEY = (R.SK && R.SK.CHARGE) || 'charge';
    const keySplit = (o.dims.keySplit || 0) > 0 ? 1 : 0;
    const DK = (c) => (c && keySplit && c.key === CHARGE_KEY && c.bead) ? (c.key + '#' + c.bead) : (c ? c.key : null);
    const L = { keySplit,""", 1, '-p1dk')

s = rep(s, "      if (TP) { TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.keys.push(cands[i].key); }",
            "      if (TP) { TP.afs.push(Float64Array.from(afbuf)); TP.t1.push(t1); TP.t2.push(t2); TP.keys.push(DK(cands[i])); }", 1, '-p1tape')

s = rep(s, """      const k = cands[i].key;
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }""",
"""      const k = DK(cands[i]);
      if (!(k in bestOf)) { bestOf[k] = -1e9; kSum[k] = 0; keys.push(k); }""", 1, '-p1tail1')

s = rep(s, "    for (let i = 0; i < n; i++) { const k = cands[i].key; kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }",
            "    for (let i = 0; i < n; i++) { const k = DK(cands[i]); kSum[k] += Math.exp((logits[i] - bestOf[k]) / temp); }", 1, '-p1tail2')

s = rep(s, """    for (let i = 0; i < n; i++) {
      const k = cands[i].key;
      const within""",
"""    for (let i = 0; i < n; i++) {
      const k = DK(cands[i]);
      const within""", 1, '-p1tail3')

# L 里带上 keySplit（供 unpack/自检读回）
s = rep(s, "      v: V_GEN2, arch: 'S1o', n: L.n,",
            "      v: (L.keySplit ? V_GEN3 : V_GEN2), arch: 'S1o', n: L.n,", 1, '-p1packv')
s = rep(s, "dims: { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK, gen: GEN, dof: DOF[L.input] || 208 },",
            "dims: { seatH: L.seatH, actH: L.actH, hid: L.hid, hid2: L.hid2, input: L.input, inter: L.interK, gen: (L.keySplit ? 3 : GEN), keySplit: L.keySplit || 0, dof: DOF[L.input] || 208 },", 1, '-p1dims')
save(p1, s, nl1)
print('policy2.js patched (NL=%r)' % nl1)

# ============ 2) 蒸馏器：目标必须用部署同一套键（读 tape.keys，不再自造） ============
p2 = 'tools/proto2/supfit-gd.mjs'
s2, nl2 = load(p2)
s2 = rep(s2, """          const again = teacherPick(cl, pid, cs2);
          const keys = cs2.map((c) => c.key);
          if (!again || !cs2.length || keys.indexOf(again.key) < 0) { LABEL.gone++; return; }
          /* tape 的输入与参数无关 ⇒ 收集时算一次，之后任意参数重放（单源：arch2 wantTape） */
          const fr = P.forwardCands(cl, pid, cs2, up, { temp: 1, wantTape: 1 });
          /* 教师那一枚在候选表里的下标（pickChain 返回的是 cs2 里的对象本身 ⇒ 按身份找，不按 key 找） */
          const wIdx = cs2.indexOf(again);""",
"""          const again = teacherPick(cl, pid, cs2);
          if (!again || !cs2.length) { LABEL.gone++; return; }
          /* tape 的输入与参数无关 ⇒ 收集时算一次，之后任意参数重放（单源：arch2 wantTape） */
          const fr = P.forwardCands(cl, pid, cs2, up, { temp: 1, wantTape: 1 });
          /* ⚑ 键层分组从 **tape 里拿**（arch2 的 DK 是决策键的唯一实现）⇒ 目标与部署 softmax 同一套键。
           *   原来这里自己 `cs2.map(c => c.key)`，代 3 开了 keySplit 就会与部署不一致（苹果对橘子）。 */
          const keys = fr.tape.keys;
          /* 教师那一枚在候选表里的下标（pickChain 返回的是 cs2 里的对象本身 ⇒ 按身份找，不按 key 找） */
          const wIdx = cs2.indexOf(again);
          if (wIdx < 0 || !keys[wIdx]) { LABEL.gone++; return; }""", 1, '-p2keys')

s2 = rep(s2, "wantKey: again.key, want0: t0.key, wantIdx: wIdx, wantBead: again.bead || null });",
             "wantKey: keys[wIdx], want0: t0.key, wantIdx: wIdx, wantBead: again.bead || null });", 1, '-p2want')
save(p2, s2, nl2)
print('supfit-gd patched (NL=%r)' % nl2)
