/* probe-smoke-ident.cjs — 复现 supfit-gd 冒烟的三种参数源（上游/训练产物/随机粒）看是否真的逐字节同 */
const fs = require('fs');
const vm = require('vm');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(fs.readFileSync('D:/code/Epirus-Web/' + f, 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
/* arch2 装载：从上游包读 cfg */
const src = fs.readFileSync('D:/code/Epirus-Web/scratch/ga-arms/GA-ration-s41.js', 'utf8');
const at = src.indexOf('EPIRUS_CHAMPION_3P ');
let d = 0, inS = false, esc = false, end = -1;
for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
  if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
  if (c === '"') { inS = true; continue; }
  if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
const { install, packCfgExit } = require('D:/code/Epirus-Web/tools/proto2/arch2.mjs');
const got = packCfgExit(raw, 'probe');
install(W, got.cfg);

function smoke(label, params) {
  const ch = T.policyChooserN(Float64Array.from(params), 0.15);
  let kinds = {}, draws = 0, rounds = 0, got = 0, spent = 0, exp = 0;
  for (let g = 0; g < 8; g++) {
    const st = W.EpirusState.createState('multi', { next: T.mulberry32(9000 + g) }, 5);
    st.slotSalt = ((Math.imul(g + 3, 0x85ebca6b) ^ 0x27d4eb2f) >>> 0);
    W.EpirusPlay.autoGameN(st, [ch, ch, ch, ch, ch]);
    rounds += st.round;
    if (st.winner === 'draw' || st.winner == null) draws++;
    for (const e of st.events) {
      if (e.type === 'action' && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) kinds[e.key] = (kinds[e.key] || 0) + 1;
      else if (e.type === 'bead') { if (e.delta > 0) got += e.delta; else spent += -e.delta; }
      else if (e.type === 'beadExpire') exp += (e.delta != null ? Math.abs(e.delta) : 1);
    }
  }
  console.log(label + ' ‖ 非ジ ' + Object.keys(kinds).length + ' 种（' + Object.keys(kinds).map(k => k + '=' + kinds[k]).join(' ') + '）‖ 回合 ' + (rounds / 8).toFixed(1) + ' ‖ 决胜 ' + (100 * (1 - draws / 8)).toFixed(0) + '% ‖ 珠 得' + got + ' 花' + spent + ' 过' + exp);
}
const up = Float64Array.from(P.unpack(raw, true));
smoke('上游 GA-ration-s41', up);
smoke('随机 gen-3 粒', P.makePolicy ? P.makePolicy(0.5) : up.map(() => Math.random() * 0.1));
