/* def-quality-gen3.mjs — 白防质量（按 HP 分层）给代 3/v7 包用（DS · 2026-11-02，scratch）
 * 直接用 tools/defense-quality.mjs 的单一判据（有效/半有效/白防），只补"代 3 容器能读 + 按血量分层"。
 * 窗口 = 本决策结算窗（本决策之后 → 下一决策之前的事件）。
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
import { classifyDefenseWindow, defenseQuality, formatQuality } from '../tools/defense-quality.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', ''), GAMES = Math.max(5, Number(arg('games', 30)) || 30), N = Math.max(3, Number(arg('n', 5)) || 5);
const MODE = arg('mode', 'multi'), TEMP = Number(arg('temp', 0.15));
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const DEFENSE = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k].cat === R.CAT.DEFENSE));

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) { const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v }; }
  const c7 = loadChamp(W, path, '.'); if (!c7) { console.error('⛔ 读不出'); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7' };
}
const { pp, label } = loadPack(PACK);
const STR = { '<=1': { eff: 0, part: 0, idle: 0 }, '2': { eff: 0, part: 0, idle: 0 }, '>=3': { eff: 0, part: 0, idle: 0 } };
const DRAIN = { menu: 0, pick: 0 };
let pending = null;   // { cursor, hp, isDef }
const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');
const focus = (state, pid, legal) => {
  const evs = state.events || [];
  if (pending) {
    const win = evs.slice(pending.cursor);
    if (pending.isDef) { const c = classifyDefenseWindow(win, R, pid); const b = STR[pending.hp] || STR['>=3']; b[c] = (b[c] || 0) + 1; }
    pending = null;
  }
  const me = state.p[pid] || {};
  const keys = (legal || []).map((c) => (typeof c === 'string' ? c : c.key));
  if ((me.hp | 0) <= 1 && keys.indexOf(R.SK.DRAIN) >= 0) DRAIN.menu++;
  const picked = inner(state, pid, legal);
  const pk = (picked && typeof picked === 'object') ? (picked.key || '?') : String(picked);
  if ((me.hp | 0) <= 1 && pk === R.SK.DRAIN) DRAIN.pick++;
  pending = { cursor: evs.length, hp: (me.hp | 0) <= 1 ? '<=1' : ((me.hp | 0) === 2 ? '2' : '>=3'), isDef: DEFENSE.has(pk) };
  return picked;
};
const subs = [focus];
const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
for (let pid = 1; pid < N; pid++) {
  let ri = (90000 * 7 + pid * 11 + sh * 13 + 101) % A.roster.length, e = A.roster[ri];
  while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
  subs.push(e.sel);
}
for (let k = 0; k < GAMES; k++) { pending = null; T.oneGameN(subs, 77000 + k * 977, N, { mode: MODE }); }
console.log('### 白防质量 ‖ 包=' + PACK.split('/').pop() + ' ‖ ' + label + ' ‖ 5P strat ‖ ' + GAMES + ' 局');
for (const b of ['<=1', '2', '>=3']) { const q = defenseQuality(STR[b]); console.log('HP ' + b + '：' + formatQuality(q)); }
console.log('残血摄魂：菜单 ' + DRAIN.menu + ' 次 ‖ 被选 ' + DRAIN.pick + ' 次 ⇒ ' + (DRAIN.menu ? (100 * DRAIN.pick / DRAIN.menu).toFixed(1) + '%' : '—'));
