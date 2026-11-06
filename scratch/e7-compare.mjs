/* E7 对照表：送验剂量 vs 结果（LEX 家族，无配额 vs 配额 60）。只读已有 meta/日志/eval JSON。 */
import fs from 'fs';
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };
const bestRow = (j) => { const pk = (j.rows || []).filter((r) => r.tag.indexOf('2.0包') === 0); return pk.slice().sort((a, b) => b.cleanScore - a.cleanScore)[0]; };
const line = (tag, j, verif) => {
  const r = bestRow(j);
  if (!r) return tag.padEnd(12) + ' 缺 eval40-v2';
  return tag.padEnd(12) + '送验 ' + String(verif == null ? '—' : verif).padStart(4) +
    ' 最佳干净胜 ' + r.cleanScore.toFixed(3).padStart(6) + ' @t=' + String(r.temp).padEnd(5) +
    ' 夺1 ' + (100 * r.first).toFixed(1).padStart(5) + '% 单卡 ' + (r.maxCard ? r.maxCard.key + ' ' + (100 * r.maxCard.share).toFixed(1) + '%' : '—').padEnd(14) +
    ' 8P ' + r.byShape['8:multi'].cleanScore.toFixed(3) + ' 10P ' + r.byShape['10:multi'].cleanScore.toFixed(3);
};
const verOf = (tag) => {
  const m = read('scratch/arms/' + tag + '.bak.meta.json');
  const e = m && m.arena && m.arena.esa ? m.arena.esa : null;
  if (e && e.verifications != null) return e.verifications;
  /* 今天的改动之前，meta 里没有 verifications ⇒ 回读日志的"环内预选 N 次"（预选即送验次数，同一批） */
  try {
    const t = fs.readFileSync('scratch/' + tag + '.log', 'utf8');
    const g = /环内预选 (\d+) 次/.exec(t);
    return g ? Number(g[1]) : null;
  } catch (err) { return null; }
};
const logs = [];
for (const s of ['13', '17', '19', '31']) {
  logs.push(line('LEX-s' + s, read('scratch/LEX-s' + s + '-eval40-v2.json'), verOf('LEX-s' + s)));
  logs.push(line('LEXQ-s' + s, read('scratch/LEXQ-s' + s + '-eval40-v2.json'), verOf('LEXQ-s' + s)));
}
console.log(logs.join('\n'));
const vals = (pre) => ['13', '17', '19', '31'].map((s) => { const j = read('scratch/' + pre + '-s' + s + '-eval40-v2.json'); const r = j && bestRow(j); return r ? r.cleanScore : null; });
const fmt = (a) => a.map((x) => (x == null ? '—' : x.toFixed(3))).join(' ‖ ');
const rng = (a) => { const f = a.filter((x) => x != null); return f.length ? (Math.max.apply(null, f) - Math.min.apply(null, f)).toFixed(3) : '—'; };
console.log('\n顺序 = s13 ‖ s17 ‖ s19 ‖ s31');
console.log('无配额：' + fmt(vals('LEX')) + '   极差 ' + rng(vals('LEX')));
console.log('配额60：' + fmt(vals('LEXQ')) + '   极差 ' + rng(vals('LEXQ')));
