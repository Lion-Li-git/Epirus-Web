#!/usr/bin/env node
/* 全库重测 · 引擎纪元 120fca4d + 新轴 · 回填（ZCode · 11-14 夜6班）
 *  ① rulers.tsv 追加三根新尺（a-v2coop-page-1114 ‖ b-f5-page-1114 ‖ b-f5-eps0-1114；note 带引擎纪元+轴代语义）
 *  ② readings/current.tsv 追加 rows（键 = pack|ruler|cell|horizon，重复跑先查重）
 *  ③ EXAM-BATCHES.tsv 登记三批来源
 *  之后（本脚本不代做，按序人跑）：
 *    node champion-map/pipeline/rulers.mjs --set-current=b-f5-page-1114
 *    node champion-map/pipeline/rulers.mjs --set-current=b-f5-eps0-1114
 *    node champion-map/pipeline/rulers.mjs --set-current=a-v2coop-page-1114
 *    node champion-map/pipeline/build-view.mjs && node champion-map/rebuild-map.mjs
 * 用法：node scratch/zcode-1113-deps/ingest-1114.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const OUTDIR = 'scratch/zcode-1113-deps';
const F5 = 'MSB11-R2S306293884+MSB14-railgun-R1S175656469+WSEL9-200+MSB15R-HITMIX+GD6a-TILT x1'.replace(/ x1$/, 'x1');
const ENGINENOTE = '引擎纪元 120fca4d（3a32e551 结算规则修复）· seed/rounds 与旧批同（100/77000）⇒ 跨纪元可配对';
const RULERS = [
  { id: 'b-f5-page-1114', axis: 'B', label: 'F5 冠军夹具（page dose）· 风格互补五枚', fixture: F5,
    src: ['exam4-F5-page-1114.tsv', 'exam4-F5-page-1114-long.tsv'],
    note: ENGINENOTE + '；F5 = MSB11-R2(蓄爆锚)+MSB14(枪炮反击)+WSEL9-200(广度)+MSB15R-HITMIX(反墙)+GD6a-TILT(蒸馏三线)，替换旧 F2 三 charge 一杂（11-11 判风格偏置）· 用户 11-14 令「先调整好轴再跑重测」' },
  { id: 'b-f5-eps0-1114', axis: 'X', label: 'F5 冠军夹具（exam dose ε=0 贪心）· Δε 配对半边', fixture: F5,
    src: ['exam4-F5-eps0-1114.tsv', 'exam4-F5-eps0-1114-long.tsv'],
    note: ENGINENOTE + '；Δε = 页面剂量(b-f5-page-1114) − 考卷口径，同夹具同 seed 同 plan ⇒ 差值只剩剂量；viewer DE4 消费 X<c>R(L) 列' },
  { id: 'a-v2coop-page-1114', axis: 'A', label: 'v2 脚本桌 + 配合剧本局（page dose）', fixture: 'v2-scripts(28席)+coop(5本剧本×40局/格,n≥3)',
    src: ['exam4-A-coop-1114.tsv', 'exam4-A-coop-1114-long.tsv'],
    note: ENGINENOTE + '；A 轴新结构 = 原 28 席脚本轮**逐字保留** + 每格 n≥3 追加 40 局整队剧本（--coop=v3，exam-coop.mjs；用户点名：藤甲+坦克天火集火 ‖ 给攒大招的角色套盾）；n=2 无配合' },
];

const rd = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const parse = (L) => { const h = L[0].split('\t'); return L.slice(1).filter(Boolean).map(l => Object.fromEntries(l.split('\t').map((v, i) => [h[i], v]))); };

/* ① rulers.tsv */
{
  const L = rd('champion-map/data/rulers.tsv');
  const h = L[0].split('\t');
  const col = (k, d) => { const i = h.indexOf(k); return i < 0 ? d : i; };
  let added = 0;
  for (const R of RULERS) {
    if (L.some(l => l.split('\t')[0] === R.id)) { console.log('① rulers 已有 ' + R.id); continue; }
    const row = new Array(h.length).fill('');
    row[col('ruler_id')] = R.id;
    row[col('axis')] = R.axis;
    row[col('label')] = R.label;
    row[col('status')] = 'current';   /* set-current 时会把同轴旧 current 翻成 reference */
    row[col('unit')] = R.axis === 'X' ? 'excess' : 'excess';
    row[col('fixture')] = R.fixture;
    row[col('batch_id')] = R.id;
    row[col('formula')] = '';
    row[col('note')] = R.note;
    L.push(row.join('\t'));
    added++;
  }
  if (added && !DRY) writeFileSync('champion-map/data/rulers.tsv', L.join('\n') + '\n');
  console.log('① rulers + ' + added + ' 行');
}

/* ② readings/current.tsv */
{
  const L = rd('champion-map/data/readings/current.tsv');
  const h = L[0].split('\t');
  const ix = Object.fromEntries(h.map((x, i) => [x, i]));
  for (const c of ['pack_id', 'ruler_id', 'cell', 'horizon', 'value', 'n', 'batch_id']) if (ix[c] === undefined) throw new Error('readings 缺列 ' + c);
  const have = new Set(L.slice(1).map(l => { const f = l.split('\t'); return f[ix.pack_id] + '|' + f[ix.ruler_id] + '|' + f[ix.cell] + '|' + f[ix.horizon]; }));
  let add = 0, skip = 0, bad = 0;
  const lines = [];
  for (const R of RULERS) {
    for (const f of R.src) {
      const p = OUTDIR + '/' + f;
      if (!existsSync(p)) { console.log('⚠ 缺文件（该半批未跑完？）：' + p); continue; }
      for (const r of parse(rd(p))) {
        for (const c of [2, 3, 5, 8]) {
          const key = r.id + '|' + R.id + '|' + c + '|' + (f.includes('-long') ? 'long' : 'short');
          if (have.has(key)) { skip++; continue; }
          const v = r['x' + c], n = r['n' + c];
          if (v === '' || v === undefined || n === '' || n === undefined) { bad++; continue; }
          const row = new Array(h.length).fill('');
          row[ix.pack_id] = r.id; row[ix.ruler_id] = R.id; row[ix.cell] = String(c); row[ix.horizon] = f.includes('-long') ? 'long' : 'short';
          row[ix.value] = v; row[ix.n] = n; row[ix.batch_id] = R.id; row[ix.note] = '';
          lines.push(row.join('\t'));
          have.add(key); add++;
        }
      }
    }
  }
  if (bad) console.log('⚠ 缺 x/n 值的行 ' + bad + '（失败跑的空格——按失败清单重跑驱动后 re-ingest）');
  if (lines.length && !DRY) writeFileSync('champion-map/data/readings/current.tsv', L.concat(lines).join('\n') + '\n');
  console.log('② readings 追加 ' + add + ' 行（已有跳过 ' + skip + '）');
}

/* ③ EXAM-BATCHES.tsv */
{
  const L = rd('champion-map/EXAM-BATCHES.tsv');
  let added = 0;
  for (const R of RULERS) {
    if (L.some(l => l.includes(R.src[0]))) { console.log('③ EXAM-BATCHES 已登记 ' + R.id); continue; }
    const f0 = OUTDIR + '/' + R.src[0];
    const rows = existsSync(f0) ? rd(f0).length - 1 : 0;
    L.push([R.axis, R.axis === 'X' ? 'XR（Δε 配对半边）' : (R.axis === 'A' ? 'P5/P5L' : 'short(P5R)/long(P5RL)'), R.src.join(' ‖ '), '1114', R.fixture, String(rows), R.note.slice(0, 120)].join('\t'));
    added++;
  }
  if (added && !DRY) writeFileSync('champion-map/EXAM-BATCHES.tsv', L.join('\n') + '\n');
  console.log('③ EXAM-BATCHES + ' + added + ' 行');
}
console.log(DRY ? '（dry：没写盘）' : 'ingest 完成 ⇒ 依次：set-current ×3 → build-view → rebuild-map');
