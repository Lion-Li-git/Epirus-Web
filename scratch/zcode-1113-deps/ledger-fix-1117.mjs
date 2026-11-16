/* ledger-fix-1117.mjs —— 批1 管线打通的四项台账修复（一次性，跑完即退役）。
 *
 * ① batches.tsv 补登 b-f2-eps0-1113（7321 条 readings 孤儿引用的批行；ruler 已在册、源表在 scratch/zcode-1113-deps）
 * ② registry：MSB10 sha 过期重算同步 ‖ MSB12-seqboom 文件丢失转墓碑（a30f1098 先例：path 清空+archived-pack-meta）
 *    ‖ EFFG-s41 registry path/sha 对齐到池件（docs 件 cdeb=tracked 真值；scratch 件 21f5 权重漂移）
 * ③ lineage-g3：EFFG-s41 wid 21f5f4fee00f → cdeb5f7c18e336ba（与池件/registry 同权重）
 * ④ pool-members：EFFG-s41 note 补记修复依据
 * ⑤ promote.tsv：13 枚 staging blob 回填 + 12 枚老池成员从 pool.promoteVerdict 转录（均跳过已有行）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

const rd = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
const wr = (p, rows, CRLF = false) => {
  const nl = CRLF ? '\r\n' : '\n';
  writeFileSync(p, rows.map((r) => r.join('\t')).join('\n') + '\n'.replace('\n', nl), 'utf8');
};
const D = 'champion-map/data/';
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

/* ① batches 补登 */
const bt = rd(D + 'batches.tsv');
const bh = bt[0];
const bid = bh.indexOf('batch_id');
if (!bt.slice(1).some((r) => r[bid] === 'b-f2-eps0-1113')) {
  const row = bh.map(() => '');
  row[bh.indexOf('batch_id')] = 'b-f2-eps0-1113';
  row[bh.indexOf('ruler_id')] = 'b-f2-eps0-1113';
  row[bh.indexOf('axis')] = 'B';
  row[bh.indexOf('fixture')] = 'MSB11-R2S306293884+MSB10-R1S1149480262+MSB8-charge-R1S1861674281+Q-s47x1';
  row[bh.indexOf('champ')] = 'MSB11-R2S306293884+MSB10-R1S1149480262+MSB8-charge-R1S1861674281+Q-s47x1';
  row[bh.indexOf('run')] = '1113';
  row[bh.indexOf('source')] = 'scratch/zcode-1113-deps/exam4-F2-eps0-1113.tsv';
  row[bh.indexOf('rows')] = '915';
  row[bh.indexOf('created')] = '2026-11-13';
  row[bh.indexOf('note')] = '补登批行（validate 报 7321 条 readings 孤儿引用修复；ε=0 半边，ruler b-f2-eps0-1113 早已在册）';
  bt.push(row);
  wr(D + 'batches.tsv', bt);
  console.log('① batches.tsv +b-f2-eps0-1113');
} else console.log('① batches 已有 b-f2-eps0-1113，跳过');

/* ② registry 三修 */
const reg = rd(D + 'registry.tsv');
const rh = reg[0];
const iId = rh.indexOf('pack_id'), iPath = rh.indexOf('path'), iSha = rh.indexOf('sha256'), iStatus = rh.indexOf('status');
let regChanged = 0;
for (let i = 1; i < reg.length; i++) {
  const id = reg[i][iId];
  if (id === 'MSB10-R1S1149480262') {
    const got = sha('docs/artifacts/night-adapt/MSB10-R1S1149480262.js');
    if (reg[i][iSha] !== got) { reg[i][iSha] = got; regChanged++; console.log('② MSB10 sha256 同步 → ' + got.slice(0, 12)); }
  } else if (id === 'MSB12-seqboom-R1S1308870894') {
    if (reg[i][iPath]) {
      reg[i][iPath] = ''; reg[i][iStatus] = 'archived'; regChanged++;
      console.log('② MSB12 path 清空 + archived（文件丢失墓碑）');
    }
  } else if (id === 'EFFG-s41') {
    const np = 'docs/artifacts/2p0-pool/EFFG-s41.bak';
    const got = sha(np);
    if (reg[i][iPath] !== np || reg[i][iSha] !== got) { reg[i][iPath] = np; reg[i][iSha] = got; regChanged++; console.log('② EFFG-s41 registry 对齐池件 ' + got.slice(0, 12)); }
  }
}
if (regChanged) wr(D + 'registry.tsv', reg);

/* MSB12 archived-pack-meta 行 */
const APM = D + 'archived-pack-meta.tsv';
if (existsSync(APM)) {
  const apm = rd(APM);
  const ah = apm[0];
  if (!apm.slice(1).some((r) => r[ah.indexOf('pack_id')] === 'MSB12-seqboom-R1S1308870894')) {
    const lin = rd(D + 'page/lineage-g3.tsv');
    const lh = lin[0];
    const lr = lin.find((r) => r[lh.indexOf('id')] === 'MSB12-seqboom-R1S1308870894');
    const row = ah.map(() => '');
    row[ah.indexOf('pack_id')] = 'MSB12-seqboom-R1S1308870894';
    if (lr) { row[ah.indexOf('wid')] = lr[lh.indexOf('wid')] || ''; row[ah.indexOf('ts')] = lr[lh.indexOf('ts')] || ''; }
    row[ah.indexOf('meta_json')] = JSON.stringify({ note: '11-17 audit：registry 在册但文件丢失（docs/artifacts/night-adapt/MSB12-seqboom-R1S1308870894.js 不在盘上），按 a30f1098 先例转墓碑；wid/ts 取自 lineage-g3' });
    apm.push(row);
    wr(APM, apm);
    console.log('② archived-pack-meta +MSB12');
  }
}

/* ③④⑤ EFFG-s41 lineage/pool 对齐 */
const lin = rd(D + 'page/lineage-g3.tsv');
const lh = lin[0];
for (let i = 1; i < lin.length; i++) {
  if (lin[i][lh.indexOf('id')] === 'EFFG-s41' && lin[i][lh.indexOf('wid')] !== 'cdeb5f7c18e336ba') {
    lin[i][lh.indexOf('wid')] = 'cdeb5f7c18e336ba';
    wr(D + 'page/lineage-g3.tsv', lin);
    console.log('③ lineage EFFG-s41 wid → cdeb5f7c18e336ba');
  }
}
const pool = rd(D + 'page/pool-members.tsv');
const ph = pool[0];
for (let i = 1; i < pool.length; i++) {
  if (pool[i][ph.indexOf('id')] === 'EFFG-s41' && !pool[i][ph.indexOf('note')].includes('11-17 audit')) {
    pool[i][ph.indexOf('note')] += ' ‖ 11-17 audit：docs 池件(cdeb)为 tracked 真值，registry path/sha 与 lineage wid 已对齐（scratch/night5 件 21f5 权重漂移，不作身份）';
    wr(D + 'page/pool-members.tsv', pool);
    console.log('④ pool EFFG-s41 note 补记');
  }
}

/* ⑤ promote.tsv 回填 */
const promo = rd(D + 'page/promote.tsv');
const prh = promo[0];
const pId = prh.indexOf('id');
const have = new Set(promo.slice(1).map((r) => r[pId]).filter(Boolean));
const addRow = (id, verdict, blocks, g4, g5, holo) => {
  if (have.has(id)) return false;
  const row = prh.map(() => '');
  row[pId] = id; row[prh.indexOf('verdict')] = verdict; row[prh.indexOf('blocks')] = blocks;
  row[prh.indexOf('g4worst')] = g4 || ''; row[prh.indexOf('g5worst')] = g5 || ''; row[prh.indexOf('holoOther')] = holo || '';
  promo.push(row); have.add(id); return true;
};
let n5 = 0;
const blobs = readdirSync('champion-map/staging').filter((f) => f.endsWith('-audit.json'));
for (const f of blobs) {
  const id = f.replace(/-audit\.json$/, '');
  try {
    const j = JSON.parse(readFileSync('champion-map/staging/' + f, 'utf8'));
    const verdict = j.blocked ? 'block' : 'pass';
    const g4 = (j.classes || []).filter((c) => String(c.class || c.kind || '').includes('g4')).map((c) => c.worst ?? c.rate ?? '').join('/');
    const g5 = (j.classes || []).filter((c) => String(c.class || c.kind || '').includes('g5')).map((c) => c.worst ?? c.rate ?? '').join('/');
    if (addRow(id, verdict, j.count > 0 ? String(j.count) : '—', g4, g5, '')) n5++;
  } catch (e) { console.error('blob 解析失败 ' + f); }
}
const poolTranscribe = ['EFFG-s7', 'DDEF-s13', 'DEF-s13', 'DEF-s15', 'DEF-s16', 'COMBO-s13', 'STR-B-Q-s41', 'KDG-B-Q-s13', 'KD-G2', 'OBS6P4-S4000', 'OBS6E9', 'OBS6P9-S4000'];
for (const id of poolTranscribe) {
  const pr = pool.find((r) => r[ph.indexOf('id')] === id);
  if (!pr) continue;
  const v = pr[ph.indexOf('promoteVerdict')] || 'untested';
  if (addRow(id, v, '—', '', '', '')) n5++;
}
if (n5) wr(D + 'page/promote.tsv', promo);
console.log('⑤ promote.tsv +' + n5 + ' 行（blob ' + blobs.length + ' 枚扫描，池转录 ' + poolTranscribe.length + ' 枚）');
console.log('完成。');
