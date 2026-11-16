/* grow-modebias-nmode.mjs —— 给已有 obs6.5 包追加 '2:long' 独立 modeBias 行（2026-11-16）。
 * 原理：modeBias 段在 policyHead 之后，行按 modeKeys 冻结序存放；在末尾追加一行 = 旧坐标逐位不变 + 30 个零。
 * 缺省：<src> → <src 去 .bak>-2L.bak；只接 dims.modeBias=1 且尚无 '2:long' 的包。
 * 自证：unpack(new blob) 的前 p.length 个坐标与旧包逐位相同；尾段 30 全零。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox } from '../../tools/audit-lib.mjs';

const W = sandbox();
const P = W.EpirusPolicy2;
const SRC = process.argv[2] || '';
const DST = process.argv[3] || (SRC ? SRC.replace(/\.bak$/, '-2L.bak') : '');
if (!SRC || !DST) { console.error('用法：node training/proto2/grow-modebias-nmode.mjs <src.bak> [dst.bak]'); process.exit(2); }
const src = readFileSync(SRC, 'utf8');
const raw = JSON.parse(src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
const oldKeys = Array.isArray(raw.dims && raw.dims.modeKeys) ? raw.dims.modeKeys.slice() : [];
if (Number(raw.dims && raw.dims.modeBias) !== 1 || !oldKeys.length) { console.error('⛔ 源包没有 modeBias 段；obs6 包请先用 grow-modebias-1116.mjs'); process.exit(2); }
if (oldKeys.indexOf('2:long') >= 0) { console.error('⛔ 源包已有 2:long 行：' + oldKeys.join(',')); process.exit(2); }
if (oldKeys.join(',') !== 'standard,multi,multi4,long') { console.error('⛔ 只接 canonical 4 行（standard,multi,multi4,long），收到：' + oldKeys.join(',')); process.exit(2); }
const p = P.unpack(raw, W);
if (!p) { console.error('⛔ 源包解不出'); process.exit(2); }
const skills = W.EpirusRules.skills.length;
const newKeys = oldKeys.concat('2:long');
const newDims = Object.assign({}, raw.dims, { modeBias: 1, modeKeys: newKeys });
const newL = P.layoutOfPack({ dims: newDims }, skills);
if (!newL.modeBiasOn) { console.error('⛔ 新布局没带 modeBias 段'); process.exit(2); }
const newP = new Float64Array(newL.n);
newP.set(p, 0);
for (let i = p.length; i < newL.n; i++) newP[i] = 0;
newP.p2 = newL;
const blob = P.pack(newP, W);
const back = P.unpack(blob, W);
let bad = 0;
for (let i = 0; i < p.length; i++) if (back[i] !== p[i]) bad++;
let tailBad = 0;
for (let i = p.length; i < newL.n; i++) if (back[i] !== 0) tailBad++;
if (bad || tailBad) { console.error('⛔ 回读自证失败：前缀差 ' + bad + ' ‖ 尾段非零 ' + tailBad); process.exit(2); }
const out = src.replace(/window\.EPIRUS_CHAMPION_3P\s*=\s*\{[\s\S]*?\}\s*;/, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(blob) + ';');
writeFileSync(DST, out);
console.log('✔ ' + SRC + ' → ' + DST + ' ‖ 参数 ' + p.length + ' → ' + newL.n + '（+ ' + skills + ' = 2:long 行）‖ 前缀逐位同 ‖ 尾段全零');
console.log('  modeKeys：' + newKeys.join(','));
