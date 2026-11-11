
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { measureDefenseQuality } from '../../tools/defense-quality.mjs';
const [pack, games = '40', mode = 'multi', minshare = '0'] = process.argv.slice(2);
if (!pack) { console.error('用法: node measure-defq.mjs <pack> [games] [mode] [minShare]'); process.exit(2); }
const W = sandbox();
const params = loadChamp(W, pack);
if (!params) { console.error('读不出包：' + pack); process.exit(2); }
const m = measureDefenseQuality(W, params, { games: +games, mode, eps: 0.1, minHands: 30, minShare: +minshare });
console.log(JSON.stringify({ pack, measurable: m.measurable, def: m.def, acts: m.acts, share: +(100 * m.share).toFixed(1), n: m.n, whitePct: m.whitePct, q: m.q, placeboRatio: m.placeboRatio }));
