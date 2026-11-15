/* grow-modebias-1116.mjs —— 把老布局 obs6 包"长"出 modeBias 段（obs6.5 第一刀的加载侧）。
 * 原理：modeBias 段追加在 policyHead 之后 ⇒ 旧段偏移逐位不变；新参数 = 旧参数 + 显式补零
 *（unpack 对短 a 会取 undefined ⇒ NaN，不许依赖隐式零）。META 原样保留（upstream 谱系不变）。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox } from '../../tools/audit-lib.mjs';

const W = sandbox();
const P = W.EpirusPolicy2;
const SRC = process.argv[2] || 'scratch/arms/OBS6-SHAPEDIST.bak';
const DST = process.argv[3] || SRC.replace(/\.bak$/, '-MB.bak');
const src = readFileSync(SRC, 'utf8');
const raw = JSON.parse(src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/)[1]);
const p = P.unpack(raw, W);
if (!p) { console.error('⛔ 源包解不出'); process.exit(2); }
const skills = W.EpirusRules.skills.length;   /* blob 顶层 skills 字段在部分容器里缺失（NaN 链源头）——以引擎 R.skills 为准 */
const modeKeys = ['standard', 'multi', 'multi4', 'long'];   // = Object.keys(R.MODES) 冻结序（11-16 实测）
const newDims = Object.assign({}, raw.dims, { modeBias: 1, modeKeys });
const newL = P.layoutOfPack({ dims: newDims }, skills);
if (!newL.modeBiasOn) { console.error('⛔ 新布局没带 modeBias 段（dims 透传失败）'); process.exit(2); }
const newP = new Float64Array(newL.n);
newP.set(p, 0);
for (let i = p.length; i < newL.n; i++) newP[i] = 0;   // 显式补零（unpack NaN 坑）
newP.p2 = newL;
const blob = P.pack(newP, W);
// 回读自证：unpack(new blob) 的前 p.length 个坐标必须与旧参数逐位相同（前缀布局不变的硬证明）
const back = P.unpack(blob, W);
let bad = 0;
for (let i = 0; i < p.length; i++) if (back[i] !== p[i]) bad++;
const tailZero = (() => { for (let i = p.length; i < newL.n; i++) if (back[i] !== 0) return false; return true; })();
if (bad || !tailZero) { console.error('⛔ 回读自证失败：坐标差 ' + bad + ' ‖ 尾段全零 ' + tailZero); process.exit(2); }
const out = src.replace(/window\.EPIRUS_CHAMPION_3P\s*=\s*\{[\s\S]*?\}\s*;/, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(blob) + ';');
writeFileSync(DST, out);
console.log('✔ ' + SRC + ' → ' + DST + ' ‖ 参数 ' + p.length + ' → ' + newL.n + '（modeBias 段 ' + (newL.n - p.length) + ' = skills ' + skills + ' × 模式 ' + modeKeys.length + '）‖ 回读自证：前缀逐位同 ‖ 尾段全零');
