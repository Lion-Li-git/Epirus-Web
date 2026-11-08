/* 门禁覆盖审计（用户 11-08 晚令："图上有哪些没跑门禁的，进图的包至少要把相关门禁量一下"）
 * 读数源优先级：coords gen3 列（okShort/failsShort/okLong/failsLong）> 仓里历史 feas 分片
 *   （champion-map/feas-short-s*.tsv = all-multi 短桌 ‖ feas-long-s*.tsv = all-long 长桌 ‖
 *    feas-mixed-g3-1105.tsv = 混合 ‖ scratch 里近两天的 feas-*.tsv）
 * 产出：池 18 成员逐枚门禁状态 ‖ 全图未量清单（分 ver）‖ 两张补量 roster（id+path，path 必须在盘上）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const RD = f => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').filter(x => x !== '').map(l => l.split('\t'));
const MAP = 'champion-map/coords-gen3-1105.tsv';
const co = RD(MAP);
const H = Object.fromEntries(co[0].map((x, i) => [x, i]));
const rows = co.slice(1).map(r => ({
  id: r[H.id], ver: r[H.ver] || '', path: r[H.path] || '',
  okS: r[H.okShort] || '', fS: r[H.failsShort] || '', okL: r[H.okLong] || '', fL: r[H.failsLong] || '',
}));

/* 历史 feas 分片回收（同 id 多片 = 取文件序靠后的；每文件内有 legsMode 列就以它为准） */
const SRC = [
  'champion-map/feas-short-s1.tsv', 'champion-map/feas-short-s2.tsv', 'champion-map/feas-short-s3.tsv', 'champion-map/feas-short-s4.tsv',
  'champion-map/feas-long-s1.tsv', 'champion-map/feas-long-s2.tsv', 'champion-map/feas-long-s3.tsv', 'champion-map/feas-long-s4.tsv',
  'champion-map/feas-mixed-g3-1105.tsv',
  'scratch/night-adapt2/feas-multi.tsv', 'scratch/night-adapt2/feas-long.tsv',
  'scratch/night-adapt2/feas-pass2-multi.tsv', 'scratch/night-adapt2/feas-pass2-long.tsv',
  'scratch/night-adapt2/feas-s41-multi.tsv', 'scratch/night-adapt2/feas-s41-long.tsv',
  'scratch/ds-1108/gate3c-feas-multi.tsv', 'scratch/ds-1108/gate3c-feas-long.tsv',
  'scratch/ds-1108/k2-feas-multi.tsv', 'scratch/ds-1108/k2-feas-long.tsv',
];
const EXT = {};   /* id → {S:{ok,nFail,fails}, L:{...}, X:{...}} */
for (const f of SRC) {
  if (!existsSync(f)) continue;
  const t = RD(f);
  const hh = Object.fromEntries(t[0].map((x, i) => [x, i]));
  if (hh.id === undefined || hh.ok === undefined) continue;
  const lm = hh.legsMode !== undefined ? (t[1] ? (t[1][hh.legsMode] || '') : '') : 'X';
  for (const r of t.slice(1)) {
    const mode = lm === 'multi' ? 'S' : lm === 'long' ? 'L' : (hh.legsMode === undefined ? 'X' : lm === 'multi' ? 'S' : 'L');
    const m = lm === 'multi' ? 'S' : lm === 'long' ? 'L' : 'X';
    EXT[r[hh.id]] = EXT[r[hh.id]] || {};
    EXT[r[hh.id]][m] = { ok: r[hh.ok], nFail: r[hh.nFail] || '', fails: r[hh.fails] || '' };
  }
}
console.log('历史分片回收：' + Object.keys(EXT).length + ' 个 id（S=' + Object.values(EXT).filter(x => x.S).length + ' L=' + Object.values(EXT).filter(x => x.L).length + ' 混合=' + Object.values(EXT).filter(x => x.X).length + '）');

/* 池成员 */
const pm = RD('champion-map/pool-members.tsv');
const ph = Object.fromEntries(pm[0].map((x, i) => [x, i]));
const POOL = pm.slice(1).filter(r => r[ph.id]).map(r => ({ id: r[ph.id], tier: r[ph.tier], path: r[ph.path] }));

function statOf(r) {
  /* 返回 {S:'1/0/未量', L:..., nFail 合计}——coords 列优先，空则回历史分片 */
  const g = (own, ext) => own !== '' ? own : (ext !== undefined ? ext.ok : '');
  const nf = (ownF, ext, ownN) => ownF !== '' ? ownF : (ext !== undefined ? (ext.nFail || '') : '');
  const s = g(r.okS, (EXT[r.id] || {}).S), l = g(r.okL, (EXT[r.id] || {}).L);
  return {
    S: s === '' ? '未量' : s, L: l === '' ? '未量' : l,
    fS: nf(r.fS, (EXT[r.id] || {}).S), fL: nf(r.fL, (EXT[r.id] || {}).L),
  };
}

console.log('\n===== 池 18 成员门禁状态（用户口径：进池最多缺一门）=====');
for (const p of POOL) {
  const row = rows.find(x => x.id === p.id) || { id: p.id, okS: '', fS: '', okL: '', fL: '', path: p.path, ver: '2.0' };
  const st = statOf(row);
  const miss = (st.S === '未量' ? 1 : 0) + (st.L === '未量' ? 1 : 0);
  const fN = (st.fS === '' ? 0 : Number(st.fS) || 0) + (st.fL === '' ? 0 : Number(st.fL) || 0);
  console.log((miss ? '✗' : '✓') + ' ' + p.id.padEnd(20) + p.tier.padEnd(5)
    + ' 短=' + (st.S === '未量' ? '未量' : (st.S === '1' ? '过' : '缺' + st.fS + '门'))
    + ' ‖ 长=' + (st.L === '未量' ? '未量' : (st.L === '1' ? '过' : '缺' + st.fL + '门'))
    + (st.S !== '未量' && st.L !== '未量' ? ' ‖ 合计缺门 ' + fN : '  ← 补量'));
}

/* 全图 */
let both = 0, onlyOne = 0, none = 0;
const noneList = [];
for (const r of rows) {
  const st = statOf(r);
  const m = (st.S === '未量' ? 1 : 0) + (st.L === '未量' ? 1 : 0);
  if (m === 0) both++;
  else if (m === 1) onlyOne++;
  else { none++; noneList.push(r); }
}
console.log('\n===== 全图 893 枚 =====');
console.log('双桌都量过 ' + both + ' ‖ 只量了一张桌 ' + onlyOne + ' ‖ 两桌都没量 ' + none);
const byVer = {};
for (const r of noneList) { const v = r.ver || '(空)'; byVer[v] = (byVer[v] || 0) + 1; }
console.log('未量按 ver：' + JSON.stringify(byVer));
const noFile = noneList.filter(r => !existsSync(r.path));
console.log('未量且 path 已不在盘上：' + noFile.length + '（这些补不了，列名单）');

/* roster 落盘 */
function roster(f, list) {
  writeFileSync(f, 'id\tpath\n' + list.map(r => r.id + '\t' + r.path).join('\n') + '\n');
  console.log('roster → ' + f + '（' + list.length + ' 行）');
}
const poolSet = new Set(POOL.map(p => p.id));
roster('scratch/night-adapt2/roster-gates-pool.tsv', noneList.filter(r => poolSet.has(r.id)));
roster('scratch/night-adapt2/roster-gates-rest.tsv', noneList.filter(r => !poolSet.has(r.id) && existsSync(r.path)));
if (noFile.length) writeFileSync('scratch/night-adapt2/roster-gates-nofile.txt', noFile.map(r => r.id + '\t' + r.path).join('\n') + '\n');
process.exit(0);
