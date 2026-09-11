/* 把旧版（v5/f=122/len=3313）冠军包**无损升级**为当前版（v6/f=123/len=3337）。
 * 原理：v6 相对 v5 只多一维状态特征（"自己跨得过聚能环启动线"）。
 * 只要在 W1 的每一行对应位置**插入一个 0 权重**，该维对输出贡献恒为 0
 * → 网络行为与 v5 完全等价，但包形状变成 v6、游戏侧 checkPack 接受。
 * 用法：node tools/upgrade-pack.mjs <输入.bak> <输出.js> [变量名=EPIRUS_CHAMPION_3P]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const SRC = process.argv[2], DST = process.argv[3], VN = process.argv[4] || 'EPIRUS_CHAMPION_3P';
if (!SRC || !DST) { console.error('用法: node tools/upgrade-pack.mjs <in.bak> <out.js> [变量名]'); process.exit(2); }
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Float64Array, Date, window: {}, localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } } };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
const P = sb.window.EpirusPolicy, S = sb.window.EpirusState;
const srcTxt = readFileSync(SRC, 'utf8');
// .bak 可能是完整 JS bundle（含 META 行），也可能就是裸包 JSON —— 两种都支持
let pk = null;
const mv = srcTxt.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
if (mv) pk = JSON.parse(mv[1]);
else {
  const first = srcTxt.indexOf('{');
  const last = srcTxt.lastIndexOf('}');
  pk = JSON.parse(srcTxt.slice(first, last + 1));
}
console.log('输入: v=' + pk.v + ' f=' + pk.f + ' h=' + pk.h + ' len=' + pk.a.length);
if (pk.v === 6) { console.log('已是 v6，直接复制。'); writeFileSync(DST, srcTxt, 'utf8'); process.exit(0); }

/* 定位新增特征在状态特征里的下标：把 ringStreak 从 0 改到 3，唯一"由 1 变 0"的那一维 */
const mk = (rs) => { const st = S.createState('standard', { next: () => 0.5 }, 2); st.p[0].ep = 3; st.p[0].ringStreak = rs; return P.featuresV6(st, 0); };
const a = mk(0), b = mk(3);
let idx = -1;
for (let i = 0; i < a.length; i++) if (a[i] - b[i] > 0.5) { idx = i; break; }
if (idx < 0) { console.error('找不到新增特征下标'); process.exit(3); }
console.log('新增特征在状态特征中的下标 =', idx);

const HID = pk.h, A = pk.a, F5 = pk.f, F6 = P.FEAT_S, FA = P.FEAT_A;
const N5 = F5 + FA, N6 = F6 + FA;
const out = new Array(HID * N6 + HID + HID + 1).fill(0);
for (let j = 0; j < HID; j++) {
  const r5 = j * N5, r6 = j * N6;
  for (let i = 0; i < N5; i++) out[r6 + (i < idx ? i : i + 1)] = A[r5 + i];   // 状态特征在 idx 处插 0；动作特征整体后移
  out[r6 + idx] = 0;
}
const b1 = HID * N5, b1n = HID * N6;
for (let j = 0; j < HID; j++) out[b1n + j] = A[b1 + j];                       // b1
for (let j = 0; j < HID; j++) out[b1n + HID + j] = A[b1 + HID + j];           // W2
out[b1n + 2 * HID] = A[b1 + 2 * HID];                                         // b2
const pack = { v: 6, a: out, f: F6, h: HID };
console.log('输出: v=6 f=' + F6 + ' len=' + out.length + '  checkPack=' + JSON.stringify(P.checkPack(pack)));

/* 等价性自检：随机状态上比较「v5 原包(legacy 路径)」与「v6 新包」的 value */
const old5 = P.unpack(pk, true);
const st = S.createState('multi', { next: () => 0.5 }, 3);
st.p[0].ep = 5; st.p[0].ringStreak = 0; st.p[1].ep = 3;
let maxDiff = 0;
for (const k of [sb.window.EpirusRules.SK.JI, sb.window.EpirusRules.SK.GUN, sb.window.EpirusRules.SK.TANK, sb.window.EpirusRules.SK.RING]) {
  const d = Math.abs(P.value(st, 0, k, old5, P.shapeOf(old5)) - P.value(st, 0, k, P.unpack(pack)));
  if (d > maxDiff) maxDiff = d;
}
console.log('等价性自检 max|Δvalue| =', maxDiff.toExponential(3), maxDiff < 1e-9 ? '✓ 完全等价' : '✗ 不等价');
writeFileSync(DST,
  '/* Epirus 多人冠军（由 server/train-server.mjs / tools/upgrade-pack.mjs 生成）。只读数据，不要手改。 */\n' +
  'window.' + VN + '_META = ' + JSON.stringify({ source: 'tools/upgrade-pack.mjs', from: SRC, note: 'v5->v6 无损升级（新特征权重置 0）', ts: new Date().toISOString() }) + ';\n' +
  'window.' + VN + ' = ' + JSON.stringify(pack) + ';\n', 'utf8');
console.log('已写出 ' + DST);
