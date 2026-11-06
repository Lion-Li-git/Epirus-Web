#!/usr/bin/env node
/* conv-obs3c-to-obs3b.mjs — 把 obs3c 包降回 obs3b（丢掉 8 个风格列）（DS · 11-03）
 * 为什么要：policy2（产品/gate-drafts 的通路）只认 obs3|obs3b ⇒ obs3c 包在门里读不出。
 * 这是**近似**：丢掉 8 维会改行为，只用于"能不能过门"的粗判。
 * 用法：node scratch/conv-obs3c-to-obs3b.mjs <src> <out>
 */
import { writeFileSync } from 'node:fs';
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, layout } from '../tools/proto2/arch2.mjs';
const SRC = process.argv[2], OUT = process.argv[3];
const raw = readPack2(SRC);
if (!raw || raw.v !== 92 || raw.dims.input !== 'obs3c') { console.error('⛔ 只收 v:92 obs3c'); process.exit(7); }
const W = sandbox(); const SKN = W.EpirusRules.skills.length;
const Lc = layout(Object.assign({}, raw.dims, { input: 'obs3c', skills: SKN }));
const Lb = layout(Object.assign({}, raw.dims, { input: 'obs3b', skills: SKN }));
const oldPv = Float64Array.from(raw.a), newPv = new Float64Array(Lb.n);
const segC = new Map(Lc.seg.map((s) => [s.name, s])), segB = new Map(Lb.seg.map((s) => [s.name, s]));
for (const name of segC.keys()) {
  const c = segC.get(name), b = segB.get(name);
  if (name !== 'seatEnc') { newPv.set(oldPv.subarray(c.off, c.off + c.len), b.off); continue; }
  const inC = Lc.fanIn.seatEnc, inB = Lb.fanIn.seatEnc, out = Lc.seatH;
  const pubC = inC - 6, pubB = inB - 6;   /* public 89 → 81 */
  for (let j = 0; j < out; j++) {
    const oc = c.off + j * inC, nb = b.off + j * inB;
    for (let i = 0; i < pubB; i++) newPv[nb + i] = oldPv[oc + i];
    for (let i = 0; i < 5; i++) newPv[nb + pubB + i] = oldPv[oc + pubC + i];
    newPv[nb + pubB + 5] = oldPv[oc + pubC + 5];
    newPv[b.off + out * inB + j] = oldPv[c.off + out * inC + j];
  }
}
installArch2(W, Object.assign({}, raw.dims, { mutMode: 'seg', input: 'obs3b', gen: 3 }));
const P = W.EpirusPolicy;
if (P.paramCount() !== Lb.n) { console.error('⛔ paramCount ' + P.paramCount() + ' vs ' + Lb.n); process.exit(7); }
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(newPv)) + ';\n', 'utf8');
console.log('✔ ' + SRC + ' → ' + OUT + '（' + Lc.n + ' → ' + Lb.n + ' 参数，丢 8 列）');
