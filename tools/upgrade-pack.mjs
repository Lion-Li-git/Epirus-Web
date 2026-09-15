/* 旧形状冠军包 → 嵌入 v7 容器（v1.5.63）。
 * 为什么需要：本仓库的线上 3P 包契约是 **v7 容器**（np-test N19 用 `checkPack` 卡 `o.v === PACK_VERSION`），
 * 而历史冠军（如 eco-34）是 v5/v6 形状 ⇒ 直接上线会被 N19 挡下。
 * 做法：原生读取（`unpack(j, true)`）⇒ `embedLegacy` 嵌入 v7（旧前缀逐位保留、新块零填）⇒ `pack` 出 v7 容器。
 * ⚠️ 注意：嵌入后 chooser 走 v7 候选口径，**历史分数未必逐位复现**（audit-lib 注释的原话）⇒
 *    上线前的体检必须在**嵌入后的包**上跑（那才是真正发出去的东西）。
 * 用法：node tools/upgrade-pack.mjs <旧包.bak> <新包.bak>
 */
import { sandbox } from './audit-lib.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const W = sandbox();
const Pol = W.EpirusPolicy;
const SRC = process.argv[2], OUT = process.argv[3];
if (!SRC || !OUT) { console.error('用法: node tools/upgrade-pack.mjs <旧包.bak> <新包.bak>'); process.exit(2); }
const src = readFileSync(SRC, 'utf8');
const champM = /(window\.EPIRUS_CHAMPION_3P\s*=\s*)(\{[\s\S]*?\})(\s*;)/.exec(src);
if (!champM) { console.error('⛔ 找不到 window.EPIRUS_CHAMPION_3P'); process.exit(3); }
const j = JSON.parse(champM[2]);
if (j.v === 7) { console.log('源包已是 v7（无需升级）：' + SRC); process.exit(0); }
const native = Pol.unpack(j, true);
if (!native || !native.length) { console.error('⛔ 原生读取失败'); process.exit(4); }
const embedded = Pol.embedLegacy(native);
const packed = Pol.pack(embedded);
const chk = Pol.checkPack(packed);
console.log('源 v' + j.v + ' = ' + native.length + ' 位 ⇒ 嵌入 v7 = ' + embedded.length + ' 位；checkPack=' + JSON.stringify(chk));
if (!chk.ok) { console.error('⛔ 嵌入后 checkPack 不过，中止'); process.exit(5); }
writeFileSync(OUT, src.replace(champM[0], champM[1] + JSON.stringify(packed) + ';'), 'utf8');
console.log('✅ 已写 ' + OUT);
