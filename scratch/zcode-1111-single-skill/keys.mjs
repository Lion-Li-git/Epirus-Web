/* 单技能包的"那一个技能"身份探针 v2：chooser 返回对象时取 .key；包路径断了就走 docs/artifacts/<id>.bak 兜底 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, R0 = W.EpirusRules;
const NAMES = R0.byKey || Object.fromEntries((R0.SKILLS || []).map(s => [s.key, s]));
const nameOf = (k) => (NAMES[k] && NAMES[k].name) || k;
const rows = readFileSync('champion-map/data/build/coords-view.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map(l => l.split('\t'));
const H = rows[0], ix = Object.fromEntries(H.map((x, i) => [x, i]));
const packs = rows.slice(1).filter(r => +r[ix.distinctKeys] === 1).map(r => ({ id: r[0], path: r[ix.path] }));
for (const { id, path } of packs) {
  let p = path;
  if (!existsSync(p)) { for (const c of ['docs/artifacts/' + id + '.bak', 'docs/artifacts/' + id + '.js', 'champion-map/archive/2026-11-11-legacy-data/packs/' + id + '.js']) if (existsSync(c)) { p = c; break; } }
  if (!existsSync(p)) { console.log(id + '\t包找不到（' + path + '）'); continue; }
  const mm = readFileSync(p, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!mm) { console.log(id + '\t读不出包'); continue; }
  const params = P.unpack(JSON.parse(mm[1]), true);
  if (!params) { console.log(id + '\t不兼容'); continue; }
  const counts = {};
  for (const mode of ['multi', 'long']) for (let g = 0; g < 3; g++) {
    const seed = 4200 + g * 17 + (mode === 'long' ? 500 : 0);
    const base = T.policyChooserN(params, 0.15);
    const wrap = (st, pid, legal) => { const r = base(st, pid, legal); const k = typeof r === 'string' ? r : r.key; counts[k] = (counts[k] || 0) + 1; return r; };
    T.oneGameN(Array(5).fill(wrap), seed, 5, { mode });
  }
  const tot = Object.values(counts).reduce((a, b) => a + b, 0);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, c]) => `${k}(${nameOf(k)})×${c}`);
  console.log(id + '\t出手 ' + tot + '\t' + top.join('  '));
}
