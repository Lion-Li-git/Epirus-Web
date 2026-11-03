import io
p = 'tools/proto2/breadth2.mjs'
s = io.open(p, encoding='utf-8', newline='').read()

old = """    distinctCast: castK.length,"""
assert s.count(old) == 1, 'row anchor'
new = """    distinctCast: castK.length,
    /* 有效种类（用户 11-01：先在中途杀超低种类，**然后才判有效出手种类**）：非ジ 且出手占比 ≥ t 的键数。
     *   用 mirrorHealth 的 `castByKey` **全量**直方图算 —— 从考卷文本的「分布（前 12）」解析会截断尾部，
     *   13~15 键的包会被系统性低估（11-01 我那版池对照表就踩了这个坑）。 */
    effKinds: (function () {
      let tot = 0; for (const k of castK) tot += mh.castByKey[k];
      const o = {};
      for (const t of [1, 2, 5]) o[t] = tot ? castK.filter((k) => mh.castByKey[k] / tot >= t / 100).length : 0;
      return o;
    })(),"""
s = s.replace(old, new)

old2 = """for (const p of PACKS) {
  if (p === 'v7') { out[0].pack = 'v7'; continue; }   // 锚行就是 v7 同尺同档，不重复跑一遍
  let raw;
  try { raw = readPack2(p); } catch (e) { console.log('⚠ 读不出 ' + p + '：' + String(e && e.message).slice(0, 70)); continue; }"""
assert s.count(old2) == 1, 'load anchor'
new2 = """for (const p of PACKS) {
  if (p === 'v7') { out[0].pack = 'v7'; continue; }   // 锚行就是 v7 同尺同档，不重复跑一遍
  let raw;
  try { raw = readPack2(p); } catch (e) {
    /* 容器读不出 ⇒ 退回 **v7 束/老包**装载路径（池成员 30 枚都是 .js/.bak 的容器 v7，代 3 装载器读不了它们）。
     *   读得出 params 就照常量（同一把 mirrorHealth ⇒ 两侧同档可并排），只是容器标注换成 v7 <len>。 */
    const c7 = loadChamp(W, p);
    if (!c7) { console.log('⚠ 读不出 ' + p + '：' + String(e && e.message).slice(0, 70)); continue; }
    out.push(rowOf(p.replace(/^.*[\\\\/]/, ''), Float64Array.from(c7), 'v7 ' + c7.length));
    continue;
  }"""
s = s.replace(old2, new2)

old3 = """    String(r.landedKeys).padEnd(4) + (r.effSkillsLand == null ? '—' : r.effSkillsLand.toFixed(2)).padEnd(8) +"""
assert s.count(old3) == 1, 'print anchor'
new3 = """    String(r.landedKeys).padEnd(4) + (r.effSkillsLand == null ? '—' : r.effSkillsLand.toFixed(2)).padEnd(8) +
    (('t1/' + (r.effKinds ? r.effKinds[1] : '?') + ' t2/' + (r.effKinds ? r.effKinds[2] : '?') + ' t5/' + (r.effKinds ? r.effKinds[5] : '?')).padEnd(14)) +"""
s = s.replace(old3, new3)

old4 = "'出手种'.padEnd(8)"
assert s.count(old4) == 1
s = s.replace(old4, "'出手种'.padEnd(8) + '有效种类'.padEnd(14)")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
