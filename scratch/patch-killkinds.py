import io
p = 'tools/probe-cem-arm.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

# 1) 旗标白名单（两处：rejectUnknownFlags 名单 + arena 族"必须配 --arena2=1"的名单）
o = "'arenaPool', 'arenaShapes', 'arenaDivK', 'selCap'], 'probe-cem-arm');"
assert s.count(o) == 1, 'whitelist'
s = s.replace(o, "'arenaPool', 'arenaShapes', 'arenaDivK', 'selCap', 'killKinds', 'killStreak'], 'probe-cem-arm');")

o2 = "'arenaPool', 'arenaShapes', 'arenaDivK']\n    .some((k) =>"
assert s.count(o2) == 1, 'arena family gate'
s = s.replace(o2, "'arenaPool', 'arenaShapes', 'arenaDivK', 'killKinds', 'killStreak']\n    .some((k) =>")

# 2) parse
o3 = "const SEL_CAP = Number(arg('selCap', 0)) || 0;"
assert s.count(o3) == 1, 'selcap parse anchor'
s = s.replace(o3, o3 + """
/* `--killKinds=` / `--killStreak=`（千问 · 11-01，PREREG-2026-11-01-KILL-NARROW）：**训练中途的超低出手种类淘汰**。
 *   代指标 = 该代**最高分粒子**（按 fit，未经任何 veto）的非ジ 不同键数；连续 KILL_STREAK 代 < KILL_KINDS ⇒ 当场终止、**不写产物**
 *   （省下的预算才是这条线的收益）。种类直接取 arena2 已经交出的 `cat` ⇒ 零新测量、零额外一局。
 *   立线依据：现役池 30 枚的 raw 出手种类最小 6（中位 12）⇒ 4/5 都不杀现役成员。 */
const KILL_KINDS = Math.max(0, Number(arg('killKinds', 0)) || 0);
const KILL_STREAK = Math.max(2, Number(arg('killStreak', 5)) || 5);
let lowKindRun = 0, KILLED = null;""")

# 3) evalOne 带回 kindN
o4 = "    return { fit: dvFit, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard };"
assert s.count(o4) == 1, 'evalOne return'
s = s.replace(o4, """    let kindN = 0; for (const k in r.cat) if (k !== R.SK.JI && r.cat[k] > 0) kindN++;
    return { fit: dvFit, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard, kindN };""")

# 4) 代指标与早停（插在 order 算完、selCap 过滤之前）
o5 = """    /* 一整代全被 cap 挡下时：σ/均值照旧重拟合（否则搜索直接饿死），但**产物一格不许动** ⇒ 11-01 第一版没写这条，"""
assert s.count(o5) == 1, 'cap comment anchor'
s = s.replace(o5, """    if (KILL_KINDS > 0) {
      const topFit = order.length ? order[0] : null;
      const kn = topFit == null ? null : scored[topFit].kindN;
      if (kn != null && kn < KILL_KINDS) {
        lowKindRun++;
        console.log('  ⚑ 低种类代 ' + lowKindRun + '/' + KILL_STREAK + '（第 ' + (it + 1) + ' 代最高分粒子出手种类=' + kn + ' ‖ 线 ' + KILL_KINDS + '）');
        if (lowKindRun >= KILL_STREAK) { KILLED = { atIter: it + 1, kindN: kn, streak: KILL_STREAK, gamesSpent: gamesIn() }; break; }
      } else lowKindRun = 0;
    }
""" + o5)

# 6) 产物写入守卫 + 打印
o6 = """  const packed = P.pack(best);
  writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\\n', 'utf8');"""
assert s.count(o6) == 1, 'artifact write'
s = s.replace(o6, """  if (KILLED) { console.log('\\n⛔ **本臂被中途淘汰判据杀掉**：连续 ' + KILLED.streak + ' 代最高分粒子出手种类 ' + KILLED.kindN +
    ' < ' + KILL_KINDS + '（第 ' + KILLED.atIter + ' 代，已花 ' + KILLED.gamesSpent + ' 局）⇒ **产物不写**（PREREG-2026-11-01-KILL-NARROW K-1）。'); }
  else { const packed = P.pack(best);
  writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\\n', 'utf8'); }""")

o7 = "if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT + '.meta.json', JSON.stringify(row, null, 1), 'utf8'); appendIndex(OUT, row); }"
assert s.count(o7) == 1, 'meta write'
s = s.replace(o7, "row.killKinds = KILL_KINDS > 0 ? { kinds: KILL_KINDS, streak: KILL_STREAK, killed: KILLED } : null;\n" + o7)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
