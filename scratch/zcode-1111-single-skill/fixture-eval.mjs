/* 夹具混编评测：--fixture=spec，spec 逗号分隔 4 席（ opponents 槽），每席 = <id>@pack | <名>@bot | <file>@botfile
 * 读数 = 样本包（botseat-eval 的 S，20 枚）× multi/long × 16 局 夺1率 → fixture-<名>.tsv
 * 用法：node fixture-eval.mjs --name=F3c --fixture=MSB13-R1S791820660@pack,MSB14-railgun-R1S175656469@pack,pickAdaptive@bot,human-z.mjs@botfile */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const get = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const NAME = get('name', 'F3x');
const SPEC = get('fixture', '').split(',').filter(Boolean);
if (SPEC.length !== 4) { console.error('⛔ fixture 要 4 席'); process.exit(2); }
const G = Number(get('games', 16)) || 16;
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'])
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
const loadPack = (p) => T.policyChooserN(P.unpack(JSON.parse(readFileSync(p, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]), true), 0.15);
const HZ = await import('./human-z.mjs');
const SEATS = SPEC.map((s) => {
  const [id, kind] = s.split('@');
  if (kind === 'pack') {
    const cands = id.endsWith('.js') || id.endsWith('.bak') ? [id, 'docs/artifacts/' + id, 'docs/artifacts/night-adapt/' + id, 'docs/artifacts/2p0-pool/' + id, 'docs/artifacts/e507-out/' + id] : ['docs/artifacts/night-adapt/' + id + '.js', 'docs/artifacts/e507-out/' + id + '.js', 'docs/artifacts/2p0-pool/' + id + '.bak', 'scratch/ds-1109/' + id + '.js'];
    const c = cands.find((x) => existsSync(x));
    if (!c) throw new Error('包找不到 ' + id);
    return { tag: id, fn: loadPack(c) };
  }
  if (kind === 'bot') return { tag: 'bot:' + id, fn: B[id] };
  if (kind === 'botfile') return { tag: 'botfile:' + id, fn: HZ.pickHumanZ };
  throw new Error('坏席 ' + s);
});
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
const rows = [['id', 'table', 'mode', 'first', 'games', 'rate']];
console.log('[fixture ' + NAME + '] ' + SEATS.map((s) => s.tag).join(' + '));
for (const [id, path] of S) {
  const mm = readFileSync(path, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!mm) { console.error('读不出 ' + id); continue; }
  const params = P.unpack(JSON.parse(mm[1]), true);
  if (!params) { console.error('不兼容 ' + id); continue; }
  for (const mode of ['multi', 'long']) {
    let first = 0;
    for (let j = 0; j < G; j++) {
      const seat = j % 5;
      const base = T.policyChooserN(params, 0.15);
      const ch = [];
      for (let i = 0; i < 5; i++) ch.push(i === seat ? base : SEATS[(j + i) % 4].fn);
      const gseed = 73000 + j * 617 + (mode === 'long' ? 40037 : 0);
      const r = T.oneGameN(ch, gseed, 5, { mode });
      if (T.rankOf(r.state, seat, gseed) === 1) first++;
    }
    rows.push([id, 'all', mode, first, G, (first / G).toFixed(4)]);
  }
  console.log(id.padEnd(28) + ' m=' + rows[rows.length - 2][5] + ' L=' + rows[rows.length - 1][5]);
}
writeFileSync(new URL('./fixture-' + NAME + '.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), rows.map((r) => r.join('\t')).join('\n') + '\n');
console.log('落盘 fixture-' + NAME + '.tsv');
