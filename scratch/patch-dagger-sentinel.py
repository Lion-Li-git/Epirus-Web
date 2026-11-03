import io
p = 'tools/proto2/supfit-gd.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

old = "  pvCur = adamFit(pvCur, trainList, like(pvCur, test).ll, r);"
assert s.count(old) == 1, "dagger fit call not found"
new = '\n'.join([
 "  const pvBefore = Float64Array.from(pvCur);",
 "  /* 哨兵必须与 adamFit 内部比较的量**同源**（都是 trainList 上的 train ll）。原先传的是 like(pvCur, test).ll：",
 "   * r>=1 的起点粒子在 test 上已经接近 0，训练侧 checkpoint 想超过它全凭巧合 =",
 "   * `--dagger` 有时静默返回起点粒（11-01 实测 GD3-BIGT 与 GD3-BIGT2 的 md5 逐位相同 = 整轮空转），",
 "   * 有时又真的换粒（昨夜 mt-dag 与 mt-OB3S-rich 的 md5 不同）⇒ 生效与否取决于口径错配，这是仪器缺陷。 */",
 "  pvCur = adamFit(pvCur, trainList, like(pvCur, trainList).ll, r);",
 "  { let nMoved = 0, first = -1;",
 "    for (let i = 0; i < pvBefore.length; i++) if (pvBefore[i] !== pvCur[i]) { nMoved++; if (first < 0) first = i; }",
 "    console.log('  轮 ' + r + ' ‖ ⭐ 粒子自证：改变 ' + nMoved + '/' + pvBefore.length + ' 个坐标'",
 "      + (nMoved === 0 ? '（无差异 ⇒ 这一轮没进产物）' : '（首个差异在第 ' + first + ' 个）'));",
 "    if (nMoved === 0) { console.error('⛔ DAgger 轮 ' + r + ' 没改变粒子 ⇒ 这一档是空转，不许当成 DAgger 无效的读数'); process.exit(7); }",
 "    ROUNDS_MOVED.push({ round: r, moved: nMoved, firstDiff: first, dim: pvBefore.length });",
 "  }",
])
s = s.replace(old, new)

old2 = "const ROUNDS = [];"
assert s.count(old2) == 1
s = s.replace(old2, "const ROUNDS = [];\nconst ROUNDS_MOVED = [];   /* 每轮『粒子真的动了』的坐标级自证 */")

old3 = "rounds: ROUNDS,"
assert s.count(old3) == 1
s = s.replace(old3, "rounds: ROUNDS, roundsMoved: ROUNDS_MOVED,")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
