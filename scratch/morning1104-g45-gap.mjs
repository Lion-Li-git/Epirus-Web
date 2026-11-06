#!/usr/bin/env node
/* morning1104-g45-gap.mjs v2 —— 用户 11-04 改口径：「上线还有很多其他阻断门禁，我是说**所有阻断里最多差一项**，
 * 而且不能差很远（按 15%）」。⇒ 本件不再只数 G4/G5，而是数 **promote 体检的全部阻断项**，并附现成的其它成绩。
 *
 * 输入（全部只读，不重跑）：
 *   scratch/night6/promote/*.txt                     体检回执（含 `⛔ 体检未过（N 项阻断条件）` 与逐条 bullet）
 *   scratch/night6/strength-{long,multi}[-fix|-ext].tsv   200 局 1st（强度，现成）
 *   scratch/night6/generality-newprod-50g.txt（50 局/格）‖ generality-cb3.txt（12 局）‖ night4|5 矩阵（8 局）
 *
 * ⚑ 三条条款（都是本仓踩过的）：
 *   ① promote **只印失败的格** ⇒ 关档缺值 + 带档行在 = "过了、没印"，既不当过关也不当没测；
 *   ② 超限**不许跨单位抹平**：G5/直交是 pt，珠是 颗/局，架/墙 是别的口径 ⇒ 只有 % 类参与"≤15pt"判定，
 *      非 % 的量化项与**二值项**（如"穿透卡零命中"）单列，标成"要人判"，不许自动算成"不远"；
 *   ③ 泛用性一列必须带**剂量**（8/12/50 局三批混在一张表里就会自己骗自己）。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const DIRS = (process.argv[2] || 'scratch/night6/promote').split(',').filter(Boolean);
const FAR = 15;                       // "不远" = 该 % 项超限 ≤15pt（用户 11-04 定）
const num = s => Number(String(s).replace(/[^\d.]/g, ''));

/* ---------- 1. 现成的其它成绩（不重跑） ---------- */
const strength = {}, genrl = {};
for (const mode of ['long', 'multi']) {
  for (const suffix of ['', '-fix', '-ext']) {
    const f = 'scratch/night6/strength-' + mode + suffix + '.tsv';
    if (!existsSync(f)) continue;
    for (const l of readFileSync(f, 'utf8').split(/\r?\n/).slice(1)) {
      const c = l.split('\t'); if (c.length < 3 || !c[0] || !/^\d+$/.test(c[1])) continue;
      if (c[2] === 'NA' || !c[2]) continue;
      const key = c[0] + '/' + mode;
      if (strength[key] === undefined) strength[key] = { v: +c[2], games: +c[1], src: f.split('/').pop() };
    }
  }
}
for (const [file, dose] of [['scratch/generality-1104/matrix-50g.txt', '50局'], ['scratch/night6/generality-newprod-50g.txt', '50局'], ['scratch/night6/generality-cb3.txt', '12局'],
  ['scratch/night4/generality-matrix.txt', '8局'], ['scratch/night5/generality-matrix.txt', '8局']]) {
  if (!existsSync(file)) continue;
  for (const l of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^(\S+)\s*\|(.*)$/.exec(l.trim()); if (!m) continue;
    const vals = [...m[2].matchAll(/=(\d+(?:\.\d+)?|NA)%/g)].map(x => x[1]).filter(x => x !== 'NA').map(Number);
    if (!vals.length) continue;
    if (genrl[m[1]] === undefined) genrl[m[1]] = { min: Math.min(...vals), dose, src: file.split('/').pop() };
  }
}

/* ---------- 2. 逐份回执：全部阻断项 + 四格 ---------- */
const rows = [];
const done = new Set();
const skipped = [];
for (const P_DIR of DIRS) {
  if (!existsSync(P_DIR)) continue;
 for (const f of readdirSync(P_DIR).filter(x => x.endsWith('.txt')).sort()) {
  if (done.has(f)) continue; done.add(f);
  const t = readFileSync(P_DIR + '/' + f, 'utf8');
  /* 只认 promote 的回执（首行 `== 换前体检：<包> ==`）：同目录里的跑批日志会被当成"一枚没计数的包"混进表。
   * 跳过的要点名——万一 promote 改了表头，这里的名单会突然变长，那是"包在消失"而不是"表干净了"。 */
  if (!/^== 换前体检：/.test(t)) { skipped.push(P_DIR + '/' + f); continue; }
  const name = f.replace(/\.txt$/, '');
  /* 阻断项总数：promote 自己数的那个数（权威），不是我从 bullet 猜的 */
  const cnt = /体检未过（(\d+) 项阻断条件）/.exec(t);
  /* ⚠ 11-04 抓到自己埋的假阳性：`五道全过` 是**可行性面板**（每份回执中途都印），不是终判。
   * 原来把它当"0 阻断"的同义词 ⇒ 一份**还没跑完**的回执会被读成"全过"（g600 那枚半成品实测）。
   * 终判只认 promote 收尾的 `自检通过 / 体检通过 / 已中止`；三样都没有 = 未完，判 null 而不是 0。 */
  const nBlock = cnt ? +cnt[1] : (/体检通过|自检通过/.test(t) ? 0 : null);
  const bullets = [...t.matchAll(/^   · (.+)$/gm)].map(m => m[1]);
  /* 族别按**原文关键词**归（不按路径归，否则全塌成一类）：这是"要练哪一格"的清单主键 */
  const famOf = b => /G4\[/.test(b) ? 'G4 一行脚本能克它' : /G5\[/.test(b) ? 'G5 纯防御收场'
    : /有效技能数/.test(b) ? '广度·有效技能数' : /被集火还手率/.test(b) ? '被围殴时还手率'
    : /穿透卡零命中/.test(b) ? '反弹墙前穿透卡零命中' : /无威胁/.test(b) ? '无威胁摆架势'
    : /过期|颗\/局|浪费/.test(b) ? '珠经济（过期/浪费）' : /白防|防御/.test(b) ? '防御质量'
    : /清场|场B/.test(b) ? '场B 清场' : /架/.test(b) ? '架势/开局' : (b.slice(0, 18) + '…');
  /* 逐条量化：只认 % 类；其它单位标 quant-unit；二值标 binary */
  const items = bullets.map(b => {
    const fam = famOf(b);
    let m;
    if ((m = /实测防席夺冠\s*([\d.]+)%[^)]*阈值\s*[≤<]\s*([\d.]+)%/.exec(b))) return { fam, kind: 'pct', over: +m[1] - +m[2] };
    if ((m = /最克「[^」]+」\s*([\d.]+)%/.exec(b))) return { fam, kind: 'pct', over: +m[1] - 60 };
    if ((m = /([\d.]+)%\s*<\s*([\d.]+)%/.exec(b))) return { fam, kind: 'pct', over: +m[2] - +m[1] };
    if ((m = /([\d.]+)\s*[^\s%]{0,6}?>\s*([\d.]+)/.exec(b))) return { fam, kind: 'unit', over: +m[1] - +m[2] };
    return { fam, kind: 'binary', over: null };
  });
  const pctOvers = items.filter(i => i.kind === 'pct').map(i => i.over);
  const worstPct = pctOvers.length ? Math.max(...pctOvers) : null;
  const other = items.filter(i => i.kind !== 'pct').length;
  /* 四格（G4 正读数走 T2 那条"反制者期望损失"记录行；G5 关档只在失败时印） */
  const cell = {};
  const put = (k, v, who) => { if (v !== null && cell[k] === undefined) cell[k] = { v, who }; };
  /* v1（优先源）：11-04 起 promote 加印 `G4/G5 逐格数字（PASS 也印）` ⇒ 这行是**阻断格的实测值本身**，
   * 比下面两条"FAIL bullet / 只记录面板"都权威（那两条只在各自情形下有数，且面板那条是 T2 记录行）。
   * 旧回执没有这行 ⇒ 解析不到就照旧走下面两条，表不会因此出现空格。 */
  for (const m of t.matchAll(/\b(G5带档|G5|G4)\[([^\]]*)\/(long|multi)\]\s*(?:最克「[^」]*」|防席夺冠)\s*([\d.]+)%\/\d+%/g))
    put((m[1] === 'G5带档' ? 'G5dai' : m[1]) + m[3], +m[4], '逐格数字');
  for (const m of t.matchAll(/G4\[(.+?)\/(long|multi)\][^\n]*?最克「([^」]+)」\s*([\d.]+)%/g)) { if (m[1].includes('/')) put('G4' + m[2], +m[4], m[3]); }
  for (const m of t.matchAll(/(?:^|\s)(?:[\w./-]+)\/(long|multi) mean=[\d.]+%[^\n]*?最克「([^」]+)」\s*([\d.]+)%（n=\d+）/g)) put('G4' + m[1], +m[3], m[2]);
  for (const m of t.matchAll(/G5(带档)?\[(.+?)\/(long|multi)\][^\n]*?实测防席夺冠\s*([\d.]+)%/g)) { if (m[2].includes('/')) put((m[1] ? 'G5dai' : 'G5') + m[3], +m[4], null); }
  const g = k => (cell[k] ? cell[k].v : null);
  const g5Known = g('G5long') !== null || g('G5multi') !== null || g('G5dailong') !== null || g('G5damulti') !== null;
  rows.push({ name, nBlock, items, worstPct, other,
    g4: [g('G4long'), g('G4multi')], g5: [g('G5long'), g('G5multi')], g5State: g5Known ? '—' : '回执里没有任何 G5 行（读不出）',
    str: { l: strength[name + '/long'], m: strength[name + '/multi'] }, gen: genrl[name] });
 }
}

/* ---------- 3. 判：≤1 项 且 该项 % 超限 ≤15 ‖ 非 % 与二值项一律单列（不许自动放行） ---------- */
const ok = r => r.nBlock === 0 || (r.nBlock === 1 && r.worstPct !== null && r.worstPct <= FAR && r.other === 0);
rows.sort((a, b) => (a.nBlock === null ? 9 : a.nBlock) - (b.nBlock === null ? 9 : b.nBlock) || (a.worstPct === null ? 99 : a.worstPct) - (b.worstPct === null ? 99 : b.worstPct));
const p = (v, n) => (v === null || v === undefined ? '—' : String(v)).padStart(n);
console.log('包'.padEnd(19) + '阻断项 最坏%超限 其它单位/二值 |  G4l  G4m  G5l  G5m | 强度L/m | 泛用最低格(剂量) | 达标?');
for (const r of rows) {
  console.log(r.name.padEnd(19) + p(r.nBlock, 5) + '   ' + p(r.worstPct === null ? null : r.worstPct.toFixed(1), 7) + '      ' + p(r.other, 6) +
    '  |' + p(r.g4[0], 6) + ' ' + p(r.g4[1], 5) + ' ' + p(r.g5[0], 5) + ' ' + p(r.g5[1], 5) +
    ' |' + p(r.str.l ? r.str.l.v : null, 5) + '/' + p(r.str.m ? r.str.m.v : null, 5) +
    ' | ' + (r.gen ? r.gen.min.toFixed(1) + '(' + r.gen.dose + ')' : '—') + (r.gen ? ' '.repeat(Math.max(0, 14 - (r.gen.min.toFixed(1) + r.gen.dose).length)) : ' '.repeat(16)) +
    (ok(r) ? '  ★' : (r.nBlock === 0 ? '  ✔全过' : '  ✗')) + (r.nBlock === null ? ' (无终判＝回执未完)' : ''));
}
const pass = rows.filter(ok);
if (skipped.length) console.log('（跳过 ' + skipped.length + ' 个非体检回执文件：' + skipped.join(' ') + ' ⇒ 若这里出现本该是回执的名字，是 promote 改了表头）');
console.log('\n== 判据（用户 11-04）：**所有阻断项里最多差 1 项**，且该项是 % 口径、**超限 ≤' + FAR + 'pt**；非 % 量化项与二值项不参与"不远"、要人判');
console.log('== 满足：' + pass.length + ' / ' + rows.length + ' 枚 ⇒ ' + (pass.map(r => r.name + '(' + (r.nBlock === 0 ? '0 项' : r.worstPct.toFixed(1) + 'pt') + ')').join(' ‖ ') || '空'));
console.log('== 差 1 项但超限 >' + FAR + 'pt：' + rows.filter(r => r.nBlock === 1 && (r.worstPct === null || r.worstPct > FAR)).map(r => r.name + '(' + (r.worstPct === null ? '二值/非%' : r.worstPct.toFixed(1) + 'pt') + ')').join(' ‖ ') || '无');
console.log('== 强度列 = 200 局 1st（现成 tsv，不重跑）‖ 泛用列带**剂量**（8/12/50 局三批不可混读）‖ `—` = 该项没印/没这份文件');

/* ---------- 4. 聚合：全部阻断项**按类别**数一遍 ⇒ 这才是"要练什么"的清单 ---------- */
const byKey = {};
for (const r of rows) {
  if (r.nBlock === null) continue;
  for (const it of r.items) {
    const k = it.fam;
    (byKey[k] = byKey[k] || { n: 0, packs: [], np: new Set(), kind: it.kind, worst: null }).n++;
    byKey[k].packs.push(r.name + (it.kind === 'pct' ? '(' + it.over.toFixed(0) + 'pt)' : ''));
    byKey[k].np.add(r.name);
    if (it.kind === 'pct' && (byKey[k].worst === null || it.over > byKey[k].worst)) byKey[k].worst = it.over;
  }
}
const kl = Object.entries(byKey).sort((a, b) => b[1].n - a[1].n);
console.log('\n== 阻断项分类账（' + rows.filter(r => r.nBlock !== null).length + ' 枚回执，共 ' + kl.reduce((a, x) => a + x[1].n, 0) + ' 条）——按**条数**排序（一枚可占多格，所以条 ≥ 枚）');
for (const [k, v] of kl.slice(0, 14)) {
  /* `n` 是**条数**（同一枚包可命中多格，G5 就分 long/multi 两行），`packs` 才是包数。
   * 原先印成"N 枚"却按条数排序，读的人会把它当分母 ⇒ 两个都印出来。 */
  console.log('  ' + String(v.n).padStart(2) + ' 条/' + v.np.size + ' 枚  ' + (v.kind === 'pct' ? '% 口径，最坏 ' + v.worst.toFixed(1) + 'pt' : v.kind === 'unit' ? '非 % 单位（要人判）' : '二值项（要人判）') + '  ‖ ' + k + '  ‖ ' + v.packs.slice(0, 8).join(' ') + (v.packs.length > 8 ? ' …' : ''));
}

