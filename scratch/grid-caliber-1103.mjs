#!/usr/bin/env node
/* grid-caliber-1103.mjs — T1 那把"族别签名"尺的**开臂前标定**（qoder · 11-03）
 * 问两件事（都在发 12 分钟臂之前问，因为臂只印一次梯）：
 *   ① 档边线（防御族 <0.5/3/8% ‖ 种数 <5/8/11）在**真实候选**上分不分得开 —— 分不开 = 这根键零作用；
 *   ② 接线自证：`WIN` 装了 arch2 之后 `fieldProfile` 读出来的种数能不能对上另一台独立尺
 *      （`scratch/breadth.mjs` 用 arena2 量的 `CBG-s13 ‖ 种数 8 ‖ charge 6.5% mine 5.5% gun 4.8% ring 4.3% bigT 4.1% sword 3.5% drain 2.3% railgun 1.1%）。
 *      ⚑ 这条是本页在册教训（覆盖式接入要自证"真被调用"）：装失败时 `fieldProfile` **不崩**，只是拿 v7 前向读代 3 权重。
 * 用法：node scratch/grid-caliber-1103.mjs --packs=p1,p2 --games=12
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const known = ['packs', 'games', 'spec'];
const bad = argv.filter((x) => x.startsWith('--') && !known.includes(x.slice(2).split('=')[0]));
if (bad.length) { console.error('⛔ 不认识的旗标：' + bad.join(' ') + '（可用 --packs= --games= --spec=）'); process.exit(64); }
const PACKS = String(arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const GAMES = Math.max(4, Number(arg('games', 12)) || 12);
const SPEC = String(arg('spec', 'S1ob:input=obs3b,gen=3,keySplit=1'));

const { fieldProfile, WIN } = await import(pathToFileURL(ROOT + '/tools/behavior-profile.mjs').href);
const { install: installArch2, readPack2, packCfgExit, verifyWired: verifyArch2Wired } = await import(pathToFileURL(ROOT + '/tools/proto2/arch2.mjs').href);

const parts = SPEC.split(':');
const cfg = parts[1] ? Object.fromEntries(parts[1].split(',').map((kv) => { const [k, v] = kv.split('='); return [k.trim(), /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v]; })) : {};
const A2 = installArch2(WIN, cfg);
console.log('arch2 装进量具沙箱：面=' + A2.L.input + ' ‖ paramCount=' + WIN.EpirusPolicy.paramCount());
const WC = verifyArch2Wired(WIN, A2, { mode: 'multi', n: 5, games: 1 });
console.log('接线自证：' + JSON.stringify(WC));

const R = WIN.EpirusRules, JI = R.SK.JI;
const defB = (d) => (d < 0.5 ? 0 : d < 3 ? 1 : d < 8 ? 2 : 3);
const kindB = (k) => (k < 5 ? 0 : k < 8 ? 1 : k < 11 ? 2 : 3);

for (const p of PACKS) {
  let pv = null;
  try { const raw = readPack2(p); const got = packCfgExit(raw, p); pv = Float64Array.from(WIN.EpirusPolicy.unpack(raw, true)); if (String(got.cfg.input) !== A2.L.input) console.log('  ⚠ 包的面=' + got.cfg.input + ' ≠ 装的 ' + A2.L.input); }
  catch (e) { console.log(p.split('/').pop() + '：读不出（' + String(e && e.message || e).slice(0, 60) + '）'); continue; }
  const row = [];
  for (const gm of ['multi', 'long']) {
    const t = fieldProfile(pv, 0, 'soft', GAMES, 77000, 'scripts', gm);
    const acts = t.acts || 0;
    const dsh = acts ? 100 * (t.def || 0) / acts : 0;
    const ks = Object.keys(t.keys || {}).filter((k) => k !== JI && acts && ((t.keys[k] || 0) / acts) >= 0.005)
      .sort((a, b) => t.keys[b] - t.keys[a]);
    row.push(gm + ' ⇒ D' + defB(dsh) + 'K' + kindB(ks.length) + '（防御族 ' + dsh.toFixed(1) + '% ‖ 种数 ' + ks.length + ' ‖ ' +
      ks.slice(0, 12).map((k) => k + ' ' + (100 * t.keys[k] / acts).toFixed(1) + '%').join(' ') + ' ‖ acts/局=' + (acts / GAMES).toFixed(1) + '）');
  }
  console.log(p.split('/').pop() + '\n  ' + row.join('\n  '));
}
