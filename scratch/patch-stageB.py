import io

def load(p):
    raw = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), nl

def save(p, s, nl):
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)

import os
DRY = os.environ.get('DRY') == '1'
def rep(tag, p, a, b, want=1):
    s, nl = cache[p]
    n = s.count(a)
    print(('  [dry] %-9s %s → %d 处' % (tag, p.split('/')[-1], n)) if DRY else ('  ok %-9s %s' % (tag, p.split('/')[-1])))
    if DRY: return
    assert n == want, (tag, p, a[:60], n, want)
    cache[p] = (s.replace(a, b, want), nl)

cache = {}
for p in ['tools/proto2/arch2.mjs', 'js/train/policy2.js', 'tools/proto2/pg-lib.mjs', 'tools/proto2/fitness-noise.mjs',
          'tools/proto2/browser-parity.mjs', 'tools/proto2/pack2-audit.mjs', 'tools/proto2/supfit-gd.mjs',
          'tools/proto2/selftest2.mjs', 'tools/proto2/selftest3.mjs']:
    cache[p] = load(p)

# ---------------- 1) arch2：段表 / fanIn / outDim / 两条前向的 q ----------------
rep('seg', 'tools/proto2/arch2.mjs', "    { name: 'qHead', off: 0, len: hid + 1 },\n", "")
rep('fanIn', 'tools/proto2/arch2.mjs', "policyHead: hid2, qHead: hid, inter:", "policyHead: hid2, inter:")
rep('outDim', 'tools/proto2/arch2.mjs', "policyHead: 1, qHead: 1 };", "policyHead: 1 };")
rep('offDecl', 'tools/proto2/arch2.mjs', "const headOff = L.seg[4].off, qOff = L.seg[5].off;", "const headOff = L.seg[4].off;", 2)
rep('qCalc', 'tools/proto2/arch2.mjs', "    let q = params[qOff + L.hid]; for (let j = 0; j < L.hid; j++) q += params[qOff + j] * hctx[j];\n", "")
rep('ret', 'tools/proto2/arch2.mjs', "logits, q, phi: phiRet", "logits, phi: phiRet")
rep('hdr', 'tools/proto2/arch2.mjs', "  /* 逐候选打分 + Q(s)；返回与 v7 同形状的 {probs, argmax, cand, logits, q} */",
    "  /* 逐候选打分；返回 {probs, argmax, cand, logits}（Q(s) 头已于代 3 删除：段表里不存在没人读的参数） */")

# ---------------- 2) 浏览器镜像 ----------------
rep('p2seg', 'js/train/policy2.js', "      { name: 'qHead', len: L.hid + 1 },\n", "")
rep('p2off', 'js/train/policy2.js', "    const headOff = L.seg[4].off, qOff = L.seg[5].off;", "    const headOff = L.seg[4].off;")
rep('p2q', 'js/train/policy2.js', "    let qv = params[qOff + L.hid]; for (let j = 0; j < L.hid; j++) qv += params[qOff + j] * hctx[j];\n", "")
rep('p2ret', 'js/train/policy2.js', "return { probs, argmax: arg, cand: cands[arg] || null, logits, q: qv, ...(TP ? { tape: TP } : {}) };",
                          "return { probs, argmax: arg, cand: cands[arg] || null, logits, ...(TP ? { tape: TP } : {}) };")

# ---------------- 3) pg-lib：价值通路整体撤掉 ----------------
rep('pgl-off', 'tools/proto2/pg-lib.mjs', "    qHead: segOf('qHead'),\n", "")
rep('pgl-decl', 'tools/proto2/pg-lib.mjs', "  const qOff = ly.qHead;\n", "")
rep('pgl-q', 'tools/proto2/pg-lib.mjs', """  /* ⚑ 状态价值 q（10-31 深夜接上）：`arch2` 的两条前向一直在算它并 return，但**没有任何目标函数读它**
   *   （selftest2 T18 ② 甚至拿它当死区对照）。actor-critic 的基线要用它，就得连它的导数一起给。
   *   逐字照 arch2:341：q = b + Σ_j w_j·hctx_j ⇒ dq/dw_j = hctx_j、dq/db = 1、dq/dhctx_j = w_j。 */
  let q = params[qOff + hid];
  for (let j = 0; j < hid; j++) q += params[qOff + j] * hctx[j];
  if (!Number.isFinite(q)) throw new Error('tapeForward: q 非有限 ⇒ qHead 段或 hctx 有洞');
""", "")
rep('pgl-ret', 'tools/proto2/pg-lib.mjs', "hcs, logits, q };", "hcs, logits };")
rep('pgl-sig', 'tools/proto2/pg-lib.mjs', "export function tapeBackward(tape, params, ly, act, upstream, grad, upstreamQ, qTrunk) {",
                                        "export function tapeBackward(tape, params, ly, act, upstream, grad) {")
rep('pgl-bq', 'tools/proto2/pg-lib.mjs', """  /* 价值通路（uq = dL/dq）：qHead 自己的梯度 + 把 dq/dhctx = w 汇进 dhctxTot（**必须在 ctx 层掩码之前**，
   *   这样 hctx 的 ReLU 掩码、ctx 权重、xin 尾块、席编码四条路全部自动接上——与策略路共用同一次反传） */
  if (upstreamQ) {
    if (Number.isNaN(upstreamQ)) throw new Error('tapeBackward: upstreamQ 是 NaN ⇒ 拒绝静默跳过');
    /* 默认**只动 qHead 那一段**（selftest2 T18 ② 的"灌 qHead 不动 logits"因此仍然成立 ⇒ 策略与基线在参数空间正交，
       *   critic 不会把共享 trunk 拖走）。要 critic 也回传进 trunk 才传第 8 个参数 qTrunk=1。 */
    for (let j = 0; j < hid; j++) grad[qOff + j] += upstreamQ * act.hctx[j];
    grad[qOff + hid] += upstreamQ;
    if (qTrunk) for (let j = 0; j < hid; j++) dhctxTot[j] += upstreamQ * params[qOff + j];
  }
""", "")

# ---------------- 4) fitness-noise 的段表映射 ----------------
rep('fn-bias', 'tools/proto2/fitness-noise.mjs', "policyHead: 1, qHead: 1}", "policyHead: 1}")

# ---------------- 5) browser-parity：不再有豁免段 ----------------
rep('bp-cmp', 'tools/proto2/browser-parity.mjs', "    if (a.q !== b.q) bad.push('Q(s) " + chr(19998) + "同 t=' + t + '（' + a.q + ' vs ' + b.q + '）');" + chr(92) + "n", "")
rep('bp-cont', 'tools/proto2/browser-parity.mjs', """  if (s.name === 'qHead') continue;                  // qHead 不参与组内排序是**结构承诺** ⇒ 它另列一条对照
""", "")
rep('bp-ctl', 'tools/proto2/browser-parity.mjs', """const qq = swapSeg('qHead', 30);
const bq = P2.forwardCands(W, F0.st, F0.pid, F0.cands, qq, { temp: 0.15 });
const qDead = Array.from(bq.logits).join(',') === baseKey && bq.q !== base0.q;
""", "const qDead = true;   // 代 3 起没有豁免段：下面那句逐段有牙就是全部的账\n")

for p in ['tools/proto2/browser-parity.mjs']:
    s, nl = cache[p]
    s = s.replace("  ' ‖ qHead 对照（换整段 logits 不许变而 Q(s) 必须变）：' + (qDead ? '成立 ✔' :", "  ' ‖（无豁免段：代 3 起段表里没有没人读的参数）': '') + (qDead ? ' ✔' :")
    s = s.replace("if (!qDead) { console.error('⛔ qHead 那条对照不过", "if (!qDead) { console.error('⛔ 逐段有牙被跳过")
    cache[p] = (s, nl)

# ---------------- 6) pack2-audit：C 段不再有豁免/死区对照 ----------------
rep('pa-rows', 'tools/proto2/pack2-audit.mjs', "policyHead: 1, qHead: 1 };", "policyHead: 1 };")
rep('pa-ind', 'tools/proto2/pack2-audit.mjs', "policyHead: L.hid2, qHead: L.hid", "policyHead: L.hid2")
rep('pa-w1', 'tools/proto2/pack2-audit.mjs', "const wLen = s.name === 'policyHead' ? L.hid2 : (s.name === 'qHead' ? L.hid : rowsOf[s.name] * inDim);",
                                       "const wLen = s.name === 'policyHead' ? L.hid2 : rowsOf[s.name] * inDim;")
rep('pa-w2', 'tools/proto2/pack2-audit.mjs', "    const wLen = s.name === 'policyHead' ? L.hid2 : (s.name === 'qHead' ? L.hid : rowsOf[s.name] * inDim);",
                                       "    const wLen = s.name === 'policyHead' ? L.hid2 : rowsOf[s.name] * inDim;")

for p in ['tools/proto2/pack2-audit.mjs']:
    s, nl = cache[p]
    i0 = s.index("    if (s.name === 'qHead') continue;")
    i1 = s.index("\n", i0) + 1
    s = s[:i0] + s[i1:]
    j0 = s.index("  for (let i = 0; i < sg.qHead.len; i++) pq[sg.qHead.off + i] = (rng() - 0.5) * 100;")
    j1 = s.index("\n", j0) + 1
    s = s[:j0] + s[j1:]
    cache[p] = (s, nl)

# ---------------- 7) supfit-gd：跨代搬运要显式去掉 qHead 那一段 ----------------
rep('sg-carry', 'tools/proto2/supfit-gd.mjs', "const up = KS ? Float64Array.from(raw.a || []) : P.unpack(raw, true);",
 """const up = KS ? (() => {
    /* 代 2 → 代 3 的搬运是**显式重解释**：去掉源容器 layout.seg 里 qHead 那一段（代 3 已删价值头）。
     *   找不到 qHead 就说明源已是代 3 ⇒ 原样搬；长度仍不等 ⇒ 下面的守卫会响亮拒收。 */
    const sg = ((raw.layout && raw.layout.seg) || []).find((x) => x.name === 'qHead');
    const a = Float64Array.from(raw.a || []);
    if (!sg) return a;
    console.log('  ⚑ 跨代搬运：从源容器去掉 qHead 段 [' + sg.off + ',' + (sg.off + sg.len) + ') 共 ' + sg.len + ' 个参数（代 3 无价值头）');
    return Float64Array.from(a.subarray(0, sg.off)).concat(a.subarray(sg.off + sg.len));
  })() : P.unpack(raw, true);""")

for p, (s, nl) in cache.items():
    save(p, s, nl)
print('stage B (结构侧 + 工具侧) patched')
