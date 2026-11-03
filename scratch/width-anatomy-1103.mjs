/* 宽度解剖（11-03）：把"种数"拆成**族别**，再与当年预算并表 —— 回答用户那句"为什么 v7 能又宽又强"。
 * 三份输入全部是**今天现量**或**产物自记**，不许我口算：
 *   ① `scratch/breadth-v7pool-20.txt` —— 30 枚池成员，5P long × 20 局、ε=0（DS 的原尺）
 *   ② `scratch/breadth-17-1103.txt`   —— 代 3 那 17 枚，同一把尺同一张桌
 *   ③ `champion-map/pool-members.tsv` + 各 .bak 的 META —— 当年的 gens/pop/games/世界
 * 族别来自引擎自己（`R.byKey[k].cat`），不在这里手抄卡名。 */
import { readFileSync, existsSync } from 'node:fs';
import { sandbox } from '../tools/audit-lib.mjs';

const ROOT = 'D:/code/Epirus-Web/';
const W = sandbox(); const R = W.EpirusRules;
const CATS = R.CAT;
const catOf = (k) => { const d = R.byKey && R.byKey[k]; return d ? d.cat : '未知'; };

function parseBreadth(p) {
  if (!existsSync(ROOT + p)) return [];
  const out = [];
  for (const line of readFileSync(ROOT + p, 'utf8').split(/\r?\n/)) {
    const m = /^(.+?) ‖ 种数 (\d+) ‖ (.*)$/.exec(line.trim());
    if (!m) continue;
    const name = m[1].replace(/\.(js|bak)$/, '').replace(/^.*[\\/]/, '').replace(/__/g, '/');
    const keys = [];
    const re = /([a-zA-Z][a-zA-Z0-9]*) ([\d.]+)%/g; let t;
    while ((t = re.exec(m[3]))) keys.push({ k: t[1], share: Number(t[2]) });
    out.push({ name, kinds: Number(m[2]), keys });
  }
  return out;
}
function anatomy(row) {
  const byCat = {};
  for (const e of row.keys) { const c = catOf(e.k); byCat[c] = (byCat[c] || 0) + e.share; }
  const defKinds = row.keys.filter((e) => catOf(e.k) === CATS.DEFENSE).length;
  const maxShare = row.keys.length ? Math.max(...row.keys.map((e) => e.share)) : 0;
  return { kinds: row.kinds, defKinds, defShare: byCat[CATS.DEFENSE] || 0, atkShare: byCat[CATS.ATTACK] || 0, maxShare, cats: byCat };
}

const V7 = parseBreadth('scratch/breadth-v7pool-20.txt');
const G3 = parseBreadth('scratch/breadth-17-1103.txt');

/* 当年预算（只在 v7 侧有意义） */
const budget = {};
{
  const tsv = readFileSync(ROOT + 'champion-map/pool-members.tsv', 'utf8').split(/\r?\n/).slice(1);
  for (const line of tsv) {
    const c = line.split('\t'); if (!c[0] || !c[2]) continue;
    if (!existsSync(ROOT + c[2])) continue;
    const txt = readFileSync(ROOT + c[2], 'utf8');
    const m = /EPIRUS_CHAMPION_3P_META = (\{[\s\S]*?\});/.exec(txt); if (!m) continue;
    let j; try { j = JSON.parse(m[1]); } catch (e) { continue; }
    const id = c[0].toLowerCase();
    budget[id] = { gens: j.gens, pop: j.pop, games: j.games, n: j.n, world: j.trainModeEffective || j.trainMode || '?', tier: c[3], budgetGames: (j.gens || 0) * (j.pop || 0) * (j.games || 0) };
  }
}

function table(rows, label, withBudget) {
  console.log('\n### ' + label + '（' + rows.length + ' 枚 ‖ 同一把尺：5P long × 20 局、ε=0、非ジ且份额 ≥0.5%）');
  console.log('包 | 种数 | 防御族种数 | 防御族份额 | 攻击族份额 | 单卡最大份额 | 当年预算（gens/pop/games n世界）');
  const stat = { kinds: [], def: [], defShare: [], max: [] };
  for (const r of rows) {
    const a = anatomy(r);
    stat.kinds.push(a.kinds); stat.def.push(a.defKinds); stat.defShare.push(a.defShare); stat.max.push(a.maxShare);
    const b = budget[r.name.toLowerCase()] || budget[Object.keys(budget).find((k) => r.name.toLowerCase().includes(k)) || ''];
    const bs = withBudget ? (b ? b.gens + '/' + b.pop + '/' + b.games + ' n' + b.n + ' ' + b.world + '（' + (b.budgetGames / 9600).toFixed(1) + '× 今批）' : '—') : '';
    console.log('  ' + (r.name + '                ').slice(0, 16) + '| ' + String(a.kinds).padStart(2) + ' | ' + String(a.defKinds).padStart(2)
      + ' | ' + a.defShare.toFixed(1).padStart(5) + '% | ' + a.atkShare.toFixed(1).padStart(5) + '% | ' + a.maxShare.toFixed(1).padStart(5) + '% | ' + bs);
  }
  const med = (x) => { const s = x.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  const mean = (x) => x.reduce((p, q) => p + q, 0) / (x.length || 1);
  console.log('  —— ' + label + '：种数 中位 ' + med(stat.kinds) + ' / 均值 ' + mean(stat.kinds).toFixed(2)
    + ' ‖ 防御族种数 中位 ' + med(stat.def) + '（' + stat.def.filter((x) => x > 0).length + '/' + stat.def.length + ' 枚 ≥1 种）'
    + ' ‖ 防御族份额 中位 ' + med(stat.defShare).toFixed(1) + '% ‖ 单卡最大份额 中位 ' + med(stat.max).toFixed(1) + '%');
  return stat;
}
console.log('族别取自引擎 `R.byKey[k].cat`（不手抄卡名）‖ 分母 = 该包非ジ出手里份额 ≥0.5% 的键');
const sv = table(V7, '旧池 v7 成员', true);
const sg = table(G3.filter((r) => /^(BREAD|CBG|L5-D4a|CB-s13)/.test(r.name)), '代 3（今早六臂 + 两枚起点）', false);

const corr = (a, b) => {
  const n = a.length; if (n < 3) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < n; i++) { saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; sab += (a[i] - ma) * (b[i] - mb); }
  return (saa && sbb) ? sab / Math.sqrt(saa * sbb) : null;
};
const bk = V7.map((r) => { const b = budget[r.name.toLowerCase()]; return b ? b.budgetGames : null; }).map((x, i) => x === null ? NaN : x);
const pairs = V7.map((r, i) => ({ b: (budget[r.name.toLowerCase()] || {}).budgetGames, k: anatomy(r).kinds })).filter((p) => Number.isFinite(p.b));
console.log('\n### 判"预算是不是宽度的因"（只在 v7 内部，n=' + pairs.length + '）');
console.log('  种数 × 预算 r = ' + (corr(pairs.map((p) => p.b), pairs.map((p) => p.k)) || 0).toFixed(2)
    + ' ‖ 种数范围 ' + Math.min(...pairs.map((p) => p.k)) + '~' + Math.max(...pairs.map((p) => p.k))
    + ' ‖ 预算范围 ' + (Math.min(...pairs.map((p) => p.b)) / 9600).toFixed(1) + '×~' + (Math.max(...pairs.map((p) => p.b)) / 9600).toFixed(1) + '× 今批');
console.log('  ⇒ 若 |r| 小 ⇒ 预算解释不了 v7 内部谁宽；今天的批只有 9,600 个体局（150/8/8），是这批里最小的那一档。');
console.log('\n### 两代对照（同尺）');
console.log('  v7  防御族 ≥1 种：' + sv.def.filter((x) => x > 0).length + '/' + sv.def.length + ' ‖ 代 3：' + sg.def.filter((x) => x > 0).length + '/' + sg.def.length);
console.log('  v7  种数中位 ' + sv.kinds.sort((a, b) => a - b)[Math.floor(sv.kinds.length / 2)] + ' ‖ 代 3 种数中位 ' + sg.kinds.sort((a, b) => a - b)[Math.floor(sg.kinds.length / 2)]);
