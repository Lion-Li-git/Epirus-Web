/* 配方考古：旧池 30 枚成员**当年是怎么训出来的**（预算 + 开过的杠杆 + 自记成绩）。
 * 动因（用户 11-03：为什么 v7 能"又宽又强"）：要判"宽"归给谁，得先把**当年与现在不同的东西**逐条摆出来，
 *   而不是拿今天的默认配方去猜。数据只从两处读：`champion-map/pool-members.tsv`（id/tier/path）
 *   与那枚产物自己的 `META`（train-3p 写的 recipe/env）——**不import 任何仿真**，所以它是考古不是读数。
 * 用法：node scratch/v7-recipe-archaeology.mjs [--tsv=champion-map/pool-members.tsv] */
import { readFileSync, existsSync } from 'node:fs';

const ROOT = 'D:/code/Epirus-Web/';
const TSV = (process.argv.find((a) => a.startsWith('--tsv=')) || '').slice(6) || 'champion-map/pool-members.tsv';
const rows = readFileSync(ROOT + TSV, 'utf8').split(/\r?\n/).slice(1).filter((l) => l.trim());

const LEVERS = ['laserW', 'clearW', 'killReward', 'bigtChainW', 'h2p', 'xn2w', 'counterOpps', 'econOpps', 'poolOpps',
  'toolkitOpps', 'imitTeacher', 'imitFrac', 'selPool', 'selG45', 'selCounter', 'oppBlock', 'ringOpps', 'selLand', 'selKeep', 'breadthFloor', 'trainMode'];

const out = [];
for (const line of rows) {
  const c = line.split('\t');
  const [id, wid, path, tier] = c;
  if (!path) continue;
  const abs = ROOT + path;
  if (!existsSync(abs)) { out.push({ id, tier, missing: path }); continue; }
  const txt = readFileSync(abs, 'utf8');
  const m = /EPIRUS_CHAMPION_3P_META = (\{[\s\S]*?\});/.exec(txt);
  if (!m) { out.push({ id, tier, missing: path + '（无 META）' }); continue; }
  let j; try { j = JSON.parse(m[1]); } catch (e) { out.push({ id, tier, missing: path + '（META 不是纯 JSON）' }); continue; }
  const r = j.recipe || {};
  out.push({
    id, tier: tier || j.tier || '?', widHead: (j.wid || wid || '').slice(0, 10),
    gens: j.gens || r.gens, pop: j.pop || r.pop, games: j.games || r.games, n: j.n || r.n,
    world: j.trainModeEffective || r.trainModeEffective || r.trainMode || '?',
    first: typeof j.firstRate === 'number' ? (100 * j.firstRate).toFixed(1) + '%' : '—',
    hot: r.hotstartFrom || (j.hotstartFrom || '').slice(0, 10) || '—',
    levers: LEVERS.filter((k) => r[k] !== undefined && r[k] !== null && r[k] !== 0 && r[k] !== '' && !(Array.isArray(r[k]) && !r[k].length))
      .map((k) => k + '=' + (Array.isArray(r[k]) ? r[k].join('+') : String(r[k]))),
    ts: (j.ts || '').slice(0, 10),
  });
}

const found = out.filter((o) => !o.missing);
console.log('池成员 ' + rows.length + ' 行 ‖ 能读到 META 的 ' + found.length + ' 枚 ‖ 缺文件/无 META ' + out.length + found.length === 0 ? '' : (rows.length - found.length) + ' 枚');
for (const o of out.filter((x) => x.missing)) console.log('  ⚠ 读不到：' + o.id + ' → ' + o.missing);

/* 预算分档汇总（这是关键那条：今天的批是 150/8/8，当年是多少？） */
const cell = (o) => o.gens + '代 × pop' + o.pop + ' × ' + o.games + '局/代 = ' + (o.gens * o.pop * o.games) + ' 个体局 ‖ n' + o.n + ' ‖ ' + o.world;
const hist = {};
for (const o of found) { const k = cell(o); hist[k] = (hist[k] || 0) + 1; }
console.log('\n### 预算与世界（按枚数）');
Object.entries(hist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + String(v).padStart(2) + ' 枚 ‖ ' + k));

console.log('\n### 逐枚（id ‖ tier ‖ 自记考卷夺1 ‖ 当年开过的杠杆）');
for (const o of found.sort((a, b) => String(a.tier).localeCompare(String(b.tier)))) {
  console.log('  ' + (o.id + '        ').slice(0, 14) + ' ' + (o.tier + '    ').slice(0, 6) + ' 夺1=' + o.first
    + ' ‖ 预算 ' + o.gens + '/' + o.pop + '/' + o.games + ' n' + o.n + ' ' + o.world
    + ' ‖ ' + (o.levers.length ? o.levers.join(' ') : '（无奖励杠杆登记）'));
}
console.log('\n注：`夺1` 是各枚**自己 META 里记的那次考卷**（不同代的考卷口径不同 ⇒ 只当"当年自评"，不许与今天的读数并表）；');
console.log('    杠杆名取自 recipe 的键（train-3p 落盘时写的），没写≠没开（旧版 recipe 字段更少），所以这一列只用于**找当年多做了什么**。');
