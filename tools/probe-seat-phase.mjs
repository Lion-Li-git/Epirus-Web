/* P4 座位相位诊断（只读）：v7aim1-82 的 0 号座 0% 是**相位的确定函数**还是抽样噪声？
 * 三种配置 × 3 个独立 seed base × 150 局长程自对局：
 *   A gate 口径（slotSalt=h32(seed0+g·K)，与 G4/promote 同）
 *   B 每局随机盐（slotSalt 走对局 rng ⇒ 打掉"盐×座位"的任何解析相关）
 *   C 固定盐 =0（将相位钉死到一格 ⇒ 若 A 的偏座随 g 换相，C 应放大它）
 * 判读：同一 seed base 换三个 base 后最差座位是否**稳定同一席位** ⇒ 相位；乱跳 ⇒ 噪声。 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = 'D:/code/Epirus-Web/';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const S = sb.window.EpirusState, Play = sb.window.EpirusPlay, T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy;
function loadParams(f) {
  const s = readFileSync(REPO + f, 'utf8');
  const i = s.indexOf('{"v":');
  const r = P.loadAny(JSON.parse(s.slice(i, s.lastIndexOf('}') + 1))); return r && r.params;
}
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function runSelf(params, mode, N, base, saltCfg) {
  const chooser = T.policyChooserN(params, 0.15);
  const wins = [0, 0, 0, 0, 0], dec = [0, 0, 0, 0, 0];
  for (let g = 0; g < N; g++) {
    const rng = mb(base + g * 991);
    const st = S.createState(mode, { next: rng }, 5);
    st.slotSalt = saltCfg === 'A' ? h32(base + g * 2246822519) : saltCfg === 'B' ? Math.floor(rng() * 2 ** 31) : 0;
    Play.autoGameN(st, [chooser, chooser, chooser, chooser, chooser]);
    if (st.winner !== 'draw' && st.winner != null) { wins[st.winner]++; dec[st.winner]++; }
  }
  return { wins, dec };
}
const N = Number(process.argv[2] || 150);
const BASES = [7777, 424242, 20260920];
for (const f of process.argv.slice(3)) {
  const p = loadParams(f);
  console.log('== ' + f.replace(/^.*artifacts\//, ''));
  for (const cfg of ['A', 'B', 'C']) {
    const rows = BASES.map(b => runSelf(p, 'long', N, b, cfg));
    for (let i = 0; i < 3; i++) {
      const r = rows[i], tot = N, w = r.wins;
      const worst = w.indexOf(Math.min(...w)), best = w.indexOf(Math.max(...w));
      console.log(` [${cfg}] base${i} 席位胜% = ${w.map(x => (100 * x / tot).toFixed(0).padStart(2)).join(' ')} | 最差席 ${worst}(${(100 * w[worst] / tot).toFixed(0)}%) 最好席 ${best}(${(100 * w[best] / tot).toFixed(0)}%) 极差 ${w[best] - w[worst]}局`);
    }
  }
}
