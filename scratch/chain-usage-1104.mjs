#!/usr/bin/env node
/* chain-usage-1104.mjs —— 一枚包在"对脚本场"里的键份额（问"链保住没有"用）
 * 为什么单独做一台（而不是复用我 14:00 那次临时脚本）：那次我**漏了 `installArch2(WIN, cfg)`**，
 *   ⇒ 沙箱还挂着出厂 v7 网，2.0 的 7993 参数被忽略，四枚不同 wid 的包读出**一模一样**的剖面
 *   （种数=12 / charge=1.64% / 防御族=68.7%）。产物 wid 明明不同 ⇒ 假读数是我的调用错，不是尺错。
 * 所以这台自带**反自我欺骗的正对照**：若两枚不同 wid 的包读出完全相同的剖面 ⇒ 当场报错退出，不许继续印表。
 * 口径：`tools/behavior-profile.mjs::fieldProfile`（ε=0 · soft · 5 席同包场 · seed0 固定），与 SEL_KEEP/T1 用的同一把尺。
 */
import { readFileSync } from 'node:fs';
const { fieldProfile, WIN } = await import('../tools/behavior-profile.mjs').then(m => m.default || m);
const { install: installArch2, packCfgExit } = await import('../tools/proto2/arch2.mjs');
const { widOf } = await import('../champion-map/pack-id.mjs');
const G = Number(process.env.GAMES || 60), SEED0 = Number(process.env.SEED0 || 77000);
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (args.length < 1) { console.error('用法：node chain-usage-1104.mjs <包.js> [<包2> …]   (GAMES=60 SEED0=77000 可覆盖)'); process.exit(64); }
let A2 = null;
const seen = {};
const rows = [];
for (const p of args) {
  const t = readFileSync(p, 'utf8');
  const raw = JSON.parse(/window\.EPIRUS_CHAMPION_3P = (\{[\s\S]*?\});/.exec(t)[1]);
  if (!A2) A2 = installArch2(WIN, packCfgExit(raw, p).cfg);       // ← 我上次漏的就是这一步
  const v = Float64Array.from(WIN.EpirusPolicy.unpack(raw, true));
  const w = (widOf(t) || '').slice(0, 12);
  const prof = fieldProfile(v, 0, 'soft', G, SEED0, 'scripts', 'multi');
  const acts = prof.acts || 0;
  const share = k => (100 * (prof.keys[k] || 0)) / (acts || 1);
  const JI = WIN.EpirusRules.SK.JI;
  const kinds = Object.keys(prof.keys || {}).filter(k => k !== JI && acts && (prof.keys[k] / acts) >= 0.005).length;
  const sig = [kinds, share('railgun').toFixed(3), share('charge').toFixed(3), share('tank').toFixed(3), share('sword').toFixed(3)].join('|');
  rows.push({ p: p.split('/').pop(), w, kinds, railgun: share('railgun'), charge: share('charge'), tank: share('tank'),
    sword: share('sword'), cannon: share('cannon'), def: acts ? 100 * (prof.def || 0) / acts : 0, sig });
  if (seen[sig] && seen[sig] !== w) {
    console.error('⛔ 自检失败：' + seen[sig] + ' 与 ' + w + ' 权重不同却读出**完全相同**的剖面 ⇒ 装载/接线错了（八成是没 installArch2），本次结果全部作废');
    process.exit(3);
  }
  seen[sig] = w;
}
console.log('包'.padEnd(18) + 'wid            种数  railgun  charge   tank   sword  cannon  防御族%');
for (const r of rows) console.log(r.p.padEnd(18) + r.w.padEnd(14) + String(r.kinds).padStart(4) +
  r.railgun.toFixed(2).padStart(9) + r.charge.toFixed(2).padStart(8) + r.tank.toFixed(2).padStart(8) +
  r.sword.toFixed(2).padStart(8) + r.cannon.toFixed(2).padStart(8) + r.def.toFixed(1).padStart(8) +
  '   （' + G + ' 局 · seed0=' + SEED0 + ' · ε=0 soft · 对脚本场）');
console.log('\n⚑ 判读法：railgun+charge 同跌 ⇒ 链没了（DS 的"宽度是拿链换的"形状）；种数升而链守住 ⇒ SEL_KEEP/覆盖锚真买到了东西。');
