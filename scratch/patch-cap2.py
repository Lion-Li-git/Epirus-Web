import io
p = 'tools/proto2/pg-train.mjs'
s = io.open(p, encoding='utf-8', newline='').read()
orig = s

# 1) 决策记录带上局号与小特征向量（容量探针按局切分要用）
a = "  const me = state.p[pid];"
assert s.count(a) == 1, 'me'
s = s.replace(a, """  const me = state.p[pid];
  const FEAT = PROBE_CAP ? [Math.min(1, state.round / (me ? 40 : 40)), (me ? (me.hp || 0) / (state.mode && state.mode.hp || 3) : 0),
    (me ? Math.min(me.ep, 12) / 12 : 0), (me && me.elec ? 1 : 0), (me && me.boom ? 1 : 0), (me ? (me.ringStreak || 0) / 3 : 0),
    (me ? (me.cannonCount || 0) / 3 : 0)] : null;""", 1)

b = "qR: BASELINE === 'ridge' ? (RFIT ? ridgeV(RFIT, fr.tape.xin) : null) : null });"
assert s.count(b) == 1, 'rec'
s = s.replace(b, "qR: BASELINE === 'ridge' ? (RFIT ? ridgeV(RFIT, FEATSEL(d0)) : null) : null,\n      feat: FEAT, gid: curGame.gid });", 1)

c = "    curGame = { decs: [], rng: mulberry32((SEED * 2654435761 ^ gameSeq * 40503) >>> 0) };"
assert s.count(c) == 1, 'curgame'
s = s.replace(c, "    curGame = { decs: [], gid: gameSeq, rng: mulberry32((SEED * 2654435761 ^ gameSeq * 40503) >>> 0) };", 1)

# 2) 特征选择器 + 开关
d = "const RL2 = Number(arg('ridgeL2', 1e-2)) || 1e-2;   /* 观测侧线性基线的岭系数 */"
assert s.count(d) == 1, 'rl2'
s = s.replace(d, d + """
const RFEAT = String(arg('ridgeFeat', 'obs')) === 'small' ? 'small' : 'obs';   /* 基线读哪套特征：obs=xin 全宽(134) ‖ small=7 个手挑标量 */
const FEATSEL = (x) => (RFEAT === 'small' ? x.d.feat : x.d.xinArr);""", 1)

# 采集时把 xin 也留下（ridge obs 档需要），并把 feat 存进决策
e = "xinArr: PROBE_CAP ? Float64Array.from(fr.tape.xin) : null, hctxArr: PROBE_CAP ? null : null,"
assert s.count(e) == 1, 'xin'
s = s.replace(e, "xinArr: PROBE_CAP ? Float64Array.from(fr.tape.xin) : null, hctxArr: null,", 1)

# 3) 容量探针：按**局**切分（同局决策同时进训练与测试 = 泄漏，前一版就栽在这儿）
f = """  const order = y.map((v, i) => i).sort((a, c) => a - c);
  const folds = [order.filter((i) => i % 2 === 0), order.filter((i) => i % 2 === 1)];"""
assert s.count(f) == 1, 'folds'
s = s.replace(f, """  /* foldsByGame=false 是**故意留的泄漏对照**：按决策下标奇偶切 ⇒ 同一局的决策两边都有 ⇒ R² 虚高 */
  const folds = FOLD_BY_GAME
    ? [list.map((r, i) => i).filter((i) => (GIDS[i] & 1) === 0), list.map((r, i) => i).filter((i) => (GIDS[i] & 1) === 1)]
    : [list.map((r, i) => i).filter((i) => i % 2 === 0), list.map((r, i) => i).filter((i) => i % 2 === 1)];""", 1)

g2 = "function ridgeR2(X, y, l2) {"
assert s.count(g2) == 1, 'ridgedef'
s = s.replace(g2, "let FOLD_BY_GAME = true, GIDS = [];\nfunction ridgeR2(X, y, l2) {", 1)

# 4) 探针调用：两种切法都跑，让泄漏看得见
h2 = """  const rH = ridgeR2(list.map((r) => r.h), y, 1e-2);
  const rX = ridgeR2(list.map((r) => r.x), y, 1e-2);
  console.log('  ⚑ 价值容量（岭回归 2 折留出 R²，n=' + list.length + '）：读 **hctx**(' + ly.L.hid + ' 维) = ' + rH.toFixed(3) +
    ' ‖ 读 **xin**(' + ly.L.ctxDim + ' 维) = ' + rX.toFixed(3) +
    (rX > rH + 0.1 ? ' ⇒ 状态价值住在**观测侧**、不在策略压缩里 ⇒ qHead 想当好基线得改它的输入（结构决定，留给用户裁）' : ''));"""
assert s.count(h2) == 1, 'probe-print'
s = s.replace(h2, """  const Xh = list.map((r) => r.h), Xx = list.map((r) => r.x), Xf = list.map((r) => r.f);
  GIDS = list.map((r) => r.gid);
  FOLD_BY_GAME = true;
  const gH = ridgeR2(Xh, y, 1e-2), gX = ridgeR2(Xx, y, 1e-2), gF = ridgeR2(Xf, y, 1e-2);
  FOLD_BY_GAME = false;
  const lX = ridgeR2(Xx, y, 1e-2);
  console.log('  ⚑ 价值容量（岭回归**按局** 2 折留出 R²，n=' + list.length + ' ‖ 局=' + new Set(GIDS).size +
    '）：读 hctx(' + Xh[0].length + ' 维) = ' + gH.toFixed(3) + ' ‖ 读 xin(' + Xx[0].length + ' 维) = ' + gX.toFixed(3) +
    ' ‖ 读手挑 7 标量 = ' + gF.toFixed(3));
  console.log('  ⚑ 同一份数据**按决策**切（泄漏对照）：读 xin = ' + lX.toFixed(3) +
    (lX - gX > 0.05 ? ' ⇒ 上一版的 0.279 里大半是这个泄漏（同局决策同时进训练与测试）' : ''));""", 1)

i2 = "if (!d.push && d.xinArr && d.hctxArr) list.push({ x: d.xinArr, h: d.hctxArr, G: d.G });"
assert s.count(i2) == 1, 'listpush'
s = s.replace(i2, "if (!d.push && d.xinArr && d.hctxArr && d.feat) list.push({ x: d.xinArr, h: d.hctxArr, f: d.feat, G: d.G, gid: d.gid });", 1)

j2 = "      if (!x.d.hctxArr) { const act = tapeForward(x.d.tape, pv, ly); x.d.hctxArr = Float64Array.from(act.hctx); x.d.G = x.G; CAP.push(x.d); }"
assert s.count(j2) == 1, 'capfill'
s = s.replace(j2, "      if (!x.d.hctxArr && x.d.xinArr) { const act = tapeForward(x.d.tape, pv, ly); x.d.hctxArr = Float64Array.from(act.hctx); x.d.G = x.G; CAP.push(x.d); }", 1)

# 5) ridge 拟合改用选定的特征集
k2 = "    for (const { d, G } of decsBatch) { if (d.xinArr) { Xs.push(d.xinArr); ys.push(G); } }"
assert s.count(k2) == 1, 'fitX'
s = s.replace(k2, "    for (const { d, G } of decsBatch) { const xf = RFEAT === 'small' ? d.feat : d.xinArr; if (xf) { Xs.push(xf); ys.push(G); } }", 1)

l2 = "RFIT = ridgeFit(Xs, ys, RL2);"
assert s.count(l2) == 1, 'fitcall'
s = s.replace(l2, "RFIT = ridgeFit(Xs, ys, RL2); RFITSZ = Xs.length;", 1)

m2 = "let RFIT = null;   /* 上一次的拟合（初始 null ⇒ 第一批退回常数基线） */"
assert s.count(m2) == 1, 'rfitdecl'
s = s.replace(m2, m2 + "\nlet RFITSZ = 0;", 1)

# 6) qR 的记录要按同一特征集打分（FEATSEL 需要 d 已在作用域里 ⇒ 直接内联）
n2 = "qR: BASELINE === 'ridge' ? (RFIT ? ridgeV(RFIT, FEATSEL(d0)) : null) : null,"
assert s.count(n2) == 1, 'qr'
s = s.replace(n2, "qR: BASELINE === 'ridge' ? (RFIT ? ridgeV(RFIT, (RFEAT === 'small' ? FEAT : fr.tape.xin)) : null) : null,", 1)

o2 = "  baseline: BASELINE, ridgeL2: BASELINE === 'ridge' ? RL2 : null,"
assert s.count(o2) == 1, 'meta'
s = s.replace(o2, "  baseline: BASELINE, ridgeFeat: BASELINE === 'ridge' ? RFEAT : null, ridgeFitN: BASELINE === 'ridge' ? RFITSZ : null, ridgeL2: BASELINE === 'ridge' ? RL2 : null,", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched, bytes %d -> %d' % (len(orig), len(s)))
