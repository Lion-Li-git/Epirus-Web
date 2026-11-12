#!/usr/bin/env node
/* Δε ε=0 半边 · pilot 回填（ZCode · 11-13）：把 pilot 批写进数据模型 A。
 *  ① rulers.tsv 加 X 轴 current 尺行（b-f2-eps0-1113；Δε 配对半边 = b-f2-page-1111）
 *  ② readings/current.tsv 追加 24 枚 × 4 档 × 2 桌形（键 = pack|ruler|cell|horizon，重复跑先查重）
 *  ③ EXAM-BATCHES.tsv 登记批次来源（family X·R）
 * 用法：node scratch/zcode-1113-deps/eps0-ingest.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const RID = 'b-f2-eps0-1113';
const BATCH = 'b-f2-eps0-1113';
const FIXTURE = 'MSB11-R2S306293884+MSB10-R1S1149480262+MSB8-charge-R1S1861674281+Q-s47x1';

const rd = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const exam = rd('scratch/zcode-1113-deps/exam4-F2-eps0-1113.tsv');
const examL = rd('scratch/zcode-1113-deps/exam4-F2-eps0-long-1113.tsv');
const parse = (L) => { const h = L[0].split('\t'); return L.slice(1).filter(Boolean).map(l => Object.fromEntries(l.split('\t').map((v, i) => [h[i], v]))); };
const rows = parse(exam).map(r => ({ ...r, hor: 'short' })).concat(parse(examL).map(r => ({ ...r, hor: 'long' })));
console.log('pilot 行数：short ' + parse(exam).length + ' ‖ long ' + parse(examL).length);

/* ① rulers.tsv */
{
  const L = rd('champion-map/data/rulers.tsv');
  if (L.some(l => l.split('\t')[0] === RID)) console.log('① rulers 已有 ' + RID);
  else {
    const h = L[0].split('\t');
    const col = (k, d) => { const i = h.indexOf(k); return i < 0 ? d : i; };
    const row = new Array(h.length).fill('');
    row[col('ruler_id')] = RID;
    row[col('axis')] = 'X';
    row[col('label')] = 'F2 冠军夹具（exam dose ε=0 贪心）';
    row[col('status')] = 'current';
    row[col('unit')] = 'excess';
    row[col('fixture')] = FIXTURE;
    row[col('batch_id')] = BATCH;
    row[col('formula')] = '';
    row[col('note')] = 'Δε ε=0 半边（11-13 用户令「Δε 全没了…测试写进去」；页面剂量半边 = b-f2-page-1111，同夹具同 seed 同 plan ⇒ 差值只剩剂量）；viewer DE4 消费 X<c>R(L) 列';
    L.push(row.join('\t'));
    if (!DRY) writeFileSync('champion-map/data/rulers.tsv', L.join('\n') + '\n');
    console.log('① rulers.tsv +1 行（axis X）');
  }
}

/* ② readings/current.tsv */
{
  const L = rd('champion-map/data/readings/current.tsv');
  const h = L[0].split('\t');
  const ix = Object.fromEntries(h.map((x, i) => [x, i]));
  const have = new Set(L.slice(1).map(l => l.split('\t')[ix.pack_id] + '|' + l.split('\t')[ix.ruler_id] + '|' + l.split('\t')[ix.cell] + '|' + l.split('\t')[ix.horizon]));
  const add = [];
  for (const r of rows) {
    for (const c of [2, 3, 5, 8]) {
      const key = r.id + '|' + RID + '|' + c + '|' + r.hor;
      if (have.has(key)) continue;
      const v = r['x' + c], n = r['n' + c];
      if (v === '' || v === undefined || n === '' || n === undefined) throw new Error('pilot 行缺 x' + c + '/n' + c + '：' + r.id + ' ' + r.hor);
      const row = new Array(h.length).fill('');
      row[ix.pack_id] = r.id; row[ix.ruler_id] = RID; row[ix.cell] = String(c); row[ix.horizon] = r.hor;
      row[ix.value] = v; row[ix.n] = n; row[ix.batch_id] = BATCH; row[ix.note] = '';
      add.push(row.join('\t'));
    }
  }
  console.log('② readings 追加 ' + add.length + ' 行（pilot ' + rows.length + ' 行 × 4 档，已有 ' + (rows.length * 4 - add.length) + '）');
  if (add.length && !DRY) writeFileSync('champion-map/data/readings/current.tsv', L.concat(add).join('\n') + '\n');
}

/* ③ EXAM-BATCHES.tsv */
{
  const L = rd('champion-map/EXAM-BATCHES.tsv');
  if (L.some(l => l.includes('exam4-F2-eps0-1113'))) console.log('③ EXAM-BATCHES 已登记');
  else {
    L.push(['X', 'XR（Δε ε=0 半边）', 'exam4-F2-eps0-1113(.tsv|-long) pilot', '1113', FIXTURE, String(parse(exam).length), 'pilot 24 枚（registry 分层抽样）；全量 926 枚批排晚班'].join('\t'));
    if (!DRY) writeFileSync('champion-map/EXAM-BATCHES.tsv', L.join('\n') + '\n');
    console.log('③ EXAM-BATCHES +1 行');
  }
}
console.log(DRY ? '（dry：没写盘）' : 'ingest 完成 ⇒ 下一步 node champion-map/rebuild-map.mjs');
