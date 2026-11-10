#!/usr/bin/env node
/* convert-obs3c.mjs — 把 obs3b 包搬到 obs3c（新 8 列零初始化、其余段逐位复制）（DS · 2026-11-02 晚）
 * 为什么：obs3c 不能直接热启动（维度不同），但从零训 150 代太短 ⇒ 先搬权重，再在 obs3c 上续训。
 * 自证：新列全 0 且其余逐位复制 ⇒ 前向**应与原包逐位相同**（落在同一局同一结果）。
 * 用法：node scratch/convert-obs3c.mjs <src> <out>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2, readPack2, layout } from './arch2.mjs';

const SRC = process.argv[2], OUT = process.argv[3];
const raw = readPack2(SRC);
if (!raw || raw.v !== 92) { console.error('⛔ 只收 v:92'); process.exit(7); }
if (raw.dims.input !== 'obs3b') { console.error('⛔ 源不是 obs3b：' + raw.dims.input); process.exit(7); }
const W = sandbox();
const SKN = W.EpirusRules.skills.length;   /* width of skill id one-hot: engine gives it (30) */
const Lb = layout(Object.assign({}, raw.dims, { input: 'obs3b', skills: SKN }));
const Lc = layout(Object.assign({}, raw.dims, { input: 'obs3c', skills: SKN }));
const oldPv = Float64Array.from(raw.a);
const newPv = new Float64Array(Lc.n);
const segB = new Map(Lb.seg.map((s) => [s.name, s])), segC = new Map(Lc.seg.map((s) => [s.name, s]));
for (const name of segB.keys()) {
  const b = segB.get(name), c = segC.get(name);
  if (!c) { console.error('⛔ 目标缺段 ' + name); process.exit(7); }
  if (name !== 'seatEnc') {
    if (b.len !== c.len) { console.error('⛔ 段长不等 ' + name + ' ' + b.len + ' vs ' + c.len); process.exit(7); }
    newPv.set(oldPv.subarray(b.off, b.off + b.len), c.off);
    continue;
  }
  /* 席位编码器输入 = [public ‖ rel 5 ‖ isSelf 1]；obs3c 的 public 比 obs3b 宽 8（风格块落在 public 末尾）。
   * ⇒ 必须分段搬：public 前 81 位逐位复制、8 个风格位留 0、rel 与 isSelf 挪到新偏移（**不能整段前 87 位照抄**）。 */
  const inB = Lb.fanIn.seatEnc, inC = Lc.fanIn.seatEnc, out = Lb.seatH;
  const pubB = inB - 6, pubC = inC - 6;
  for (let j = 0; j < out; j++) {
    const ob = b.off + j * inB, nc = c.off + j * inC;
    for (let i = 0; i < pubC; i++) newPv[nc + i] = (i < pubB) ? oldPv[ob + i] : 0;
    for (let i = 0; i < 5; i++) newPv[nc + pubC + i] = oldPv[ob + pubB + i];
    newPv[nc + pubC + 5] = oldPv[ob + pubB + 5];
    newPv[c.off + out * inC + j] = oldPv[b.off + out * inB + j];
  }
}
const cfg = Object.assign({}, raw.dims, { mutMode: 'seg', input: 'obs3c', gen: 3 });
installArch2(W, cfg);
const P = W.EpirusPolicy;
if (P.paramCount() !== Lc.n) { console.error('⛔ paramCount 不符 ' + P.paramCount() + ' vs ' + Lc.n); process.exit(7); }
const packed = P.pack(newPv);
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
writeFileSync(OUT + '.meta.json', JSON.stringify({ tool: 'convert-obs3c', parent: SRC, parentHash: null, outDim: Lc.n, inDim: Lb.n, ts: new Date().toISOString() }, null, 1));
console.log('✔ ' + SRC + ' → ' + OUT + '（' + Lb.n + ' → ' + Lc.n + ' 参数）');