import io

p = 'tools/proto2/skill-mastery.mjs'
raw = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')
orig = len(s)

def rep(tag, a, b, least=1):
    global s
    n = s.count(a)
    assert n >= least, (tag, a[:70], n)
    s = s.replace(a, b)
    print('  ok %-10s (%d)' % (tag, n))

# ---------- 1) 头部判据措辞 ----------
rep('hdr',
 " *   5 miniT   ≥0.2 次/局（各格）∧ ≥1/2 打 lastSkill∈{ring,bigT,railgun}",
 " *   5 miniT   ≥0.2 次/局（各格）∧ ≥1/2 打 [ep≥2 ∧ 最近 4 回合内 ok 蓄过珠] 的席（**预示式代理**，见下面 MINIT_ERA）")

# ---------- 2) 口径换代常量 + 代理定义 ----------
rep('const',
 "const MINIT_TARGETS = ['ring', 'bigT', 'railgun'];",
 "/* ⚑ 口径换代（10-31 深夜，`RESULTS-2026-10-31-OBS3B-SWITCH-qoder.md` §二十二）：旧线『miniT 打 lastSkill∈{ring,bigT,railgun} 的用户』\n"
 " *   实测**方向反了**——按 900+ 个真局决策点量，那种目标『随后 ≤2 回合真放 railgun』的 precision = **0.00%（×0.00）**，比随机选目标还差：\n"
 " *   railgun 开完珠就空、bigT 落完 ep 归零 ⇒『刚用过这些键的人』＝此刻没有威胁的人。新线换成**预示式代理**：\n"
 " *   目标 ep≥2（开炮的硬条件之一，面内可见）∧ 该目标在最近 `MINIT_WINDOW` 回合内有过一次 ok 的 charge（出珠动作）。\n"
 " *   同法量的 precision→railgun = **87.99%（×7.62）** / 对照阵容 30.53%（×10.42）。旧口径的在册 miniT 语义读数属换代前，**不许与新线横比**。 */\n"
 "const MINIT_ERA = 'predictive-2026-10-31';\n"
 "const MINIT_EP_MIN = 2;\n"
 "const MINIT_WINDOW = 4;")

# ---------- 3) 审计循环：按回合记每席最近一次 ok 蓄珠 ----------
rep('init',
 "      let ringRun = 0;",
 "      const chargeRound = {};              /* pid → 该席最近一次 ok charge 的回合（预示式代理用；只写已经发生的事实，不偷看未来） */\n"
 "      let ringRun = 0;")

rep('sem',
 "        if (pk.key === R.SK.MINI_T) {\n"
 "          st.sem.miniTN++;\n"
 "          if (isTargetWith(pk, MINIT_TARGETS)) st.sem.miniTHit++;\n"
 "        }",
 "        if (pk.key === R.SK.MINI_T) {\n"
 "          st.sem.miniTN++;\n"
 "          if (miniTPredictive(pk, chargeRound, row.round)) st.sem.miniTHit++;\n"
 "        }\n"
 "        if (pk.key === R.SK.CHARGE) chargeRound[pk.pid] = row.round;")

# ---------- 4) 代理函数（放在 isTargetWith 旁边，门与正式尺共用同一份） ----------
rep('fn',
 "/* 时机旗：heat=上一回合被 ≥2 个不同 source 打过；lead=我 ep 为存活(并列)最高；low=我 hp 为存活最低 */",
 "/** miniT 语义（预示式代理，`MINIT_ERA`）：目标 ep≥2 ∧ 目标在最近 MINIT_WINDOW 回合内有过一次 ok charge。\n"
 " *   只读决策时刻的快照（`pk.opps`）与**已发生**的 charge 回合 ⇒ 同一行内如果目标这一回合还没行动，那条事实不偷看。 */\n"
 "function miniTPredictive(pk, chargeRound, roundNow) {\n"
 "  if (pk.target == null) return false;\n"
 "  const o = (pk.opps || []).find((x) => x.pid === pk.target);\n"
 "  if (!o || (o.ep || 0) < MINIT_EP_MIN) return false;\n"
 "  const cr = chargeRound[pk.target];\n"
 "  if (cr == null) return false;\n"
 "  const gap = roundNow - cr;\n"
 "  return gap >= 1 && gap <= MINIT_WINDOW;\n"
 "}\n"
 "/* 时机旗：heat=上一回合被 ≥2 个不同 source 打过；lead=我 ep 为存活(并列)最高；low=我 hp 为存活最低 */")

# ---------- 5) 判词：分母 0 要说『读不出』，措辞跟新口径对齐 ----------
rep('verdict',
 "  v.miniT = { pass: minRate('miniT') >= L.miniT && (isShort || (mtN > 0 && mtH / mtN >= 0.5)), actual: pct(minRate('miniT')) + '/局，反制 ' + mtH + '/' + mtN, line: L.miniT + '/局（各格）' + (isShort ? '（语义只记录）' : ' ∧ 打 ring/bigT/railgun 用户≥1/2') };",
 "  /* ⚑ mtN=0 时不许写成『反制 0/0 = 0%』——那与『真的每次都打错』同形（分母为 0 的 0% 在册规矩）。 */\n"
 "  v.miniT = { pass: minRate('miniT') >= L.miniT && (isShort || (mtN > 0 && mtH / mtN >= 0.5)),\n"
 "    unreadable: !isShort && mtN === 0,\n"
 "    actual: pct(minRate('miniT')) + '/局，' + (mtN === 0 ? '语义**读不出**（这格一次 miniT 都没出手 ⇒ 分母 0，不是 0%）' : '预示代理命中 ' + mtH + '/' + mtN),\n"
 "    line: L.miniT + '/局（各格）' + (isShort ? '（语义只记录）' : ' ∧ 打 [ep≥2 ∧ 最近 ' + MINIT_WINDOW + ' 回合蓄过珠] 的席≥1/2'),\n"
 "    semEra: MINIT_ERA };")

# ---------- 6) 对照 bot：smart:miniT（新线必过）/ dumb:miniT（旧线的"理想打法"，新线必不过） ----------
rep('bots',
 "  } else if (spec === 'hybrid:railgun') {",
 "  } else if (spec === 'smart:miniT' || spec === 'dumb:miniT') {\n"
 "    /* 新口径的**已知答案对照**（自证 D 腿）：smart 按预示代理选目标（目标 ep≥2 且上一手刚 ok 蓄过珠）⇒ 新线必须判命中 ≥1/2；\n"
 "    *   dumb 按**旧口径**的理想目标选（目标 lastSkill∈{ring,bigT,railgun}）⇒ 新线必须判不过。两条一对，就证明这条腿真的在量方向，\n"
 "    *   而不是换了个名字恒真。smart 用 lastSkill==='charge' 当『刚蓄过珠』的充分条件（gap=1，天然落在窗口里）。 */\n"
 "    const OLD = ['ring', 'bigT', 'railgun'];\n"
 "    const SMART = spec === 'smart:miniT';\n"
 "    chooser = function (state, pid) {\n"
 "      const pickT = () => {\n"
 "        for (let i = 0; i < state.p.length; i++) {\n"
 "          if (i === pid || state.p[i].hp <= 0) continue;\n"
 "          const q = state.p[i];\n"
 "          const hit = SMART ? (q.lastSkill === 'charge' && (q.ep || 0) >= MINIT_EP_MIN)\n"
 "                            : (OLD.indexOf(q.lastSkill || '') >= 0);\n"
 "          if (hit) return i;\n"
 "        }\n"
 "        return -1;\n"
 "      };\n"
 "      const t = pickT();\n"
 "      const affMini = (global.LegalCache && false) || true;   /* 不看 legal：出手失败由 ok 计数负责，对照要的是『选谁』 */\n"
 "      if (t >= 0 && affMini) return { key: 'miniT', target: t };\n"
 "      return { key: 'ji' };\n"
 "    };\n"
 "    label = spec;\n"
 "  } else if (spec === 'hybrid:railgun') {")

# ---------- 7) 自证加 D 腿 ----------
rep('legD',
 "  console.log('[自证·B 阴性] fixed:gun —— 六条全 ✘');",
 "  console.log('[自证·D miniT 语义方向] smart:miniT 必须过、dumb:miniT（旧口径的理想打法）必须不过（long n=3 × 12 局）');\n"
 "  {\n"
 "    const one = (spec) => {\n"
 "      const a = auditOne(spec, { games: 12 });\n"
 "      const st = a.cells[0];\n"
 "      return { n: st.sem.miniTN, h: st.sem.miniTHit, v: verdictOf(a).miniT };\n"
 "    };\n"
 "    const sm = one('smart:miniT'), dm = one('dumb:miniT');\n"
 "    const smOk = sm.n > 0 && sm.h / sm.n >= 0.5;\n"
 "    const dmBad = !(dm.n > 0 && dm.h / dm.n >= 0.5);\n"
 "    console.log('  ' + (smOk ? '✔' : '✘') + ' smart:miniT 预示代理命中 ' + sm.h + '/' + sm.n + '（要 ≥1/2 且分母 >0）');\n"
 "    console.log('  ' + (dmBad ? '✔' : '✘') + ' dumb:miniT（按旧口径选目标）命中 ' + dm.h + '/' + dm.n + '（新线**不该**认它；认了说明这条腿是换名恒真）');\n"
 "    if (!smOk || !dmBad) fail++;\n"
 "  }\n"
 "  console.log('[自证·B 阴性] fixed:gun —— 六条全 ✘');")

# ---------- 8) 输出里带上口径时代 ----------
rep('era',
 "  console.log('[' + head + ']');",
 "  console.log('[' + head + '] ‖ miniT 语义口径 = ' + MINIT_ERA + '（预示式代理；旧口径读数属换代前，不横比）');")

io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('skill-mastery 口径换代已写盘（NL=%r）字符 %d → %d' % (nl, orig, len(s)))

# ---------- 9) probe-cem-arm 那句旧措辞的注释跟着改（门骑同一把尺） ----------
p2 = 'tools/probe-cem-arm.mjs'
r2 = io.open(p2, encoding='utf-8', newline='').read()
n2 = '\r\n' if '\r\n' in r2 else '\n'
s2 = r2.replace('\r\n', '\n')
a2 = "/* `--masterySem=1`（勘误六）：达标数从\"出手率\"换\"语义命中数/局\"（laserEye→打防席、miniT→打 ring/bigT/railgun"
b2 = "/* `--masterySem=1`（勘误六）：达标数从\"出手率\"换\"语义命中数/局\"（laserEye→打防席、miniT→打 [ep≥2 ∧ 最近 4 回合蓄过珠]"
if s2.count(a2) == 1:
    s2 = s2.replace(a2, b2)
    io.open(p2, 'w', encoding='utf-8', newline='').write(s2.replace('\n', n2) if n2 == '\r\n' else s2)
    print('probe-cem-arm 注释跟着改（miniT 语义同新口径）')
else:
    print('!! probe-cem-arm 锚点命中 %d ⇒ 跳过（不动它）' % s2.count(a2))
