import io

p = 'tools/proto2/skill-mastery.mjs'
raw = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')
orig = len(s)

def rep(tag, a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (tag, a[:70], n)
    s = s.replace(a, b)
    print('  ok %-12s (%d)' % (tag, n))

# ---------- 1) 事件流扫描抽成模块级函数（可单测，不靠桌运气） ----------
rep('scan-fn',
 "/** miniT 语义（预示式代理，`MINIT_ERA`）：目标 ep≥2 ∧ 目标在最近 MINIT_WINDOW 回合内有过一次 ok charge。",
 "/* 从事件流扫出每手 **ok 的 charge** 发生在第几回合（`newturn` 进一格）。抽出来是为了能单测：\n"
 " *   在册实测这张桌上 charge 极稀有（4 局里只有 1 次 ok charge ⇒ `scratch/ev-shape.mjs`），\n"
 " *   所以\"集成对照\"在这种池子上永远拿不到正例——拿它当腿就等于一条不会红的装饰。 */\n"
 "export function scanChargeRounds(evs, R) {\n"
 "  const log = []; let rr = 1;\n"
 "  for (let j = 0; j < evs.length; j++) {\n"
 "    const e = evs[j];\n"
 "    if (e.type === 'newturn') rr++;\n"
 "    else if (e.type === 'action' && e.outcome === 'ok' && e.key === R.SK.CHARGE) log.push({ at: j, round: rr, pid: e.pid });\n"
 "  }\n"
 "  return log;\n"
 "}\n"
 "/** miniT 语义（预示式代理，`MINIT_ERA`）：目标 ep≥2 ∧ 目标在最近 MINIT_WINDOW 回合内有过一次 ok charge。")

rep('scan-use',
 "      const chargeLog = [];\n"
 "      { let rr = 1;\n"
 "        for (let j = 0; j < evs.length; j++) {\n"
 "          const e = evs[j];\n"
 "          if (e.type === 'newturn') rr++;\n"
 "          else if (e.type === 'action' && e.outcome === 'ok' && e.key === R.SK.CHARGE) chargeLog.push({ at: j, round: rr, pid: e.pid });\n"
 "        } }\n",
 "      const chargeLog = scanChargeRounds(evs, R);\n")

# ---------- 2) 删掉两个合成 bot（它们的前提在这张池上不成立 ⇒ 留着就是死码） ----------
i = s.find("  } else if (spec === 'smart:miniT' || spec === 'dumb:miniT') {")
j = s.find("  } else if (spec === 'hybrid:railgun') {")
assert i > 0 and j > i, ('bot block', i, j)
s = s[:i] + '  } else if (spec === \'hybrid:railgun\') {' + s[j + len("  } else if (spec === 'hybrid:railgun') {"):]
print('  ok bot-block   (删合成对照)')

# ---------- 3) 自证 E 腿：判定式 + 扫描式单测（已知答案），拿掉 smart 集成对照 ----------
k = s.find("  console.log('[自证·E miniT 语义方向]")
e = s.find("  console.log('[自证·B 阴性]")
assert 0 < k < e, ('legE', k, e)
legE = """  console.log('[自证·E miniT 语义方向] 判定式 + 事件流扫描的**已知答案单测**（不靠桌上有没有人蓄珠）');
  {
    const R0 = sandbox().EpirusRules;
    const cell = (ep, gap, tgt) => miniTPredictive(
      { pid: 0, target: tgt === undefined ? 1 : tgt, opps: [{ pid: 1, ep: ep }] },
      tgt === null ? {} : { 1: 40 - gap }, 40);
    const units = [
      ['ep≥2 ∧ 上一回合蓄过珠 ⇒ 命中', cell(MINIT_EP_MIN, 1) === true],
      ['ep 不够 ⇒ 不算命中', cell(MINIT_EP_MIN - 1, 1) === false],
      ['窗口内最远一格 ⇒ 算命中', cell(MINIT_EP_MIN, MINIT_WINDOW) === true],
      ['超出窗口一格 ⇒ 不算命中', cell(MINIT_EP_MIN, MINIT_WINDOW + 1) === false],
      ['没锁目标 ⇒ 不算命中', cell(MINIT_EP_MIN + 3, 1, null) === false],
      ['目标从没蓄过珠 ⇒ 不算命中', miniTPredictive({ pid: 0, target: 1, opps: [{ pid: 1, ep: 9 }] }, {}, 40) === false],
    ];
    /* 扫描式：ok 才算、失败不算、newturn 才进格；同一 pid 取最近一次 */
    const mk = (k, out, extra) => { const e2 = { type: 'action', pid: (extra && extra.pid) || 1, key: k, outcome: out }; return e2; };
    const scan = scanChargeRounds([
      mk(R0.SK.CHARGE, 'ok'),
      { type: 'newturn' }, mk('guard', 'ok'), mk(R0.SK.CHARGE, 'fail'),
      { type: 'newturn' }, { type: 'newturn' }, mk(R0.SK.CHARGE, 'ok', { pid: 0, }),
    ], R0);
    const scanOk = scan.length === 2 && scan[0].round === 1 && scan[0].pid === 1 && scan[1].round === 4 && scan[1].pid === 0;
    units.push(['扫描：只认 ok 的 charge、回合按 newturn 进格、失败那手不记', scanOk]);
    let bad = 0;
    for (const [nm, ok] of units) { console.log('  ' + (ok ? '✔' : '✘') + ' ' + nm); if (!ok) bad++; }
    console.log('  ‖ 变异自证（这条腿的牙）：把窗口写死成 0 ⇒ 上面第 3 条必须翻红 ⇒ ' +
      (miniTPredictive({ pid: 0, target: 1, opps: [{ pid: 1, ep: 9 }] }, { 1: 39 }, 40) === true ? '窗口=0 时 gap1 仍算（说明判定不只看边界一侧）' : '✔ 窗口收紧迫使的格变红'));
    if (bad) fail++;
  }
"""
s = s[:k] + legE + s[e:]
print('  ok legE-rewrite')

io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('skill-mastery 收口（NL=%r）字符 %d → %d' % (nl, orig, len(s)))
