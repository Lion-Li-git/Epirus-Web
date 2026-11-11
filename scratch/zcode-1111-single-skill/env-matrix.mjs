/* 环境矩阵并集探针（用户 00:2x 原则：单包技能上限只能在环境矩阵里测出来）
 * 桌形 = 自对局5座 / 脚本混桌 / F2冠军桌 / 农民桌 / 反射墙桌 / 激进桌 × multi/long
 * 每格数被测包座位的逐卡成功出手占比 ⇒ 每包 = 逐格种数 + 跨格并集种数（非ジ、格内份额≥1%）。
 * 用法：node env-matrix.mjs <pack...>（无参 = 现役池14 + MSB冠军6 的基线普查） */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
const SKJ = W.EpirusRules.SK.JI;
const F2P = { 'MSB11-R2S306293884': 'docs/artifacts/night-adapt/MSB11-R2S306293884.js', 'MSB10-R1S1149480262': 'docs/artifacts/night-adapt/MSB10-R1S1149480262.js', 'MSB8-charge-R1S1861674281': 'docs/artifacts/night-adapt/MSB8-charge-R1S1861674281.js', 'Q-s47': 'docs/artifacts/e507-out/Q-s47.js' };
const loadChooser = (p) => T.policyChooserN(P.unpack(JSON.parse(readFileSync(p, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true), 0.15);
const F2C = Object.values(F2P).map(loadChooser);
const TABS = {
  self: null,
  script: [B.pickAggro, B.pickDefend, B.pickFarmer, B.pickGunSpam],
  f2: F2C,
  farmer: [B.pickFarmer, B.pickCautiousFarmer || B.pickFarmer, B.pickFarmer, B.pickCautiousFarmer || B.pickFarmer],
  wall: [B.pickReflectSpam, B.pickReflectSpam, B.pickReflectSpam, B.pickReflectSpam],
  aggro: [B.pickAggro, B.pickAttack || B.pickAggro, B.pickBigTFocus || B.pickAggro, B.pickBreakDef || B.pickAggro],
};
const TABLES = Object.keys(TABS);
const argPacks = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let packs = argPacks;
if (!packs.length) {
  const pool = readFileSync('champion-map/data/page/pool-members.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t')[2]);
  const msb = ['MSB13-R1S791820660', 'MSB12-beadplan-R1S666728707'].map((id) => 'docs/artifacts/night-adapt/' + id + '.js');
  packs = pool.concat(msb).filter((p) => existsSync(p));
}
const outC = [['pack', 'table', 'mode', 'actions', 'distinct', 'keys']];
const outU = [['pack', 'unionN', 'cellN', 'unionKeys']];
for (const path of packs) {
  const name = path.split('/').pop().replace(/\.js$/, '');
  if (!existsSync(path)) { console.error('缺包 ' + path); continue; }
  const params = P.unpack(JSON.parse(readFileSync(path, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true);
  if (!params) { console.error('不兼容 ' + path); continue; }
  const union = {}; const cellN = [];
  for (const mode of ['multi', 'long']) for (const tb of TABLES) {
    const counts = {};
    const games = tb === 'self' ? 1 : 2;
    for (let g = 0; g < games; g++) {
      const base = T.policyChooserN(params, 0.15);
      const wrap = (st, pid, legal) => { const r = base(st, pid, legal); const k = typeof r === 'string' ? r : r.key; counts[k] = (counts[k] || 0) + 1; return r; };
      const ch = [];
      for (let i = 0; i < 5; i++) {
        if (tb === 'self') ch.push(wrap);
        else if (i === g % 5) ch.push(wrap);
        else ch.push(TABS[tb][(g + i) % TABS[tb].length]);
      }
      T.oneGameN(ch, 9317 + g * 131 + (mode === 'long' ? 7919 : 0), 5, { mode });
    }
    const tot = Object.entries(counts).filter(([k]) => k !== SKJ).reduce((a, [k, v]) => a + v, 0);
    const keys = Object.keys(counts).filter((k) => k !== SKJ && counts[k] / (tot || 1) >= 0.01);
    outC.push([name, tb, mode, tot, keys.length, keys.map((k) => k + ':' + (100 * counts[k] / (tot || 1)).toFixed(0) + '%').join('|')]);
    for (const k of keys) union[k] = true;
    cellN.push(tb.slice(0, 2) + (mode === 'long' ? 'L' : 'm') + '=' + keys.length);
  }
  const uk = Object.keys(union).sort();
  outU.push([name, uk.length, cellN.join(' '), uk.join(',')]);
  console.log(name.padEnd(34) + ' 并集 ' + uk.length + ' 种  [' + uk.join(',') + ']  ‖ ' + cellN.join(' '));
}
writeFileSync(new URL('./env-matrix-cells.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), outC.map((r) => r.join('\t')).join('\n') + '\n');
writeFileSync(new URL('./env-matrix-union.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), outU.map((r) => r.join('\t')).join('\n') + '\n');
console.log('落盘 env-matrix-cells.tsv / env-matrix-union.tsv ‖ ' + packs.length + ' 包');
