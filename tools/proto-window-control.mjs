/* 正对照：我的"同一席本回合被原型制御挡下的合计"口径，能不能碰到 ≥3 那一格。
 * 构造：目标席自己上原型制御（proto），然后 k 个席各开一枪（每发 1 点，可挡）打同一目标。
 * 断言：k=3 ⇒ 合计应=3 且反伤触发（reflect by=proto 出现、攻击者掉血）；k=1 ⇒ 合计=1 不触发。
 * 这一台不过，后面所有"≥3 从没发生"的读数一律不许引用（分档器碰不到那一格 ≠ 桌面上没有那一格）。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
/* ROOT 自解析（10-18 归仓时改）：这台是**正对照**（量具能不能碰到 ≥3 那一格），必须在干净克隆里也跑得起来，
 *   否则任何"≥3 从没发生"的读数都没人复算得了。`WT=<路径>` 可覆盖。 */
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../..');
const { sandbox } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const W = sandbox(ROOT);
const S = W.EpirusState, X = W.EpirusResolve, R = W.EpirusRules;
const mul = (a) => { let t = a >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) >>> 0; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

function scene(k) {
  const st = S.createState('multi', { next: mul(11) }, 5);
  for (let i = 0; i < 5; i++) { st.p[i].ep = 9; st.p[i].hp = 5; }
  X.startTurn(st);
  S.attemptAction(st, 0, R.SK.PROTO, { target: null });        // 0 号席自己上原型制御
  const attackers = [1, 2, 3, 4].slice(0, k);
  for (const a of attackers) S.attemptAction(st, a, R.SK.GUN, { target: 0 });
  const n0 = (st.events || []).length;
  X.resolveActions(st);
  const ev = (st.events || []).slice(n0);
  const protoSum = ev.filter(e => e.type === 'blocked' && e.by === '原型制御' && e.to === 0).reduce((s, e) => s + (e.amt || 0), 0);
  const refl = ev.filter(e => e.type === 'reflect' && e.by === 'proto');
  const dmgToAttackers = ev.filter(e => e.type === 'damage' && attackers.indexOf(e.to) >= 0 && e.source === 0).reduce((s, e) => s + (e.amt || 0), 0);
  return { k, protoSum, blocked: ev.filter(e => e.type === 'blocked').length, reflect: refl.length, dmgToAttackers,
    hp: st.p.map(p => p.hp).join('/') };
}

let bad = 0;
const say = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) bad++; };
for (const k of [1, 2, 3, 4]) {
  const r = scene(k);
  console.log('  k=' + r.k + ' 发枪打同一持盾席 ⇒ 被挡合计=' + r.protoSum + ' ‖ 挡住事件=' + r.blocked + ' ‖ 反伤 reflect=' + r.reflect +
    ' ‖ 攻击者被反伤害=' + r.dmgToAttackers + ' ‖ 血量(0/1/2/3/4)=' + r.hp);
  if (k >= 3) say(r.protoSum >= 3 && r.reflect > 0 && r.dmgToAttackers > 0, 'k=' + k + ' ⇒ ≥3 聚合这一格**量具读得到**（触发反伤）');
  if (k < 3) say(r.reflect === 0 && r.protoSum < 3, 'k=' + k + ' ⇒ 不该触发（<3）');
}
console.log(bad ? '\n⛔ 正对照不过 ⇒ 分档器不可引用' : '\n✔ 正对照通过：口径能碰到 ≥3 那一格，也能守住 <3 不触发');
process.exit(bad ? 1 : 0);
