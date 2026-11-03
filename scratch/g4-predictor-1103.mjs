/* G4 的预测子扫描（11-03）：今天量过的包并成一张表，看"最克格%"到底跟什么同向。
 * 全部数字**从文件读**（不许手敲）：
 *   宽度/族别 ← scratch/breadth-17-1103.txt ‖ breadth-2x2-1103.txt ‖ breadth-basin-1103.txt
 *   G4 最克格 ← scratch/g4-v92-rescan.txt ‖ g4-cbg-1103.txt ‖ g4-v7path-1103.txt ‖ g4-basin-1103.txt
 *   强度      ← 各产物自己 META 的 firstRate（出厂桌 36 对 × 20 局 × 4 粒 seedBase，同一口径）
 * 族别取引擎 `R.byKey[k].cat`。目的只有一个：我上一条说"G4 与反击族一正一反配对"，
 *   这次 BAS 两枚满手反击族却被克 96~98% ⇒ 那条判语要么死要么活，别靠印象。 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { sandbox } from '../tools/audit-lib.mjs';

const ROOT = 'D:/code/Epirus-Web/';
const W = sandbox(); const R = W.EpirusRules; const DEF = R.CAT.DEFENSE;

function lines(p) { return existsSync(ROOT + p) ? readFileSync(ROOT + p, 'utf8').split(/\r?\n/) : []; }

/* ① 宽度与族别 */
const width = {};
for (const f of ['scratch/breadth-17-1103.txt', 'scratch/breadth-2x2-1103.txt', 'scratch/breadth-basin-1103.txt']) {
  for (const ln of lines(f)) {
    const m = /^(.+?) ‖ 种数 (\d+) ‖ (.*)$/.exec(ln.trim()); if (!m) continue;
    const name = m[1].replace(/\.(js|bak)$/, '').replace(/^.*[\\/]/, '');
    const keys = []; const re = /([a-zA-Z][a-zA-Z0-9]*) ([\d.]+)%/g; let t;
    while ((t = re.exec(m[3]))) keys.push({ k: t[1], s: Number(t[2]) });
    const defShare = keys.filter((e) => { const d = R.byKey[e.k]; return d && d.cat === DEF; }).reduce((a, e) => a + e.s, 0);
    width[name] = { kinds: Number(m[2]), defShare, defKinds: keys.filter((e) => { const d = R.byKey[e.k]; return d && d.cat === DEF; }).length };
  }
}

/* ② G4 最克格（每包取 long/multi 里更坏那一格） */
const g4 = {};
for (const f of ['scratch/g4-v92-rescan.txt', 'scratch/g4-cbg-1103.txt', 'scratch/g4-v7path-1103.txt', 'scratch/g4-basin-1103.txt']) {
  for (const ln of lines(f)) {
    const m = /^\s*(PASS|FAIL)\s+G4\[[^\]]*?([A-Za-z0-9_.-]+?)\/(long|multi)\][^\n]*?最克「([^」]+)」([\d.]+)%/.exec(ln);
    if (!m) continue;
    const nm = m[2]; const pct = Number(m[5]);
    const cur = g4[nm] || { worst: -1, cell: '', modes: 0, pass: true };
    cur.modes++; cur.worst = Math.max(cur.worst, pct); cur.cell = pct >= cur.worst ? m[4] : cur.cell;
    if (m[1] === 'FAIL') cur.pass = false;
    g4[nm] = cur;
  }
}

/* ③ 强度：产物 META 的 firstRate（扫几个产物目录） */
const strength = {};
for (const dir of ['scratch/ga-arms', 'scratch/night4', 'scratch/night3']) {
  if (!existsSync(ROOT + dir)) continue;
  for (const fn of readdirSync(ROOT + dir)) {
    if (!/\.js$/.test(fn)) continue;
    const t = readFileSync(ROOT + dir + '/' + fn, 'utf8');
    const m = /EPIRUS_CHAMPION_3P_META = (\{[\s\S]*?\});/.exec(t); if (!m) continue;
    let j; try { j = JSON.parse(m[1]); } catch (e) { continue; }
    if (typeof j.firstRate !== 'number') continue;
    strength[fn.replace(/\.js$/, '')] = 100 * j.firstRate;
  }
}

const names = Object.keys(g4).filter((n) => width[n]);
console.log('并到 G4 + 宽度的包 ' + names.length + ' 枚（强度可用的 ' + names.filter((n) => n in strength).length + ' 枚）\n');
console.log('包 | G4 最坏格 | 过? | 种数 | 防御族种数 | 防御族份额 | 出厂桌夺1');
const rows = names.map((n) => ({
  n, worst: g4[n].worst, pass: g4[n].pass, modes: g4[n].modes, cell: g4[n].cell,
  k: width[n].kinds, dk: width[n].defKinds, ds: width[n].defShare, s: strength[n],
})).sort((a, b) => b.worst - a.worst);
for (const r of rows) {
  console.log('  ' + (r.n + '                  ').slice(0, 18) + String(r.worst).padStart(5) + '% (' + r.modes + '格) '
    + (r.pass ? '✔ ' : '✘ ') + '| ' + String(r.k).padStart(2) + ' | ' + String(r.dk).padStart(2)
    + ' | ' + r.ds.toFixed(1).padStart(5) + '% | ' + (typeof r.s === 'number' ? r.s.toFixed(1) + '%' : '—'));
}
function pearson(a, b) {
  const n = Math.min(a.length, b.length); if (n < 4) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < n; i++) { saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; sab += (a[i] - ma) * (b[i] - mb); }
  return (saa && sbb) ? sab / Math.sqrt(saa * sbb) : null;
}
const withS = rows.filter((r) => typeof r.s === 'number');
console.log('\n### 谁预测 G4 最坏格（越小越好）');
console.log('  防御族份额 r = ' + (pearson(rows.map((r) => r.ds), rows.map((r) => r.worst)) || 0).toFixed(2)
  + '   ‖ 种数 r = ' + (pearson(rows.map((r) => r.k), rows.map((r) => r.worst)) || 0).toFixed(2)
  + '   ‖ 出厂桌夺1 r = ' + (withS.length >= 4 ? (pearson(withS.map((r) => r.s), withS.map((r) => r.worst)) || 0).toFixed(2) : '样本不足'));
console.log('  过 G4 的枚数：' + rows.filter((r) => r.pass).length + ' / ' + rows.length
  + '   ‖ 其中防御族份额 >10% 的：' + rows.filter((r) => r.pass && r.ds > 10).length
  + '   ‖ 防御族=0 却过的：' + rows.filter((r) => r.pass && r.ds === 0).length);
console.log('\n⚠ 读数口径必须一起报：`modes` 说明有的包只量到一格（不是两格）；强度列是各产物**自己那次跑**的出厂桌 firstRate ⇒ 跨代只可横看不可当考卷。');
