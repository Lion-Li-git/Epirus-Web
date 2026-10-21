#!/usr/bin/env node
/* §E677 把**全腿短程**那道闸的判定挂进 `coords.tsv` ⇒ 图上的环终于有两把"纯桌"的可选主语。
 *
 * 为什么要有这一列（用户 2026-10-21 裁「既然过线分成两种了，那就改成纯短程和纯长程两种，不要留混合桌环」）：
 *   在册那把 `feasibilityOf` 是**混合桌**（G主判/座位/场A/场B = multi ‖ G2/反弹墙/密度/蓄能 = long），
 *   而 `okLong`（§E616）是"把剩下 4 条腿也搬上 long"。所以今天盘上从来没有"纯短程过不过"这个读数 ——
 *   要按桌形各画一圈环，就得把 `feas.mjs --allMulti=1` 那批分片表接进来。
 *
 * 只加**两列**（`okShort` ‖ `failsShort`）：
 *   考卷/页面/势那三列（`Hlong/Hplong/Flong`）是长程专属的配对读数，短程侧的对应物本来就是在册的
 *   `Hp/F`（`attach-hp.mjs` 量在默认桌上）⇒ 这里不重复挂、更不改名（METHODOLOGY：换尺另起一列，
 *   不许偷走历史读数的名字）。
 *
 * 判据（与 `attach-hlong.mjs` §E616 那半段同形）：
 *   ① **不许把"没量到"写成 0**（R8）：分片表里没有这枚 ⇒ 写 `-`，查看器读 `-` 走"未测"，不当"没过"。
 *   ② **读错表 = 把两套腿表混成一张**：每行 `legsMode` 必须以 `all-multi` 开头，否则整批拒绝 exit 2。
 *   ③ 覆盖报数：量到 N ‖ 没量到 M（点名前 8 枚）+ 过/不过各几枚 —— 覆盖率本身是要给用户看的数。
 *   ④ 幂等：列已存在则原地回写，不重复加列。
 *
 * 用法：node champion-map/attach-hshort.mjs [--check]
 *   先跑：node champion-map/feas.mjs --allMulti=1 --shard=k/4 --out=feas-short-sK.tsv   （k=1..4）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const rd = f => readFileSync(join(HERE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const CHECK = process.argv.includes('--check');

const OKS = {};
{ const files = ['feas-short-s1.tsv', 'feas-short-s2.tsv', 'feas-short-s3.tsv', 'feas-short-s4.tsv'].filter(f => existsSync(join(HERE, f)));
  if (!files.length) { console.error('⛔ 没找到 feas-short-s*.tsv ⇒ 先跑 feas.mjs --allMulti=1 --shard=k/4 --out=feas-short-sK.tsv'); process.exit(2); }
  for (const f of files) {
    const F = rd(f), fh = Object.fromEntries(F[0].map((x, i) => [x, i]));
    if (fh.ok === undefined || fh.legsMode === undefined) { console.error('⛔ ' + f + ' 缺 `ok` 或 `legsMode` 列 ⇒ 不敢挂（三套腿表会混成一列）'); process.exit(2); }
    for (const r of F.slice(1)) {
      if (!r[fh.id]) continue;
      if (!/^all-multi/.test(String(r[fh.legsMode] || ''))) { console.error('⛔ ' + f + ' 里有行的 legsMode 不是 all-multi：' + r[fh.id] + ' ⇒ 这张表不是全腿短程那批'); process.exit(2); }
      const prev = OKS[r[fh.id]];
      if (prev !== undefined && prev.ok !== (r[fh.ok] === '1' ? 1 : (r[fh.ok] === '0' ? 0 : null))) {
        console.error('⛔ 同一枚在两片里判定相反：' + r[fh.id] + '（' + prev.ok + ' vs ' + r[fh.ok] + '）⇒ 分片重叠，不敢合并'); process.exit(2); }
      OKS[r[fh.id]] = { ok: r[fh.ok] === '1' ? 1 : (r[fh.ok] === '0' ? 0 : null), fails: String(r[fh.fails] || '').slice(0, 120) };
    } } }

const CO = rd('coords.tsv'), ch = Object.fromEntries(CO[0].map((x, i) => [x, i]));
const COLS = ['okShort', 'failsShort'];
let idx = COLS.map(c => ch[c]);
if (idx.some(x => x === undefined)) {
  if (CHECK) { console.error('⛔ coords.tsv 还没有这两列 ⇒ 先不带 --check 跑一次'); process.exit(2); }
  const at = CO[0].length;
  CO[0] = CO[0].concat(COLS);
  for (let i = 1; i < CO.length; i++) while (CO[i].length < at) CO[i].push('');
  idx = COLS.map((c, k) => at + k);
}
let nHit = 0, nOk = 0, miss = [];
for (let i = 1; i < CO.length; i++) {
  const r = CO[i], id = r[ch.id]; if (!id) continue;
  const e = OKS[id];
  if (!e) { r[idx[0]] = '-'; r[idx[1]] = ''; miss.push(id); continue; }
  r[idx[0]] = e.ok === null ? '-' : String(e.ok);
  r[idx[1]] = e.fails;
  nHit++; if (e.ok === 1) nOk++;
}
const srcIds = Object.keys(OKS), orphan = srcIds.filter(k => !CO.slice(1).some(r => r[ch.id] === k));
if (CHECK) {
  if (miss.length) { console.error('⛔ --check：有 ' + miss.length + ' 枚coords 行没有全腿短程判定（前 8：' + miss.slice(0, 8).join(' ') + '）'); process.exit(2); }
  console.log('--check ✅ 全 ' + (CO.length - 1) + ' 行都有 okShort');
  process.exit(0);
}
writeFileSync(join(HERE, 'coords.tsv'), CO.map(r => r.join('\t')).join('\n') + '\n');
console.log('coords.tsv 列数 ' + CO[0].length + ' ‖ 挂上 ' + nHit + '/' + (CO.length - 1) + ' 枚 ⇒ 全腿短程过 ' + nOk + ' ‖ 不过 ' + (nHit - nOk));
if (miss.length) console.log('⚠ 没量到 ' + miss.length + ' 枚（写 `-`，不是 0）：' + miss.slice(0, 8).join(' ') + (miss.length > 8 ? ' …' : ''));
if (orphan.length) console.log('⚠ 分片表里有 ' + orphan.length + ' 枚不在 coords 名单上（前 8：' + orphan.slice(0, 8).join(' ') + '）⇒ 图上看不见它们');
