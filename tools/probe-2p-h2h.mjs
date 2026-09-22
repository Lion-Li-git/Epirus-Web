/* 2P 头对头探针（ε=0 门禁口径）：`node tools/probe-2p-h2h.mjs <包A> <包B> [局数=120] [seed0=90210]`
 *
 * 为什么需要：夜班（`RESEARCH-LOG-2026-09-22-qoder-night.md` §N5/E1-E3）用"2P 120 镜像局"判"移植性"，
 * 但那个探针留在 `docs/debug/`（未进仓库）⇒ 这里补一个可复用的量具，口径与夜班一致：
 *   · 2 人 standard · 两席**交替**拿 A/B（消先手偏置）· ε=0（与门禁同口径）· temp 0.15 · 平局按规则判
 *   · 3P 包可以喂进来（v7 两槽同几何 213→22/5689）⇒ 这正是"3P 血统能不能打 2P"那一问的量法
 * 用法示例：node tools/probe-2p-h2h.mjs docs/artifacts/v7xn1-31.bak js/bundled-champion.js 120
 * ⚠️ 只读：不写槽、不改任何包。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const A = process.argv[2], B = process.argv[3];
const GAMES = Number(process.argv[4] || 120), SEED0 = Number(process.argv[5] || 90210);
if (!A || !B) { console.error('用法：node tools/probe-2p-h2h.mjs <包A> <包B> [局数=120] [seed0]'); process.exit(1); }

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  P = sb.window.EpirusPolicy, T = sb.window.EpirusTrainer;
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function load(f) {
  const src = readFileSync(f, 'utf8');
  let m = /window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
  if (m) return P.unpack(JSON.parse(m[1]), true);
  const i = src.indexOf('{"v"');
  if (i >= 0) return P.loadAny(JSON.parse(src.slice(i, src.lastIndexOf('}') + 1))).params;
  throw new Error('读不出包：' + f);
}
const pa = load(A), pb = load(B);
const ch = function (params) { return function (s, p, l) { return T.pickChampion(s, p, l, params, 0.15, 0, 5, 'soft'); }; };
let aw = 0, bw = 0, dr = 0, rounds = 0;
for (let g = 0; g < GAMES; g++) {
  const st = S.createState('standard', { next: mulberry32(SEED0 + g * 977) }, 2);
  const aSeat = g % 2;                      // 交替先手：奇数局 A 坐 0 号
  const cs = [ch(aSeat === 0 ? pa : pb), ch(aSeat === 0 ? pb : pa)];
  Play.autoGameN(st, cs);
  rounds += st.round;
  if (st.winner === 'draw' || st.winner == null) dr++;
  else if (st.winner === aSeat) aw++; else bw++;
}
console.log('=== 2P 头对头（standard · ε=0 · temp 0.15 · ' + GAMES + ' 局 · 交替先手 · seed0=' + SEED0 + '）===');
console.log('  A = ' + A);
console.log('  B = ' + B);
console.log('  **A 胜 ' + aw + ' · B 胜 ' + bw + ' · 平 ' + dr + '**  ⇒ A 胜率 ' + (100 * aw / GAMES).toFixed(0) + '%' +
  ' · 局长均值 ' + (rounds / GAMES).toFixed(1));
