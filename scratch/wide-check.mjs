/* wide-check.mjs — 把产品门 `broad` 那条判据（pool-frontier-lib.isWideVs）单独量给若干包看，
 * 用法：node scratch/wide-check.mjs --ref=<热启动起点> --packs=a.js,b.js [--games=40]
 * 为什么要它：§十四 把 GA 门槛换成"门已经认的那件事"之后，得先确认新判据**认不出上一批被 Goodhart 的产物**
 *   ——即 `GATE2-s7`（镜里出手 6 种而落地种 1）必须判"不宽"，否则同源化是假的。 */
import { sandbox, selfPlay } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { isWideVs, isWide, LAND_TOL } from '../tools/pool-frontier-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const REF = arg('ref', '');
const PACKS = arg('packs', '').split(',').filter(Boolean);
const GAMES = Math.max(4, Number(arg('games', 40)) || 40);
if (!PACKS.length) { console.error('用法 --ref=<起点包> --packs=a,b [--games=40]'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy;
let INST = null;
function load(p) {
  const raw = readPack2(p);
  if (!raw || raw.v !== 92) { console.error('⛔ 本尺只读代 3 容器（收到 ' + p + '）'); process.exit(7); }
  const got = packCfgExit(raw, p);
  /* ⚠ **测量期间要一直装着 arch2**：第一版在这里就 restore() 了 ⇒ 前向退回 v7 形状读代 3 权重，
   *   五枚不同包的读数变得逐字相同（G 6.98/7.10 全等）。那次数值巧合救了我：多份读数全等要先当故障查。 */
  if (INST) INST.restore();
  INST = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  return Float64Array.from(P.unpack(raw, true));
}
function measure(p) {
  const pp = load(p);
  const a = selfPlay(W, pp, 'multi', GAMES), b = selfPlay(W, pp, 'long', GAMES);
  return { gMulti: a.effSkills, gLong: b.effSkills, landMulti: a.effSkillsLand, landLong: b.effSkillsLand };
}
const fmt = (x) => 'G ' + x.gMulti.toFixed(2) + '/' + x.gLong.toFixed(2) + ' ‖ 净兑现 ' + x.landMulti.toFixed(2) + '/' + x.landLong.toFixed(2);
let inc = null;
if (REF) { inc = measure(REF); console.log('参照（热启动起点）' + REF.replace(/^.*[\\/]/, '') + '：' + fmt(inc) + ' ‖ 线 = 参照 −' + LAND_TOL); }
console.log('包'.padEnd(24) + '两模式 G ‖ 净兑现'.padEnd(28) + 'isWideVs(同源)'.padEnd(16) + 'isWide(绝对线2)'.padEnd(16) + '两桌G≥3?');
for (const p of PACKS) {
  const x = measure(p);
  const vs = inc ? (isWideVs(x, inc) ? '✔ 宽' : '✘ 不宽') : '—（无参照）';
  let why = '';
  if (inc && !isWideVs(x, inc)) {
    why = '   ← ' + (x.gMulti < 3 || x.gLong < 3 ? '种类不够（两模式须各 ≥3）' : '净兑现低于参照（打得出血的宽不够）');
  }
  console.log(p.replace(/^.*[\\/]/, '').padEnd(24) + fmt(x).padEnd(28) + vs.padEnd(16) +
    (isWide(x, 2.0) ? '✔' : '✘').padEnd(16) + ((x.gMulti >= 3 && x.gLong >= 3) ? '✔' : '✘') + why);
}
if (INST) INST.restore();
