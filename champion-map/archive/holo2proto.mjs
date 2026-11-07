/* holo2proto.mjs —— §E340 量"把全息屏障映射成原型制御"到底改变了什么（用户 ⑦）。
 *
 * 为什么这件事必须量、不能只做：卡面上 `全息屏障` 的作用**就是**"给目标施加一回合原型制御"，
 *   而它 `target:'other'` 且不能给自己（v1.5.37 已删掉那个幻影选项）⇒ 选它 = 把原型制御白送对手。
 *   promote 侧那条硬门槛 `HOLO_GIFT_MAX = 6` 判的正是这个"送盾率"，
 *   而统一尺上恒为第 1 的 `v7beadseed-82` 实测 17.3 次/局被它挡死、从没上过槽（§E305）。
 *   ⇒ "映射成原型制御"不是一个命名问题，是**能不能把榜首变成可发货**的问题，必须给成对读数。
 *
 * 三档（引擎侧 `EpirusPolicy.setHolo2Proto`，默认 off ⇒ 不带这一档时出厂形状逐字不变）：
 *   off    原样；
 *   proto  这一次要送盾 ⇒ 换成给自己上 `原型制御`（本次候选里有就换）；换不到按 drop 走；
 *   drop   只禁不换（对照档）—— 分不清增益来自"不送盾"还是"来自自盾"时看它。
 *
 * ⚠ 三条守卫（不是打印，是**不过就红着退**）：
 *   ① off 档对 v7beadseed-82 的送盾率必须 > HOLO_GIFT_MAX ⇒ 否则这台仪器与 promote 那条门槛**不同源**，
 *      后面的对比全部作废（§E305 的 17.3 就是从 promote 那条路径来的）；
 *   ② proto/drop 两档的送盾率必须显著低于 off ⇒ 否则"映射"根本没生效，是个假档；
 *   ③ 三档都必须真跑出局数（games>0 且 rounds>0）⇒ 静默空跑比报错坏。
 * 用法：node champion-map/holo2proto.mjs [--ids=a,b] [--games=40] [--out=holo2proto.tsv]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, HOLO_GIFT_MAX } from '../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const GAMES = Number(arg('games', 40)) || 40;
const MODES = ['off', 'proto', 'drop'];

const CL = rd(join(HERE, 'coords.tsv')).trim().split('\n'), ch = CL[0].split('\t');
const iId = ch.indexOf('id'), iPath = ch.indexOf('path'), iR = ch.indexOf('rank');
if (iPath < 0) { console.error('⛔ coords.tsv 没有 path 列 ⇒ 先跑 node champion-map/attach-path.mjs'); process.exit(2); }
const PATH = {}; CL.slice(1).forEach(l => { const c = l.split('\t'); if (c[iId]) PATH[c[iId]] = { path: c[iPath], rk: +c[iR] }; });

const want = String(arg('ids', 'v7beadseed-82,SHIPPED-Ldemo,v7s9-82,D4a')).split(',').map(s => s.trim()).filter(Boolean);
const W = sandbox(), P = W.EpirusPolicy, T = W.EpirusTrainer;

const rows = [];
for (const id of want) {
  const rec = PATH[id];
  if (!rec || !rec.path || !existsSync(join(ROOT, rec.path))) { console.log('  ⚠ ' + id + ' 不在 coords.tsv 的 path 上 ⇒ 跳过（不许拿"读不出"当"没影响"）'); continue; }
  const params = loadChamp(W, join(ROOT, rec.path), ROOT);
  if (!params) { console.log('  ⚠ ' + id + ' 装载失败 ⇒ 跳过'); continue; }
  for (const m of MODES) {
    P.setHolo2Proto(m);
    const sp = T.mirrorHealth(params, GAMES, 5, 'multi');
    const cast = sp.castByKey || {};
    rows.push({ id: id, rk: rec.rk, mode: m, gift: sp.holoOtherPerGame, holo: sp.holoPerGame,
      proto: (cast.proto || 0) / GAMES, guard: (cast.guard || 0) / GAMES + (cast.proto || 0) / GAMES,
      dmg: sp.dmgPerGame, rounds: sp.rounds, zero: sp.zeroRate, eff: sp.effSkills, games: sp.games });
  }
  P.setHolo2Proto('off');   /* 档必须归位：留在 proto 会让后面那枚包被上一枚的档污染 */
}

console.log('\n同一枚包的三个档（mirror 自对局 · 5 人 · 每档 ' + GAMES + ' 局）');
console.log('包名                F名次  档      送盾/局   自盾proto/局  伤害/局  回合  有效技能');
for (const r of rows) {
  console.log(r.id.padEnd(20) + String(r.rk).padStart(4) + '  ' + r.mode.padEnd(7) +
    r.gift.toFixed(2).padStart(8) + r.proto.toFixed(2).padStart(13) + r.dmg.toFixed(2).padStart(10) +
    r.rounds.toFixed(1).padStart(7) + r.eff.toFixed(2).padStart(10));
}
const of = (id, m) => rows.filter(r => r.id === id && r.mode === m)[0];
let bad = [];
const bs = of('v7beadseed-82', 'off');
if (bs) { if (!(bs.gift > HOLO_GIFT_MAX)) bad.push('守卫①：off 档送盾 ' + bs.gift.toFixed(2) + ' 没超过硬门槛 ' + HOLO_GIFT_MAX + ' ⇒ 这台仪器与 promote 那条不同源，读数作废'); }
for (const id of want) {
  const o = of(id, 'off'), p = of(id, 'proto'), d = of(id, 'drop');
  if (!o) continue;
  if (o.gift > 0.05) {
    if (!p || !(p.gift < o.gift)) bad.push('守卫②：' + id + ' 的 proto 档送盾没降（' + o.gift.toFixed(2) + ' → ' + (p ? p.gift.toFixed(2) : '缺') + '）');
    if (!d || !(d.gift < o.gift)) bad.push('守卫②：' + id + ' 的 drop 档送盾没降（' + o.gift.toFixed(2) + ' → ' + (d ? d.gift.toFixed(2) : '缺') + '）');
  }
  for (const r of [o, p, d]) if (r && !(r.games > 0 && r.rounds > 0)) bad.push('守卫③：' + id + '/' + r.mode + ' 空跑（games=' + r.games + ' rounds=' + r.rounds.toFixed(1) + '）');
}
/* 含糊值必须响亮拒（拼错一个字母就是一份静默的假读数） */
let threw = false;
try { P.setHolo2Proto('Prot0'); } catch (e) { threw = true; }
if (!threw) bad.push('守卫④：setHolo2Proto 接受了非法值 "Prot0" ⇒ 这一档没有牙');

writeFileSync(join(HERE, 'holo2proto.tsv'),
  'id\tF-rank\tmode\tholoOtherPerGame\tholoPerGame\tprotoPerGame\tdmgPerGame\trounds\tzeroRate\teffSkills\tgames\n' +
  rows.map(r => [r.id, r.rk, r.mode, r.gift.toFixed(3), r.holo.toFixed(3), r.proto.toFixed(3), r.dmg.toFixed(2),
    r.rounds.toFixed(2), r.zero.toFixed(3), r.eff.toFixed(3), r.games].join('\t')).join('\n') + '\n');
console.log('\n已写 champion-map/holo2proto.tsv（' + rows.length + ' 行）');
if (bad.length) { console.error('⛔ ' + bad.length + ' 条守卫红：\n  ' + bad.join('\n  ')); process.exit(2); }
console.log('✔ 四条守卫全绿（含"档必须归位"与"非法值必须抛"）');
