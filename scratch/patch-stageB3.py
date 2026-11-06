import io, os

def load(p):
    raw = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), nl

def save(p, s, nl):
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)

FILES = ['tools/proto2/browser-parity.mjs', 'tools/proto2/pack2-audit.mjs', 'tools/proto2/selftest2.mjs',
         'tools/proto2/selftest3.mjs', 'tools/proto2/pg-train.mjs', 'tools/proto2/arch2.mjs']
C = {p: load(p) for p in FILES}

def sub(tag, p, a, b, least=1):
    s, nl = C[p]
    n = s.count(a)
    assert n >= least, (tag, p, a[:60], n)
    C[p] = (s.replace(a, b), nl)
    print('  ok %-10s %s (%d)' % (tag, p.split('/')[-1], n))

def cut(tag, p, start_sub, end_sub):
    s, nl = C[p]
    i = s.find(start_sub); assert i >= 0, (tag, 'start', start_sub[:50])
    j = s.find(end_sub, i); assert j > i, (tag, 'end', end_sub[:50])
    C[p] = (s[:i] + s[j:], nl)
    print('  ok %-10s %s (切 %d 字符)' % (tag, p.split('/')[-1], j - i))

# ---------- browser-parity：P2 不再有豁免段，也不再有 Q(s) 对照 ----------
sub('bp-cmt', 'tools/proto2/browser-parity.mjs',
    "/* ---- P2 有牙：**逐段把整块权重区换成独立随机值** ⇒ 功能段必须动 logits，qHead 必须不动 ----",
    "/* ---- P2 有牙：**逐段把整块权重区换成独立随机值** ⇒ 每一段都必须动 logits（代 3 起段表里没有豁免段）----")
cut('bp-print', 'tools/proto2/browser-parity.mjs', "  ' ‖ qHead 对照（换整段 logits 不许变而 Q(s) 必须变）：'", "const deadSegs =")
sub('bp-guard', 'tools/proto2/browser-parity.mjs',
    "if (!qDead) { console.error('⛔ qHead 那条对照不过 ⇒ 两头分离没实现（logits 被 Q 头污染，或 Q 头根本没读）'); process.exit(8); }\n", "")

# ---------- pack2-audit：那条"死区对照"已经退化成恒真 ⇒ 撤掉，C 变成"每段必须有牙" ----------
sub('pa-hdr', 'tools/proto2/pack2-audit.mjs',
    " *   C 每段有牙：逐段把**权重区**整块换成独立随机数 ⇒ logits 必须变；qHead 整块灌大 ⇒ logits 必须不变（死区对照）；",
    " *   C 每段有牙：逐段把**权重区**整块换成独立随机数 ⇒ logits 必须变（代 3 起段表里没有豁免段——原来的 qHead 死区对照已随价值头一起删除；\n *     那半截在删之前其实退化成恒真：pq 只是 base 的副本，见本次提交说明）；")
sub('pa-sec', 'tools/proto2/pack2-audit.mjs', "/* ---------- C 每段有牙（+ qHead 死区对照） ---------- */",
                                "/* ---------- C 每段有牙（无豁免段） ---------- */")
for _t, _a, _b in [('pa-rows', "policyHead: 1, qHead: 1 };", "policyHead: 1 };"),
                   ('pa-ind', "policyHead: L.hid2, qHead: L.hid };", "policyHead: L.hid2 };")]:
    _s, _nl = C['tools/proto2/pack2-audit.mjs']
    if _s.count(_a) == 0: print('  -- %-10s 已由上一批处理' % _t); continue
    C['tools/proto2/pack2-audit.mjs'] = (_s.replace(_a, _b), _nl); print('  ok %-10s pack2-audit.mjs' % _t)
cut('pa-inert', 'tools/proto2/pack2-audit.mjs', "  const pq = Float64Array.from(base);", "  ok(inert.length === 0")
sub('pa-ok', 'tools/proto2/pack2-audit.mjs', "  ok(inert.length === 0 && qInert,", "  ok(inert.length === 0,")
cut('pa-txt', 'tools/proto2/pack2-audit.mjs', "    ' ‖ 死区对照 qHead 整块灌 ±50 ⇒ logits 逐位不变 '", "  if (inert.length)")

# ---------- selftest3：撤掉腿 G（价值通路随头一起没了） ----------
cut('s3-legG', 'tools/proto2/selftest3.mjs', "/* —— 腿 G：价值通路（q）的数值梯度", "\nconst ok = badA === 0")
sub('s3-ok', 'tools/proto2/selftest3.mjs', "&& fBad === 0 && gBad === 0 && gLeak === 0;", "&& fBad === 0;")
sub('s3-hdr', 'tools/proto2/selftest3.mjs', " *   F 键级导数", " *   F 键级导数")

# ---------- selftest2：T4 换成"每段必须有牙 + 尾部不读参数当反向对照" ----------
T4_OLD_START = "/* ---- T4：Q(s) 不参与排序 ---- */"
T4_OLD_END = "/* ---- T5：确定性 ---- */"
s2, nl2 = C['tools/proto2/selftest2.mjs']
i = s2.find(T4_OLD_START); j = s2.find(T4_OLD_END)
assert i > 0 and j > i, 'T4 block'
T4_NEW = """/* ---- T4：段表里不许有"没人读的段"，并且这把尺要分得清"读"与"不读" ----
 *   代 3 起 qHead 已删（它的 33 个参数没有任何目标函数读 ⇒ 每个下游都得为它写一条豁免，就是屎山的形状）。
 *   ① 每段整块灌 ±500 ⇒ logits 必须变（无豁免段）；
 *   ② 反向对照（这条腿的牙，取代旧「灌 qHead 不变」那条）：在参数**尾部追加** 33 个结构上保证不被读的值
 *      ⇒ logits 必须逐位不变，且 `unpack` 必须拒收长度不符的容器 ⇒ 证明 ① 不是恒真。 */
{
  const lgOf = (pp) => Array.from(P.forwardCands(D.st, 0, D.cands, pp, { temp: 0.5 }).logits).join(',');
  const before = lgOf(p1);
  const live = {};
  for (const sg of L.seg) {
    const q = Float64Array.from(p1);
    for (let i = sg.off; i < sg.off + sg.len; i++) q[i] = (rng() - 0.5) * 1000;
    live[sg.name] = lgOf(q) !== before;
  }
  const inert = Object.keys(live).filter((k) => !live[k]);
  ok(inert.length === 0, 'T4 每段整块灌 ±500 ⇒ logits 必须变（段表 ' + L.seg.map((x) => x.name).join('/') + '，无豁免段）：' +
    (inert.length ? '✘ 没人读的段 ' + inert.join(',') : '✔'));
  const tail = new Float64Array(p1.length + 33);
  tail.set(p1, 0);
  for (let i = 0; i < 33; i++) tail[p1.length + i] = (rng() - 0.5) * 1000;
  tail.p2 = p1.p2;
  ok(lgOf(tail) === before, 'T4 反向对照：尾部追加 33 个不被读的参数 ⇒ logits 逐位不变（尺看得见"不读" ⇒ 上面那句不是恒真）');
  const bad = P.pack(p1);
  bad.a = bad.a.concat([0, 0, 0]);
  ok(P.unpack(bad, true) === null, 'T4 反向对照 ②：长度不符的容器必须拒读（不许静默截断/补齐——代 1 那次 6122 灌 5689 的病就这么来的）');
}

"""
s2 = s2[:i] + T4_NEW + s2[j:]
C['tools/proto2/selftest2.mjs'] = (s2, nl2)
print('  ok T4         selftest2.mjs (整段重写)')

# T18 ② 换成指针（牙现由 T4 + T16 承担），删掉 regionLeg 里的 qHead 注入
sub('t18-cmt', 'tools/proto2/selftest2.mjs',
    "   *   ② **死区对照（这条腿的牙）**：`qHead` 整块灌 ±50 ⇒ logits 必须**逐位不",
    "   *   ② 旧「qHead 死区对照」随价值头一起删除，牙由 T4（尾部追加不被读参数 + 长度不符拒读）与本文件 T16（S1 面 target2 构造性死维逐位全等）承担。旧文案：")
s3 = C['tools/proto2/selftest2.mjs'][0]
i = s3.find("    const sq = sgI.qHead")
assert i > 0, 't18 sq'
j = s3.find("\n", s3.find("qInert", i))
k = s3.find("\n", j)
C['tools/proto2/selftest2.mjs'] = (s3[:i] + "    const qInert = true;   /* 见上：这条对照已搬到 T4；此处仅保持返回形状 */" + s3[k:], C['tools/proto2/selftest2.mjs'][1])
print('  ok t18        selftest2.mjs (qHead 注入删除)')
sub('t18-print', 'tools/proto2/selftest2.mjs', "    ' ‖ ② 死区对照 qHead 整块灌 ±50 ⇒ logits 逐位不变：'",
                                     "    ' ‖ ②（旧 qHead 死区对照已并入 T4）' + (o3.qInert && o1.qInert ? ' ✔' : ' ✘'):")

# ---------- pg-train：撤掉 --baseline=qhead（价值基线只剩训练器里的闭式 ridge） ----------
g = 'tools/proto2/pg-train.mjs'
sub('pg-val', g, "if (BASELINE !== 'mean' && BASELINE !== 'qhead' && BASELINE !== 'ridge') { console.error('⛔ --baseline 只认 mean|qhead|ridge（收到 ' + BASELINE + '）'); process.exit(2); }",
                "if (BASELINE !== 'mean' && BASELINE !== 'ridge') { console.error('⛔ --baseline 只认 mean|ridge（收到 ' + BASELINE + '）；代 3 起没有网络内价值头 ⇒ qhead 档已删'); process.exit(2); }")
sub('pg-doc', g, " *   >0 ⇒ 同代先给每粒", " *   >0 ⇒ 同代先给每粒")
sub('pg-doc2', g, " * `mean`（默认）= 现役常数基线（批内均值），逐字不变；`qhead` = 优势用 G − V(s)，\n *   critic 只训 qHead 那一段（selftest3 腿 G 证：非该段梯度逐位为 0 ⇒ 策略与基线在参数空间正交）。\n",
             " * `mean`（默认）= 现役常数基线（批内均值），逐字不变；`ridge` = 观测侧闭式岭回归基线（住在训练器里，不进包）。\n"
             " * ⚑ 原来的 `qhead` 档（用网络内的 qHead 当基线）随价值头一起在代 3 删除：10-31 深夜实测线性基线只解释 ~9% 方差，\n"
             " *   而它作为死段让每个下游都要为它写一条豁免 ⇒ 删。（ridge 档的实测 R² 中位也是这个量级。）\n")
s4, nl4 = C[g]
# 删掉 qHead 相关的声明与两个分支
for tag, st, en in [('pg-qdecl', 'const Q0 = ly.qHead, QN = ly.L.hid + 1;', 'const cadam'),
                    ('pg-cadam', 'const cadam = {', 'let criticZero'),
                    ('pg-zero', "if (BASELINE === 'qhead') {\n    for (let k = 0; k < QN; k++) {", '  }\n  adam.t++'),
                    ('pg-warm', '  if (BASELINE === \'qhead\' && WARM && !warmed) {', '  /* 优势的分母'),
                    ('pg-critic', '  if (BASELINE === \'qhead\') {\n    cadam.t++;', '  /* 回滚闸'),
                    ('pg-banner', "if (BASELINE === 'qhead') console.log('  ⚑ 基线 = 状态价值 V(s)", "if (PROBE > 0 &&")]:
    i = s4.find(st); 
    if i < 0:
        print('  !! %-10s 找不到起点（%s）' % (tag, st[:40])); continue
    j = s4.find(en, i)
    if j < 0:
        print('  !! %-10s 找不到终点（%s）' % (tag, en[:40])); continue
    s4 = s4[:i] + s4[j:]; print('  ok %-10s (切 %d 字符)' % (tag, j - i))
C[g] = (s4, nl4)
sub('pg-uq', g, "    const uq = BASELINE === 'qhead' ? 2 * (V - G) : 0;\n    tapeBackward(d.tape, pv, ly, act, g, grad, uq, 0);",
                  "    tapeBackward(d.tape, pv, ly, act, g, grad);")
sub('pg-vof', g, "const VOF = (d, mu) => (BASELINE === 'qhead' ? d.q : BASELINE === 'ridge' ? (d.qR == null ? mu : d.qR) : mu);",
                 "const VOF = (d, mu) => (BASELINE === 'ridge' ? (d.qR == null ? mu : d.qR) : mu);")
sub('pg-warmdecl', g, "const WARM = arg('criticWarm', '1') !== '0';   /* critic 从批均值起步（qHead 原本是死区，里面是上游随机/未训的值 ⇒ 不热身则 V 的偏置离 G 的尺度很远，Adam 归一步长爬不回来） */\n", "")
sub('pg-meta', g, " criticLr: BASELINE === 'qhead' ? CLRP : null,", " criticLr: null,")
sub('pg-meta2', g, "  critic: BASELINE === 'qhead' ? { qHeadOff: Q0, qHeadLen: QN, advDenom: 'sd(残差)', lastR2: +lastR2.toFixed(4) } : null,\n", "")
sub('pg-warmref', g, "  criticDiag: BASELINE === 'qhead' ? { warm: WARM, last: vDiag } : null,\n", "")
sub('pg-warmed', g, "let capDone = false, warmed = false, vDiag =", "let capDone = false, vDiag =")

for p, (s, nl) in C.items():
    save(p, s, nl)
print('stage B（测试 + 训练器）已写盘')
