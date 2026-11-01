#!/usr/bin/env node
/* breadth2.mjs — 2.0 包的**塌缩/宽度**轴（千问 · 11-01，用户裁"广度要及时作为下限把过分退化的包筛掉"）
 *
 * 单一来源：归属走 `audit-lib.landShareOf`（⛔ 不许自己写 max(landByKey)/landedTotal —— `landByKey` 含非卡键，
 *   v1.5.227 实测算出过 44900% 份额）；局与统计走 `EpirusTrainer.mirrorHealth`（v7 那把 `probe-g-collapse` 的同一函数）。
 * 与 probe-g-collapse 的**不同档**：那把走 `probe-layer-caliber` 的产品 ε 搬运、且只读 `.js` 冠军束；本尺在
 *   **装了 arch2 的沙箱**里跑 `trainChooser` ⇒ 能读 v:92 的 `.bak`，但口径是训练镜。**所以在册的 0.60 线不直接搬**：
 *   每表第一行永远是 v7 同尺同档的锚，线要按锚重立（预登记见 `PREREG-2026-11-01-BREADTH-FLOOR-qoder.md`）。
 *
 * 用法：node tools/proto2/breadth2.mjs --pack=a.bak[,b.bak,...] [--games=120] [--n=5] [--out=x.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp, landShareOf } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACKS = arg('pack', '').split(',').map((s) => s.trim()).filter(Boolean);
const GAMES = Math.max(20, Number(arg('games', 120)) || 120);
const N = Math.max(2, Number(arg('n', 5)) || 5);
if (!PACKS.length) { console.error('用法：--pack=a.bak[,b.bak,…]（或 v7）'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer;
const refParams = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js'));

function rowOf(label, params, container) {
  const mh = T.mirrorHealth(params, GAMES, N, 'multi');
  const ls = landShareOf(W, mh);
  const castK = Object.keys(mh.castByKey || {});
  return {
    pack: label, container: container, games: GAMES, n: N,
    landedTotal: mh.landedTotal, landedKeys: mh.landedKeys, effSkillsLand: mh.effSkillsLand,
    distinctCast: castK.length, maxCastKey: (function () { let k = null, c = 0; for (const x of castK) if (mh.castByKey[x] > c) { c = mh.castByKey[x]; k = x; } return k; })(),
    maxCastShare: (function () { const t = castK.reduce((a, x) => a + mh.castByKey[x], 0); let c = 0; for (const x of castK) c = Math.max(c, mh.castByKey[x]); return t ? c / t : 0; })(),
    /* ⚑ 分母为 0 不许与『没塌缩』同形：一次伤害都没落地 ⇒ 份额**读不出**（null），不是 0.0%（11-01 池表抓到）。 */
    maxLandShare: ls.total > 0 ? ls.share : null, maxLandKey: ls.key, landReadable: ls.total > 0, pierceMissing: mh.pierceMissing,
  };
}

const out = [];
out.push(rowOf('v7（锚·同尺同档）', refParams, 'v7 5689'));
let installed = null;
for (const p of PACKS) {
  if (p === 'v7') { out[0].pack = 'v7'; continue; }   // 锚行就是 v7 同尺同档，不重复跑一遍
  let raw;
  try { raw = readPack2(p); } catch (e) { console.log('⚠ 读不出 ' + p + '：' + String(e && e.message).slice(0, 70)); continue; }
  const got = packCfgExit(raw, p);
  if (installed) installed.restore();
  installed = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pp = W.EpirusPolicy.unpack(raw, true);
  if (!pp) { console.error('⛔ ' + p + ' unpack 不出 ⇒ 不量'); process.exit(7); }
  const container = 'v:' + raw.v + ' gen' + (raw.dims && raw.dims.gen) + ' ' + (raw.dims && raw.dims.input) + ' n=' + pp.length;
  out.push(rowOf(p.replace(/^.*[\\/]/, ''), pp, container));
}

const pct = (x) => (x == null ? '—' : (100 * x).toFixed(1) + '%');
console.log('=== 塌缩/宽度（mirrorHealth ' + GAMES + ' 局 · n=' + N + ' · multi · 归属=audit-lib.landShareOf 单源）===');
console.log('包'.padEnd(28) + '容器'.padEnd(24) + '落地'.padEnd(6) + '种'.padEnd(4) + 'G落地'.padEnd(8) + '出手种'.padEnd(8) + '最大落地卡'.padEnd(16) + '份额'.padEnd(8) + '最大出手卡份额');
for (const r of out) {
  console.log(r.pack.padEnd(28) + String(r.container).padEnd(24) + String(r.landedTotal).padEnd(6) +
    String(r.landedKeys).padEnd(4) + (r.effSkillsLand == null ? '—' : r.effSkillsLand.toFixed(2)).padEnd(8) +
    String(r.distinctCast).padEnd(8) + String(r.maxLandKey || '—').padEnd(16) + pct(r.maxLandShare).padEnd(8) + pct(r.maxCastShare));
}
const anchor = out[0];
console.log('锚（v7 同尺同档）：最大落地卡 ' + anchor.maxLandKey + ' 份额 ' + pct(anchor.maxLandShare) + ' ‖ 出手种 ' + anchor.distinctCast +
  '（最大出手卡份额 ' + pct(anchor.maxCastShare) + '）‖ 落地种 ' + anchor.landedKeys + ' ‖ 分母 ' + anchor.landedTotal + ' 次落地/' + anchor.games + ' 局');
if (arg('out', '')) writeFileSync(arg('out'), JSON.stringify({ ts: new Date().toISOString(), games: GAMES, n: N, rows: out }, null, 2));
