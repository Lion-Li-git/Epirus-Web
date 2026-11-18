#!/usr/bin/env node
/* pack-fuse.mjs —— 权重融合（融合包 · PLAN-2026-11-19-night W1b · 用户令「搞融合包再后训练」）
 *
 * 机制：两个同形状包的 `.a` 权重数组按 t:A+(1-t):B 线性混合，产第三个 .bak。
 *   · `a` 是唯一权重源（policy unpack 只读 o.a ⇒ 改 a 即改行为，f/fa/h 不消费）。
 *   · **同盆地融合**（B 由 A 热启动衍生）权重相干、大概率保行为；跨家族融合大概率塌， exploratory 跑了就知道。
 *   · 产物 META 记 fusedFrom:[widA,widB] + ratio + 臂名，谱系可追。
 *
 * 用法：node tools/pack-fuse.mjs --a=<packA> --b=<packB> --t=0.5 --out=<fused.bak> [--arm=<名>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rejectUnknownFlags } from './audit-lib.mjs';
import { widOf } from '../champion-map/pack-id.mjs';

rejectUnknownFlags(process.argv.slice(2), ['a', 'b', 't', 'out', 'arm'], 'pack-fuse');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const h = process.argv.find(a => a.indexOf('--' + k + '=') === 0); return h ? h.slice(k.length + 3) : d; };
const PA = arg('a', ''), PB = arg('b', ''), T = Number(arg('t', 0.5)), OUT = arg('out', '');
const ARM = arg('arm', 'fuse');
if (!PA || !PB || !OUT) { console.error('用法：--a=<pack> --b=<pack> --t=0.5 --out=<fused.bak> [--arm=名]'); process.exit(2); }
if (!(T >= 0 && T <= 1)) { console.error('⛔ --t 必须在 [0,1]（收到 ' + T + '）'); process.exit(2); }

function loadPack(path) {
  const sb = { window: {}, console };
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(readFileSync(join(ROOT, path), 'utf8'), sb, { filename: path });
  const g = sb.window.EPIRUS_CHAMPION_3P || sb.window.EPIRUS_CHAMPION;
  const meta = sb.window.EPIRUS_CHAMPION_3P_META || sb.window.EPIRUS_CHAMPION_META || null;
  if (!g || !Array.isArray(g.a)) { console.error('⛔ 读不出权重数组：' + path); process.exit(2); }
  return { g, meta };
}
const A = loadPack(PA), B = loadPack(PB);
if (A.g.a.length !== B.g.a.length) {
  console.error('⛔ 形状不齐：a 长度 ' + A.g.a.length + ' vs ' + B.g.a.length + '（跨架构融合没意义）'); process.exit(2);
}
const fused = JSON.parse(JSON.stringify(A.g));
for (let i = 0; i < fused.a.length; i++) {
  let v = T * A.g.a[i] + (1 - T) * B.g.a[i];
  fused.a[i] = Math.round(v * 1e6) / 1e6;   /* 与 pack 落盘精度同阶（两位小数会失真，6 位够） */
}
const widA = widOf(readFileSync(join(ROOT, PA), 'utf8')), widB = widOf(readFileSync(join(ROOT, PB), 'utf8'));
const now = new Date().toISOString();
const meta = {
  hotstartFrom: widA, source: 'tools/pack-fuse.mjs', arm: ARM,
  fusedFrom: [widA, widB], fusedPaths: [PA, PB], ratio: T,
  parents: [A.meta ? { arm: A.meta.arm, bandIdx: A.meta.bandIdx } : null, B.meta ? { arm: B.meta.arm, bandIdx: B.meta.bandIdx } : null],
  ts: now,
};
const body = '/* fused ' + ARM + ' = ' + T + '*' + PA + ' + ' + (1 - T) + '*' + PB + '（tools/pack-fuse.mjs） */\n'
  + 'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n'
  + 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(fused) + ';\n';
writeFileSync(OUT, body, 'utf8');
console.log('✔ 融合完成 ' + OUT + '（t=' + T + '，A=' + widA.slice(0, 12) + ' × B=' + widB.slice(0, 12) + '，wid=' + widOf(body).slice(0, 16) + '）');
