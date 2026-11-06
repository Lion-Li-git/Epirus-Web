#!/usr/bin/env node
/* gate-resplit.mjs —— 把一个门禁**部分文件**按语义族切成几个部分文件（10-20 夜班为 #51 写的）。
 *
 * 为什么要有它（DS 在 CI-WALLCLOCK §五.3 的原话）：「别手工搬门体 —— 部分文件的门体是按 ranges 切成
 *   连续源码段的，手工挪极易切坏」。所以这里只做三件事：按 `^t(` 切块、按族重排、**逐字节自证没搬坏**。
 *
 * 用法：
 *   node tools/gate-resplit.mjs --from=train-runner --map=docs/research/archive/.../families.json [--write]
 *   map 的格式：{ "train-pick": ["D221","D176",...], "train-breadth": [...], ... }   （键 = 门号，值 = 新部分名）
 *   默认 **dry-run**（只打印计划与自证结果）；`--write` 才落盘。
 *
 * 自证（任一不过 ⇒ 拒绝落盘，exit 3）：
 *   ① 每个族里的门都必须真的在源文件里（拼错/搬走两条腿都当场报）；
 *   ② 所有族的并集必须**正好等于**源文件里的全部门（不许漏一条、不许重）；
 *   ③ 拼回去的门体与源文件里的门体**逐字节相同**（顺序也按原始序 ⇒ 搬动只改归属，不改一个字节）；
 *   ④ 头里的 `ords` 与 `gates` 与 `^t(` 的块数三者必须一致（np-test 的注册守卫按这个数投票）。
 * ⚠ 本脚本**不动** `tools/np-test.mjs`（import / PARTS / GRP / 归属表 MAP_RULES 要人改）——
 *   它只保证"门体搬干净"，注册面漏了会被 `tools/gate-parts-check.mjs` 的 ①/④ 当场抓住。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rejectUnknownFlags } from './audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const GATE_DIR = join(HERE, 'gates');
const argv = process.argv.slice(2);
/* 仓规（D218 那一族）：不认识的 `--` 参数必须响亮失败 ⇒ 这台工具只认这三个 */
rejectUnknownFlags(argv, ['from', 'map', 'write'], 'gate-resplit');
const arg = (k, d) => { const a = argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => argv.indexOf('--' + k) >= 0;

const FROM = arg('from', '');
const MAPF = arg('map', '');
if (!FROM || !MAPF) { console.error('用法：--from=<部分名> --map=<json 路径> [--write]'); process.exit(3); }
const SRC = join(GATE_DIR, FROM + '.mjs');
if (!existsSync(SRC)) { console.error('⛔ 源部分文件不存在：' + SRC); process.exit(3); }
const fam = JSON.parse(readFileSync(resolve(ROOT, MAPF), 'utf8'));

const src = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n').split('\n');
const HL = src.findIndex(l => l === '/*#np-part-header');
const HE = src.findIndex(l => l === '#np-part-header-end*/');
if (HL < 0 || HE < 0) { console.error('⛔ 找不到 `#np-part-header` 块 ⇒ 这不是部分文件，不敢动'); process.exit(3); }
const header = JSON.parse(src[HL + 1]);
const preamble = src.slice(HE + 1).join('\n');                       // 头之后的一切（import + const{...} + ords + register 开）
const ordLine = /export const ords = \[([\d,\s]*)\];/.exec(preamble);
if (!ordLine) { console.error('⛔ 前导里找不到 `export const ords = [...]`'); process.exit(3); }
const ords = ordLine[1].split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n));

/* 门体块：与 np-test.mjs:205-211 的 gatesOf **同一把尺**（^t( 行是块首，下一块前一行是块尾） */
const regOpen = preamble.indexOf('export function register(t) {');
if (regOpen < 0) { console.error('⛔ 前导里没有 `export function register(t) {`'); process.exit(3); }
const pre = preamble.slice(0, regOpen + 'export function register(t) {'.length);
const bodyStart = HE + 1 + preamble.slice(0, regOpen).split('\n').length;   // 门体第一行在 src 里的下标
let tailIdx = src.length - 1;
while (tailIdx > bodyStart && src[tailIdx].trim() === '') tailIdx--;         // 末尾空行
const closer = src[tailIdx];
if (closer.trim() !== '}') { console.error('⛔ 文件末尾不是 register 的收尾花括号，实测：' + JSON.stringify(closer)); process.exit(3); }

const marks = [];
for (let i = bodyStart; i < tailIdx; i++) if (/^t\(/.test(src[i])) marks.push(i);
const blocks = marks.map(function (a, k) {
  const b = k + 1 < marks.length ? marks[k + 1] - 1 : tailIdx - 1;
  return { ord: ords[k], key: (/^t\('(\w+)/.exec(src[a]) || [])[1], text: src.slice(a, b + 1).join('\n') };
});

/* ---- 自证 ④：块数 == ords 数 == header.gates 数 ---- */
const errs = [];
if (blocks.length !== ords.length) errs.push('块数 ' + blocks.length + ' ≠ ords 数 ' + ords.length);
if (header.gates && blocks.length !== header.gates.length) errs.push('块数 ' + blocks.length + ' ≠ header.gates 数 ' + header.gates.length);

/* ---- 自证 ①②：族的并集 == 全部门，一个不多一个不少 ---- */
const assigned = new Map();
for (const part in fam) for (const k of fam[part]) {
  if (assigned.has(k)) errs.push('门 ' + k + ' 被分到两个族：' + assigned.get(k) + ' 与 ' + part);
  assigned.set(k, part);
}
for (const b of blocks) if (!assigned.has(b.key)) errs.push('族表里没有门 ' + b.key + '（会**静默丢掉**一条门）');
for (const k of assigned.keys()) if (!blocks.some(b => b.key === k)) errs.push('族表里的门 ' + k + ' 不在 ' + FROM + ' 里（拼错或已被搬走）');

/* ---- 自证 ③：按族切完再按原始顺序拼回来，必须逐字节等于原门体 ---- */
const out = {};
for (const part in fam) out[part] = [];
for (const b of blocks) if (assigned.has(b.key)) out[assigned.get(b.key)].push(b);
const rebuilt = [];
for (const part in fam) for (const b of out[part]) rebuilt.push(b);
rebuilt.sort((a, b) => blocks.indexOf(a) - blocks.indexOf(b));
if (rebuilt.map(x => x.text).join('\n') !== blocks.map(x => x.text).join('\n')) errs.push('拼回来的门体与原文**不逐字相同** ⇒ 拒绝落盘');

console.log('源：' + FROM + '.mjs ‖ 门体块 ' + blocks.length + ' ‖ ords ' + ords.length + ' ‖ 族表 ' + Object.keys(fam).length + ' 个部分');
for (const part in fam) {
  const g = out[part];
  console.log('  ' + part.padEnd(16) + ' ' + String(g.length).padStart(3) + ' 条 ‖ 首 ords=' + (g[0] ? g[0].ord : '—')
    + ' ‖ ' + g.map(x => x.key).join(' '));
}
if (errs.length) {
  console.error('\n⛔ 自证没过（' + errs.length + ' 条）：');
  for (const e of errs.slice(0, 20)) console.error('   · ' + e);
  process.exit(3);
}
console.log('✔ 四条自证全过（族并集 = 全部 ‖ 门体逐字节不变 ‖ 块数/ords/header 一致）');
if (!flag('write')) { console.log('（dry-run ⇒ 没写任何文件；要落盘加 --write）'); process.exit(0); }

/* ---- 落盘：每个族一个部分文件；ranges 按该族门的原始段重算（纯出处记录，没有代码消费它） ---- */
for (const part in fam) {
  const g = out[part];
  if (!g.length) { console.error('⛔ 族 ' + part + ' 是空的 ⇒ 不写（空部分会被并集守卫判红）'); process.exit(3); }
  const keep = new Set(g.map(x => x.ord));
  const ranges = (header.ranges || []).map(function (rg) {
    const inside = g.filter(x => x.ord >= rg[0] && x.ord <= rg[1]).map(x => x.ord).sort((a, b) => a - b);
    if (!inside.length) return null;
    const endOf = (o) => { const rg2 = header.ranges.find(z => o >= z[0] && o <= z[1]); return rg2 ? rg2[1] : rg[1]; };
    return [inside[0], endOf(inside[inside.length - 1])];
  }).filter(Boolean);
  const hd = { file: 'tools/gates/' + part + '.mjs', part: part, group: header.group, ranges: ranges,
    gates: g.map(x => x.ord), patched: (header.patched || []).filter(o => keep.has(o)) };
  const newPre = pre.replace(/export const ords = \[[\d,\s]*\];/, 'export const ords = [' + g.map(x => x.ord).join(', ') + '];');
  const text = '/*#np-part-header\n' + JSON.stringify(hd) + '\n#np-part-header-end*/\n'
    + newPre + '\n' + g.map(x => x.text).join('\n') + '\n}\n';
  writeFileSync(join(GATE_DIR, part + '.mjs'), text, 'utf8');
  console.log('已写 tools/gates/' + part + '.mjs（' + g.length + ' 条 ‖ ' + text.split('\n').length + ' 行）');
}
console.log('\n下一步（人来做，脚本故意不碰）：');
console.log('  1) 删掉源文件 tools/gates/' + FROM + '.mjs（或保留成其中一个族）');
console.log('  2) 改 tools/np-test.mjs：import ‖ PARTS ‖ GRP.train ‖ 归属表 MAP_RULES（给每个新族一条 sig 规则列它的门号）');
console.log('  3) node tools/gate-parts-check.mjs   ‖   每个新部分单跑一遍');
