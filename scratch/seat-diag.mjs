/* seat-diag.mjs — 座位偏置诊断（ZCode · 11-03 凌晨）：v7 锚 vs 代 3 产物的逐席胜率镜像对比
 * 判定问题归属：v7 也斜 ⇒ 引擎/游戏固有（结算顺序）；v7 平而代 3 斜 ⇒ 训练方法问题。 */
import { sandbox, seatSymmetry } from '../tools/audit-lib.mjs';
import { readFileSync } from 'node:fs';
import { install, packCfgExit } from '../tools/proto2/arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

function loadAny(p) {
  const src = readFileSync(p, 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
  let d = 0, inS = false, esc = false, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
  const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
  if (raw.v === 7 || (raw.a && raw.v == null)) return Float64Array.from(raw.a);   /* v7 锚：单向量，v7 通路 */
  const got = packCfgExit(raw, p);
  install(W, got.cfg);                                    /* ⚠ 每包重装布局——漏了它四枚包会跑成同一行为 */
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return Float64Array.from(P.unpack(raw, true));
}

const GAMES = Number(process.env.GAMES || 100);
for (const p of process.argv.slice(2)) {
  try {
    const params = loadAny(p);
    const r = seatSymmetry(W, params, 'long', GAMES);
    const name = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    const w = r.win || r;
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    const pct = w.map((x) => (100 * x / tot).toFixed(0));
    const spread = Math.max(...pct.map(Number)) - Math.min(...pct.map(Number));
    console.log(name.padEnd(24) + ' ‖ 逐席胜率 ' + pct.join('/') + ' ‖ 极差 ' + spread.toFixed(0) + 'pt' + (r.draw ? ' ‖ 平局 ' + r.draw : ''));
  } catch (e) { console.log('⛔ ' + p + '：' + e.message); }
}
