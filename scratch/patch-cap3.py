import io
p = 'tools/proto2/pg-train.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

# 1) 决策记录带局号 + 手挑小特征
a = "  const me = state.p[pid];"
assert s.count(a) == 1, 'me'
s = s.replace(a, a + """
  const FEAT = PROBE_CAP ? [Math.min(1, state.round / 40), (me ? (me.hp || 0) / ((state.mode && state.mode.hp) || 3) : 0),
    (me ? Math.min(me.ep, 12) / 12 : 0), (me && me.elec ? 1 : 0), (me && me.boom ? 1 : 0),
    (me ? (me.ringStreak || 0) / 3 : 0), (me ? (me.cannonCount || 0) / 3 : 0)] : null;""", 1)

b = "      xinArr: PROBE_CAP ? Float64Array.from(fr.tape.xin) : null, hctxArr: PROBE_CAP ? null : null });"
assert s.count(b) == 1, 'rec'
s = s.replace(b, """      xinArr: PROBE_CAP ? Float64Array.from(fr.tape.xin) : null, feat: FEAT, gid: curGame.gid,
      qR: BASELINE === 'ridge' ? (RFIT ? ridgeV(RFIT, (RFEAT === 'small' ? FEAT : fr.tape.xin)) : null) : null });""", 1)

c = "    curGame = { decs: [], rng: mulberry32((SEED * 2654435761 ^ gameSeq * 40503) >>> 0) };"
assert s.count(c) == 1, 'curgame'
s = s.replace(c, "    curGame = { decs: [], gid: gameSeq, rng: mulberry32((SEED * 2654435761 ^ gameSeq * 40503) >>> 0) };", 1)

d = "const PROBE_CAP = arg('criticProbe', '0') === '1';"
assert s.count(d) == 1, 'pcap'
s = s.replace(d, """const PROBE_CAP = arg('criticProbe', '0') === '1' || String(arg('baseline', 'mean')) === 'ridge';
const RL2 = Number(arg('ridgeL2', 1e-2)) || 1e-2;
const RFEAT = String(arg('ridgeFeat', 'obs')) === 'small' ? 'small' : 'obs';   /* 基线读哪套：obs=xin 全宽 ‖ small=7 个手挑标量 */""", 1)

# 2) 整段换掉容量探针（含"按局切"与泄漏对照）
i0 = s.index("function valueCapacity(")
i1 = s.index("\n}\n", i0) + 3
new_fn = """function valueCapacity(A2, P, ly, samples) {
  const list = [];
  for (const g of samples) for (const d of g.ds) if (!d.push && d.xinArr && d.feat) list.push({ x: d.xinArr, f: d.feat, G: d.G, gid: d.gid });
  if (list.length < 200) { console.log('  ⚑ 容量探针：样本 ' + list.length + ' 不足 200 ⇒ 不读'); return; }
  const y = list.map((r) => r.G);
  GIDS = list.map((r) => r.gid);
  const nG = new Set(GIDS).size;
  FOLD_BY_GAME = true;
  const gX = ridgeR2(list.map((r) => r.x), y, 1e-2);
  const gF = ridgeR2(list.map((r) => r.f), y, 1e-2);
  FOLD_BY_GAME = false;
  const lX = ridgeR2(list.map((r) => r.x), y, 1e-2);
  console.log('  ⚑ 价值容量（岭回归**按局** 2 折留出 R²，n=' + list.length + ' ‖ 局=' + nG + '）：读 xin(' + list[0].x.length +
    ' 维) = ' + gX.toFixed(3) + ' ‖ 读手挑 7 标量 = ' + gF.toFixed(3));
  console.log('  ⚑ 同一份数据**按决策**切（泄漏对照）：读 xin = ' + lX.toFixed(3) + ' ‖ 虚高 ' + (lX - gX).toFixed(3) +
    (lX - gX > 0.05 ? ' ⇒ 泄漏占了大半：同局的决策同时进训练与测试（前一版 0.279 就是这么来的）' : ''));
}
"""
s = s[:i0] + new_fn + s[i1:]

# 3) ridgeR2 支持按局切分（默认按局，泄漏档显式关掉）
f = "function ridgeR2(X, y, l2) {"
assert s.count(f) == 1, 'ridge-def'
s = s.replace(f, "let FOLD_BY_GAME = true, GIDS = [];\nfunction ridgeR2(X, y, l2) {", 1)
g = "  const order = y.map((v, i) => i).sort((a, c) => a - c);\n  const folds = [order.filter((i) => i % 2 === 0), order.filter((i) => i % 2 === 1)];"
assert s.count(g) == 1, 'folds'
s = s.replace(g, """  const idx = X.map((v, i) => i);
  const folds = FOLD_BY_GAME
    ? [idx.filter((i) => (GIDS[i] & 1) === 0), idx.filter((i) => (GIDS[i] & 1) === 1)]
    : [idx.filter((i) => i % 2 === 0), idx.filter((i) => i % 2 === 1)];""", 1)

# 4) CAP 填充条件与拟合特征集
h = "      if (!x.d.hctxArr) { const act = tapeForward(x.d.tape, pv, ly); x.d.hctxArr = Float64Array.from(act.hctx); x.d.G = x.G; CAP.push(x.d); }"
if s.count(h) == 0:
    h = "      if (!x.d.hctxArr) { const act = tapeForward(x.d.tape, pv, ly); x.d.hctxArr = Float64Array.from(act.hctx); x.d.G = x.G; }\n      CAP.push(x.d);"
    assert s.count(h) == 1, 'capfill-alt'
    s = s.replace(h, "      if (!x.d.hctxArr && x.d.xinArr) { const act = tapeForward(x.d.tape, pv, ly); x.d.hctxArr = Float64Array.from(act.hctx); x.d.G = x.G; CAP.push(x.d); }", 1)
else:
    s = s.replace(h, "      if (!x.d.hctxArr && x.d.xinArr) { const act = tapeForward(x.d.tape, pv, ly); x.d.hctxArr = Float64Array.from(act.hctx); x.d.G = x.G; CAP.push(x.d); }", 1)

i2 = "    for (const { d, G } of decsBatch) { if (d.xinArr) { Xs.push(d.xinArr); ys.push(G); } }"
assert s.count(i2) == 1, 'fitX'
s = s.replace(i2, "    for (const { d, G } of decsBatch) { const xf = RFEAT === 'small' ? d.feat : d.xinArr; if (xf) { Xs.push(xf); ys.push(G); } }", 1)

# 5) meta
j2 = "  baseline: BASELINE, criticLr:"
assert s.count(j2) == 1, 'meta'
s = s.replace(j2, "  baseline: BASELINE, ridgeFeat: BASELINE === 'ridge' ? RFEAT : null, ridgeL2: BASELINE === 'ridge' ? RL2 : null, ridgeFitN: BASELINE === 'ridge' ? XsN : null, criticLr:", 1)
k2 = "let RFIT = null;"
assert s.count(k2) == 1, 'rfit'
s = s.replace(k2, "let XsN = 0;\nlet RFIT = null;", 1)
l2 = "    RFIT = ridgeFit(Xs, ys, RL2);"
assert s.count(l2) == 1, 'fitcall'
s = s.replace(l2, "    RFIT = ridgeFit(Xs, ys, RL2); XsN = Xs.length;", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched ok')
