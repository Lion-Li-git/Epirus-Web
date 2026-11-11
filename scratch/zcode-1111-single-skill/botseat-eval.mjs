/* 脚本席夹具候选体测：样本包 × 对手桌（全 pickAdaptive / 1 adaptive+3 脚本）× multi/long
 * 读数 = 包夺1率；输出 botseat-<bot>.tsv（B 轴候选的判别力/风格回归原料） */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const BOTN = process.argv[2] || 'pickAdaptive';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
/* BOTN 支持文件席：.mjs 结尾 ⇒ 动态导入同目录模块，取其导出的席函数（如 human-z.mjs 的 pickHumanZ） */
const bot = BOTN.endsWith('.mjs') ? (await import('./' + BOTN)).pickHumanZ : B[BOTN];
if (typeof bot !== 'function') { console.error('⛔ Bots.' + BOTN + ' 不存在'); process.exit(2); }
const S = [
  ['V111', 'docs/artifacts/e234-out/V111.js'], ['v7densE-81', 'docs/artifacts/v7densE-81.bak'], ['v7role5-81', 'docs/artifacts/v7role5-81.bak'],
  ['v13-103', 'docs/artifacts/v13-103.bak'], ['v14-116', 'docs/artifacts/v14-116.bak'], ['v17-142', 'docs/artifacts/v17-142.bak'],
  ['v7b-42', 'docs/artifacts/v7b-42.bak'], ['v9-42', 'docs/artifacts/v9-42.bak'], ['e1-teach-77003', 'docs/artifacts/e1-teach-77003.bak'],
  ['v7blk1-93', 'docs/artifacts/v7blk1-93.bak'], ['v7ctrlE-31', 'docs/artifacts/v7ctrlE-31.bak'], ['v7expo-34', 'docs/artifacts/v7expo-34.bak'],
  ['v7seat24-31', 'docs/artifacts/v7seat24-31.bak'], ['DSTR4-s13', 'docs/artifacts/2p0-pool/DSTR4-s13.bak'],
  ['MSB13-R1S791820660', 'docs/artifacts/night-adapt/MSB13-R1S791820660.js'], ['MSB11-R2S306293884', 'docs/artifacts/night-adapt/MSB11-R2S306293884.js'],
  ['MSB14-railgun-R1S175656469', 'docs/artifacts/night-adapt/MSB14-railgun-R1S175656469.js'], ['Q-s47', 'docs/artifacts/e507-out/Q-s47.js'],
  ['G5J-50', 'scratch/ds-1109/G5J-50.js'], ['KDG-B-Q-s13', 'docs/artifacts/night-adapt/KDG-B-Q-s13.js'],
];
const G = 16;
const rows = [['id', 'table', 'mode', 'first', 'games', 'rate']];
function table(kind) {
  return kind === 'all' ? [bot, bot, bot, bot] : [bot, B.pickAggro, B.pickDefend, B.pickFarmer];
}
for (const [id, path] of S) {
  let src; try { src = readFileSync(path, 'utf8'); } catch { console.error('缺 ' + id); continue; }
  const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!mm) { console.error('读不出 ' + id); continue; }
  const params = P.unpack(JSON.parse(mm[1]), true);
  if (!params) { console.error('不兼容 ' + id); continue; }
  for (const mode of ['multi', 'long']) for (const kind of ['all', 'mix']) {
    let first = 0;
    for (let j = 0; j < G; j++) {
      const seat = j % 5;
      const base = T.policyChooserN(params, 0.15);
      const ch = [];
      const op = table(kind);
      for (let i = 0; i < 5; i++) ch.push(i === seat ? base : op[(j + i) % op.length]);
      const gseed = 88000 + j * 613 + (mode === 'long' ? 50021 : 0) + (kind === 'all' ? 0 : 11);
      const r = T.oneGameN(ch, gseed, 5, { mode });
      if (T.rankOf(r.state, seat, gseed) === 1) first++;
    }
    rows.push([id, kind, mode, first, G, (first / G).toFixed(4)]);
    console.log(id.padEnd(28) + ' ' + kind + ' ' + mode.padEnd(5) + ' ' + first + '/' + G);
  }
}
writeFileSync(new URL('./botseat-' + BOTN + '.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), rows.map((r) => r.join('\t')).join('\n') + '\n');
console.log('落盘 botseat-' + BOTN + '.tsv');
