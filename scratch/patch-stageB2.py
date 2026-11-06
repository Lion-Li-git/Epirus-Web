import io, os
DRY = os.environ.get('DRY') == '1'

def load(p):
    raw = io.open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), nl

FILES = ['tools/proto2/arch2.mjs', 'js/train/policy2.js', 'tools/proto2/pg-lib.mjs', 'tools/proto2/fitness-noise.mjs',
         'tools/proto2/browser-parity.mjs', 'tools/proto2/pack2-audit.mjs', 'tools/proto2/supfit-gd.mjs']
C = {p: load(p) for p in FILES}

def rep(tag, p, a, b, least=1):
    s, nl = C[p]
    n = s.count(a)
    if DRY: print('  [dry] %-9s %s → %d' % (tag, p.split('/')[-1], n)); return
    assert n >= least, (tag, p, a[:70], n)
    C[p] = (s.replace(a, b), nl)
    print('  ok  %-9s %s (%d 处)' % (tag, p.split('/')[-1], n))

def dropline(tag, p, prefix):
    """按行首前缀整行删掉（用于我记不准行内文案的地方）"""
    s, nl = C[p]
    keep = [l for l in s.split('\n') if not l.strip().startswith(prefix)]
    gone = len(s.split('\n')) - len(keep)
    if DRY: print('  [dry] %-9s %s → %d 行' % (tag, p.split('/')[-1], gone)); return
    assert gone >= 1, (tag, p, prefix)
    C[p] = ('\n'.join(keep), nl)
    print('  ok  %-9s %s (删 %d 行)' % (tag, p.split('/')[-1], gone))

def cut_between(tag, p, start_sub, end_sub):
    s, nl = C[p]
    i = s.find(start_sub)
    if i < 0:
        if DRY: print('  [dry] %-9s 找不到' % tag); return
        raise AssertionError((tag, start_sub[:40]))
    j = s.find(end_sub, i)
    assert j > i, (tag, end_sub[:40])
    C[p] = (s[:i] + s[j:], nl)
    print('  ok  %-9s %s (切掉 %d 字符)' % (tag, p.split('/')[-1], j - i))

# ---------- arch2 ----------
rep('seg', 'tools/proto2/arch2.mjs', "    { name: 'qHead', off: 0, len: hid + 1 },\n", "")
rep('fanIn', 'tools/proto2/arch2.mjs', "policyHead: hid2, qHead: hid, inter:", "policyHead: hid2, inter:")
rep('outDim', 'tools/proto2/arch2.mjs', "policyHead: 1, qHead: 1 };", "policyHead: 1 };")
rep('offDecl', 'tools/proto2/arch2.mjs', "const headOff = L.seg[4].off, qOff = L.seg[5].off;", "const headOff = L.seg[4].off;")
rep('qCalc', 'tools/proto2/arch2.mjs', "    let q = params[qOff + L.hid]; for (let j = 0; j < L.hid; j++) q += params[qOff + j] * hctx[j];\n", "")
rep('ret', 'tools/proto2/arch2.mjs', "logits, q, phi: phiRet", "logits, phi: phiRet")
rep('hdr', 'tools/proto2/arch2.mjs', "  /* 逐候选打分 + Q(s)；返回与 v7 同形状的 {probs, argmax, cand, logits, q} */",
    "  /* 逐候选打分；返回 {probs, argmax, cand, logits}（Q(s) 头已于代 3 删除 ⇒ 段表里不存在没人读的参数） */")

# ---------- 浏览器镜像 ----------
rep('p2seg', 'js/train/policy2.js', "      { name: 'qHead', len: L.hid + 1 },\n", "")
rep('p2off', 'js/train/policy2.js', "const headOff = L.seg[4].off, qOff = L.seg[5].off;", "const headOff = L.seg[4].off;")
dropline('p2q', 'js/train/policy2.js', "let qv = params[qOff + L.hid];")
rep('p2ret', 'js/train/policy2.js', "cands[arg] || null, logits, q: qv, ...(TP", "cands[arg] || null, logits, ...(TP")

# ---------- pg-lib ----------
rep('pgl-off', 'tools/proto2/pg-lib.mjs', "    qHead: segOf('qHead'),\n", "")
rep('pgl-decl', 'tools/proto2/pg-lib.mjs', "  const qOff = ly.qHead;\n", "")
cut_between('pgl-q', 'tools/proto2/pg-lib.mjs', "  /* ⚑ 状态价值 q", "  return { e, eArr,")
rep('pgl-ret', 'tools/proto2/pg-lib.mjs', "hcs, logits, q };", "hcs, logits };")
rep('pgl-sig', 'tools/proto2/pg-lib.mjs', "export function tapeBackward(tape, params, ly, act, upstream, grad, upstreamQ, qTrunk) {",
                                    "export function tapeBackward(tape, params, ly, act, upstream, grad) {")
cut_between('pgl-bq', 'tools/proto2/pg-lib.mjs', "  /* 价值通路（uq = dL/dq）", "  /* ctx 层")

# ---------- fitness-noise ----------
rep('fn-bias', 'tools/proto2/fitness-noise.mjs', "policyHead: 1, qHead: 1, inter:", "policyHead: 1, inter:")

# ---------- browser-parity ----------
dropline('bp-cmp', 'tools/proto2/browser-parity.mjs', "if (a.q !== b.q) bad.push(")
dropline('bp-cont', 'tools/proto2/browser-parity.mjs', "if (s.name === 'qHead') continue;")
dropline('bp-qq', 'tools/proto2/browser-parity.mjs', "const qq = swapSeg('qHead'")
dropline('bp-bq', 'tools/proto2/browser-parity.mjs', "const bq = P2.forwardCands(W, F0.st, F0.pid, F0.cands, qq")
dropline('bp-qd', 'tools/proto2/browser-parity.mjs', "const qDead =")

# ---------- pack2-audit ----------
rep('pa-rows', 'tools/proto2/pack2-audit.mjs', "policyHead: 1, qHead: 1 };", "policyHead: 1 };")
rep('pa-ind', 'tools/proto2/pack2-audit.mjs', "policyHead: L.hid2, qHead: L.hid", "policyHead: L.hid2")
rep('pa-w', 'tools/proto2/pack2-audit.mjs', "const wLen = s.name === 'policyHead' ? L.hid2 : (s.name === 'qHead' ? L.hid : rowsOf[s.name] * inDim);",
                          "const wLen = s.name === 'policyHead' ? L.hid2 : rowsOf[s.name] * inDim;")
dropline('pa-cont', 'tools/proto2/pack2-audit.mjs', "if (s.name === 'qHead') continue;")
dropline('pa-fill', 'tools/proto2/pack2-audit.mjs', "for (let i = 0; i < sg.qHead.len; i++)")

# ---------- supfit-gd：跨代搬运显式去掉 qHead ----------
rep('sg-carry', 'tools/proto2/supfit-gd.mjs', "const up = KS ? Float64Array.from(raw.a || []) : P.unpack(raw, true);",
 """const up = KS ? (() => {
    /* 代 2 → 代 3 的搬运是**显式重解释**：去掉源容器 layout.seg 里 qHead 那一段（代 3 已删价值头）。
     *   源里没有 qHead ⇒ 它本来就是代 3，原样搬；搬完长度仍不等 ⇒ 下面的守卫响亮拒收，不静默截断。 */
    const sq = ((raw.layout && raw.layout.seg) || []).find((x) => x.name === 'qHead');
    let a = Float64Array.from(raw.a || []);
    if (sq) {
      console.log('  ⚑ 跨代搬运：从源容器去掉 qHead 段 [' + sq.off + ',' + (sq.off + sq.len) + ') 共 ' + sq.len + ' 个参数（代 3 无价值头）');
      a = Float64Array.from(a.subarray(0, sq.off)).concat(a.subarray(sq.off + sq.len));
    }
    return a;
  })() : P.unpack(raw, true);""")

if not DRY:
    for p, (s, nl) in C.items():
        io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('DRY' if DRY else 'stage B 结构侧 + 工具侧已写盘')
