#!/usr/bin/env node
/* fix-restored-meta.mjs —— 恢复件收尾三件套（CI 红修复）
 * ① 冗余 e370-out 原件副本（wid 组多员）挪仓外隔离 + dupes-manifest 登记 move 行（循环至 unregistered=0）
 * ② 恢复件 META.ts 重写回 lineage 原值（父边时间倒挂修复）
 * ③ registry sha256 对翻账行同步
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { packArr, widOfArr, parseMeta } from '../champion-map/pack-id.mjs';

const ROOT = process.cwd();
const QROOT = 'D:/code/Epirus-Web-artifacts-quarantine/cleanup-2026-11-20';

function auditJson() {
  const r = spawnSync(process.execPath, ['tools/dedupe-artifacts.mjs', '--audit'], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 600000 });
  const line = String(r.stdout || '').split('\n').filter((l) => /^\{/.test(l)).pop();
  return line ? JSON.parse(line) : null;
}

/* ---- ① 冗余副本挪隔离 ---- */
let moved = 0;
for (let round = 0; round < 6; round++) {
  const A = auditJson();
  if (!A) { console.error('⛔ audit 无输出'); process.exit(1); }
  const targets = (A.unregPaths || []).filter((p) => p.startsWith('docs/artifacts/e370-out/') && /\/[0-9a-f]{8}\.js$/.test(p));
  if (!targets.length) { console.log('① 未登记重复 =', A.unregistered, '（e370-out 冗余已清）'); break; }
  const MAN = join(ROOT, 'champion-map/dupes-manifest.tsv');
  const manText = readFileSync(MAN, 'utf8');
  const manLines = manText.replace(/\n+$/, '').split('\n');
  const head = manLines[0].split('\t');
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const rel2row = new Map();
  for (const l of manLines.slice(1)) { const c = l.split('\t'); if (c[ix.path]) rel2row.set(c[ix.path], c); }
  for (const rel of targets) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) continue;
    const wid = widOfArr(packArr(readFileSync(src, 'utf8')));
    /* 找组里另一位当 canonical（audit worst 有配对；找不到就查 registry） */
    const pair = (A.worst || []).find((w) => (w.e || []).some((e) => e === rel));
    let canon = '';
    if (pair && pair.e) canon = pair.e.find((e) => e !== rel) || '';
    if (!canon) {
      const reg = readFileSync(join(ROOT, 'champion-map/data/registry.tsv'), 'utf8').split('\n');
      for (const l of reg.slice(1)) { const c = l.split('\t'); if (c[7] === wid && c[1] && c[1] !== rel) { canon = c[1]; break; } }
    }
    const dest = join(QROOT, rel);
    mkdirSync(dirname(dest), { recursive: true });
    renameSync(src, dest);
    const row = [wid, 'move', rel, canon || rel, '', '0', 'disk', dest.replace(/\\/g, '/')];
    manLines.push(row.join('\t'));
    moved++;
    console.log('  ① 挪', rel, '→', dest.replace(/\\/g, '/'), '（canonical=' + (canon || '?') + '）');
  }
  writeFileSync(MAN, manLines.join('\n') + '\n');
}
console.log('① 共挪', moved, '件');

/* ---- ② META.ts 重写回 lineage 原值 ---- */
const lin = {};
{
  const L = readFileSync(join(ROOT, 'champion-map/data/page/lineage.tsv'), 'utf8').split('\n');
  L.slice(1).forEach((l) => { const c = l.split('\t'); if (c.length >= 10) lin[c[0]] = { ts: c[3], wid: c[9] }; });
}
/* 恢复件清单：id → 路径（ledger 语义） */
const RESTORED = [];
{
  const led = {};
  readFileSync(join(ROOT, 'docs/ARTIFACT-LOSS-1119.tsv'), 'utf8').split('\n').slice(1).forEach((l) => {
    const c = l.split('\t');
    if (c.length >= 4 && (c[2] === 'ok')) led[c[0]] = c[1];
  });
  const reg = {};
  readFileSync(join(ROOT, 'champion-map/data/registry.tsv'), 'utf8').split('\n').slice(1).forEach((l) => {
    const c = l.split('\t');
    if (c.length >= 9) reg[c[0]] = c[1];
  });
  /* 今晨恢复的 id（SLOT 16 + 面板 3 + B 家族已落账的） */
  const IDS = Object.keys(led);
  for (const id of IDS) {
    const p = led[id] || reg[id];
    if (p && existsSync(join(ROOT, p))) RESTORED.push([id, p]);
  }
}
let tsFixed = 0;
const shaUpdates = [];
for (const [id, rel] of RESTORED) {
  const p = join(ROOT, rel);
  const txt = readFileSync(p, 'utf8');
  const wantTs = lin[id] ? lin[id].ts : '';
  const m = /"ts":"(20\d\d-\d\d-\d\dT[^"]+)"/.exec(txt);
  if (!m || !wantTs) continue;
  if (m[1].slice(0, 16) === wantTs.slice(0, 16)) { shaUpdates.push([id, rel]); continue; }
  const fixed = txt.slice(0, m.index) + '"ts":"' + wantTs + '"' + txt.slice(m.index + m[0].length);
  writeFileSync(p, fixed);
  tsFixed++;
  shaUpdates.push([id, rel]);
  console.log('  ②', id, 'ts', m[1], '→', wantTs);
}
console.log('② ts 重写', tsFixed, '件（清单', RESTORED.length, '）');

/* ---- ③ registry sha256 同步 ---- */
const regP = join(ROOT, 'champion-map/data/registry.tsv');
const regLines = readFileSync(regP, 'utf8').replace(/\n+$/, '').split('\n');
const rh = regLines[0].split('\t');
const rix = Object.fromEntries(rh.map((h, i) => [h, i]));
let nSha = 0;
for (const [id, rel] of shaUpdates) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) continue;
  const sha = createHash('sha256').update(readFileSync(p)).digest('hex');
  for (let i = 1; i < regLines.length; i++) {
    const c = regLines[i].split('\t');
    if (c[rix.pack_id] === id && c[rix.path] === rel) {
      if (c[rix.sha256] !== sha) { c[rix.sha256] = sha; regLines[i] = c.join('\t'); nSha++; }
      break;
    }
  }
}
writeFileSync(regP, regLines.join('\n') + '\n');
console.log('③ registry sha 同步', nSha, '行');
