import io

p = 'tools/proto2/skill-mastery.mjs'
raw = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')
orig = len(s)

def rep(tag, a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (tag, a[:60], n)
    s = s.replace(a, b)
    print('  ok %-12s (%d)' % (tag, n))

# ---------- 1) replay 行带上事件游标位置（语义要看**所有人**的蓄珠，不只是被审计那一席） ----------
rep('replay-row',
 "    rows.push({\n      pick: pk,\n      outcome: attempt ? attempt.outcome : 'no-attempt',\n"
 "      attemptedKey: attempt ? attempt.key : null,\n      ok: !!attempt && attempt.outcome === 'ok' && !voided,\n      voided, dmgToMe,\n    });",
 "    rows.push({\n      pick: pk, lo,\n      outcome: attempt ? attempt.outcome : 'no-attempt',\n"
 "      attemptedKey: attempt ? attempt.key : null,\n      ok: !!attempt && attempt.outcome === 'ok' && !voided,\n      voided, dmgToMe,\n    });")

# ---------- 2) 每局：先从事件流建 ok-charge 账，再按行推进游标 ----------
rep('cursor-init',
 "      const chargeRound = {};              /* pid → 该席最近一次 ok charge 的回合（预示式代理用；只写已经发生的事实，不偷看未来） */\n"
 "      let ringRun = 0;",
 "      /* ⚑ 语义要看**所有人**的蓄珠，不是只看被审计那一席：从事件流里扫出每次 ok charge 的 (事件位, 回合, pid)，\n"
 "       *   再按行的事件位推进游标 ⇒ 判定只看\"这次决策之前已经发生\"的事实，不偷看未来。 */\n"
 "      const chargeLog = [];\n"
 "      { let rr = 1;\n"
 "        for (let j = 0; j < evs.length; j++) {\n"
 "          const e = evs[j];\n"
 "          if (e.type === 'newturn') rr++;\n"
 "          else if (e.type === 'action' && e.outcome === 'ok' && e.key === R.SK.CHARGE) chargeLog.push({ at: j, round: rr, pid: e.pid });\n"
 "        } }\n"
 "      const chargeRound = {}; let cCur = 0;\n"
 "      let ringRun = 0;")

rep('cursor-advance',
 "      for (let i = 0; i < rows.length; i++) {\n        const row = rows[i], pk = row.pick;",
 "      for (let i = 0; i < rows.length; i++) {\n        const row = rows[i], pk = row.pick;\n"
 "        while (cCur < chargeLog.length && chargeLog[cCur].at < row.lo) { const z = chargeLog[cCur++]; chargeRound[z.pid] = z.round; }")

rep('drop-old-update',
 "        if (pk.key === R.SK.CHARGE) chargeRound[pk.pid] = row.round;\n", "")

# ---------- 3) 代理函数：回合差窗口 [0, MINIT_WINDOW]（0 = 同回合更早的手顺） ----------
rep('predicate',
 "  const cr = chargeRound[pk.target];\n  if (cr == null) return false;\n  const gap = roundNow - cr;\n  return gap >= 1 && gap <= MINIT_WINDOW;",
 "  const cr = chargeRound[pk.target];\n  if (cr == null) return false;\n"
 "  const gap = roundNow - cr;              /* 0 = 同一回合里更早的一手（事件顺序已保证不是未来） */\n"
 "  return gap >= 0 && gap <= MINIT_WINDOW;")

# ---------- 4) 自证：腿名让位（文件里已有一个 D=容器装载），并把 dumb 换成确定性判定 + 单位检查 ----------
rep('legE',
 "  console.log('[自证·D miniT 语义方向] smart:miniT 必须过、dumb:miniT（旧口径的理想打法）必须不过（long n=3 × 12 局）');",
 "  console.log('[自证·E miniT 语义方向] 判定式单测（窗口/ep/无目标三种边界）+ 集成对照 smart:miniT（long n=3 × 12 局）');")

rep('legE-body',
 "    const sm = one('smart:miniT'), dm = one('dumb:miniT');\n"
 "    const smOk = sm.n > 0 && sm.h / sm.n >= 0.5;\n"
 "    const dmBad = !(dm.n > 0 && dm.h / dm.n >= 0.5);\n"
 "    console.log('  ' + (smOk ? '✔' : '✘') + ' smart:miniT 预示代理命中 ' + sm.h + '/' + sm.n + '（要 ≥1/2 且分母 >0）');\n"
 "    console.log('  ' + (dmBad ? '✔' : '✘') + ' dumb:miniT（按旧口径选目标）命中 ' + dm.h + '/' + dm.n + '（新线**不该**认它；认了说明这条腿是换名恒真）');\n"
 "    if (!smOk || !dmBad) fail++;",
 "    /* 判定式单测是确定性的（不受桌局运气）：换名恒真的风险由它挡，不用一个会抖的行为对照去挡。\n"
 "     *   三条边界：ep 不够 ⇒ 不算；出珠太久 ⇒ 不算；没有目标 ⇒ 不算。再加一条\"窗口边界两侧各一次\"。 */\n"
 "    const cell = (ep, gap, tgt) => miniTPredictive(\n"
 "      { pid: 0, target: tgt === undefined ? 1 : tgt, opps: [{ pid: 1, ep: ep }] },\n"
 "      tgt === null ? {} : { 1: 40 - gap }, 40);\n"
 "    const units = [\n"
 "      ['ep≥2 ∧ 上一回合蓄过珠 ⇒ 命中', cell(MINIT_EP_MIN, 1) === true],\n"
 "      ['ep 不够 ⇒ 不算命中', cell(MINIT_EP_MIN - 1, 1) === false],\n"
 "      ['蓄珠太久（窗口 +1）⇒ 不算命中', cell(MINIT_EP_MIN, MINIT_WINDOW + 1) === false],\n"
 "      ['窗口边界内 ⇒ 算命中', cell(MINIT_EP_MIN, MINIT_WINDOW) === true],\n"
 "      ['没锁目标 ⇒ 不算命中', cell(MINIT_EP_MIN + 3, 1, null) === false],\n"
 "      ['从没蓄过珠 ⇒ 不算命中', (() => { const o = {}; return miniTPredictive(\n"
 "        { pid: 0, target: 1, opps: [{ pid: 1, ep: 9 }] }, o, 40) === false; })()],\n"
 "    ];\n"
 "    const sm = one('smart:miniT');\n"
 "    const smOk = sm.n > 0 && sm.h / sm.n >= 0.5;\n"
 "    for (const [nm, ok] of units) { console.log('  ' + (ok ? '✔' : '✘') + ' 判定式：' + nm); if (!ok) fail++; }\n"
 "    console.log('  ' + (smOk ? '✔' : '✘') + ' 集成对照 smart:miniT（照代理选目标）命中 ' + sm.h + '/' + sm.n +\n"
 "      '（要 ≥1/2 且分母 >0 ⇒ 证明事件流游标真把**别人**的蓄珠看进去了）');\n"
 "    if (!smOk) fail++;")

# ---------- 5) 腿数与收尾措辞 ----------
rep('tail', "  console.log(fail === 0 ? '[自证] 四腿全过 ✔' : '[自证] ⛔ ' + fail + ' 腿挂 ⇒ 尺作废，先修再测');",
 "  console.log(fail === 0 ? '[自证] 五腿全过 ✔（A 阳性 / B 阴性 / C 确定性 / D 容器装载 / E miniT 语义方向）' : '[自证] ⛔ ' + fail + ' 项挂 ⇒ 尺作废，先修再测');")

# ---------- 6) 容器装载腿：代 2 已退役 ⇒ 挑代 3 容器，并断言 v:91 被 checkPack 拒读 ----------
rep('legD-filter',
 "        if (!raw || raw.v !== 91 || !raw.dims) continue;",
 "        if (!raw || raw.v !== 92 || !raw.dims) continue;   /* 代 3 唯一 ⇒ 本腿挑代 3 容器（v:91 已被代闸响亮拒读） */")
rep('legD-assert',
 "      const ok = params.length === rawN && !!W.EpirusPolicy.__arch2;",
 "      /* 顺手把\"旧代进不来\"钉在本腿里（不靠 packCfgExit 的 process.exit，那条会直接终止自证）：\n"
 "       *   拿这枚代 3 容器改一枚\"v 说代 2\"的样本 ⇒ checkPack 必须 reason:'version' 拒读。 */\n"
 "      const stale = JSON.parse(balancedJson(src, src.indexOf('EPIRUS_CHAMPION_3P '))); stale.v = 91;\n"
 "      const chk91 = W.EpirusPolicy.checkPack(stale, W);\n"
 "      const ok = params.length === rawN && !!W.EpirusPolicy.__arch2 && chk91.ok === false && chk91.reason === 'version';")
rep('legD-print',
 "      console.log('  ' + (ok ? '✔' : '✘') + ' ' + cand + '：装载 ' + params.length + ' 维（容器声明 ' + rawN + '）‖ arch2 已装 = ' + !!W.EpirusPolicy.__arch2);",
 "      console.log('  ' + (ok ? '✔' : '✘') + ' ' + cand + '：装载 ' + params.length + ' 维（容器声明 ' + rawN + '）‖ arch2 已装 = ' + !!W.EpirusPolicy.__arch2 +\n"
 "        ' ‖ 同一容器改标 v:91 ⇒ ' + JSON.stringify(chk91) + '（代 2 进不来）');")
rep('legD-label', "  console.log('[自证·D 容器装载] v:91 包必须走 packCfgExit 面（10-31 错网 bug 的回归腿）');",
 "  console.log('[自证·D 容器装载] 代 3 容器必须走 packCfgExit 面，且改标 v:91 的样本必须被拒（10-31 错网 bug 的回归腿）');")

io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('skill-mastery 修完（NL=%r）字符 %d → %d' % (nl, orig, len(s)))
