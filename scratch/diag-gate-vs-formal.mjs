#!/usr/bin/env node
/* diag-gate-vs-formal.mjs — 对账两个审计面（probe 门 vs skill-mastery 正式尺）在同一包上的分叉点 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
import { auditCells } from '../tools/proto2/skill-mastery.mjs';
import { readFileSync } from 'node:fs';

const PACK = process.argv[2] || 'scratch/arms/BIGT1-s7.bak';
const GAMES = Number(process.argv[3] || 12);

function runOnce(tag, W, params, ref) {
  const T = W.EpirusTrainer;
  const A = createArena2(W, { refParams: Float64Array.from(ref), temp: 0.15, wantEvents: 1 });
  const ch = T.policyChooserN(params, 0.15);
  const { cells } = auditCells(W, A, ch, [{ n: 3, table: 'long' }], GAMES, 101);
  const st = cells[0];
  console.log(tag, 'bigT uses =', st.okUses.bigT || 0, '/' + st.games, '局 ‖ ring', st.okUses.ring || 0, '‖ proto', st.okUses.proto || 0, '‖ gun', st.okUses.gun || 0);
  return st;
}

/* 面 A：probe 同款 —— env 安装（EPIRUS_ARCH2=1:input=obs3 → cfg {mutMode, input}），rngRef 同 probe 种子 */
{
  const W = sandbox();
  const refA = loadChamp(W, 'js/bundled-champion-3p.js');
  const A2 = installArch2(W, { mutMode: 'seg', input: 'obs3' });
  W.EpirusTrainer.mulberry32 && (A2.rngRef.r = W.EpirusTrainer.mulberry32((7 * 7919 + 13) >>> 0));
  const P = W.EpirusPolicy, T = W.EpirusTrainer;
  /* 读包参数：在已装好的面上直接 unpack（同 probe 内对候选参数的同款空间） */
  const srcTxt = readFileSync(PACK, 'utf8');
  const at = srcTxt.indexOf('EPIRUS_CHAMPION_3P ');
  const i = srcTxt.indexOf('{', at);
  let d = 0, st = false, esc = false, end = -1;
  for (let k = i; k < srcTxt.length; k++) { const c = srcTxt[k];
    if (st) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') st = false; continue; }
    if (c === '"') { st = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { end = k + 1; break; } } }
  const raw = JSON.parse(srcTxt.slice(i, end));
  const params = Float64Array.from(P.unpack(raw, true));
  console.log('面A paramCount =', P.paramCount(), '‖ params =', params.length, '‖ L.n =', A2.L.n, '‖ ctxDim', A2.L.ctxDim, 'actIn', A2.L.actIn, 'candIn', A2.L.candIn, 'seatIn', A2.L.seatIn);
  runOnce('面A（env 安装, rngRef=probe种子）:', W, params, refA);
}

/* 面 B：skill-mastery 同款 —— packCfgExit 重建 cfg 再 install，rngRef=4242 */
{
  const W = sandbox();
  const refB = loadChamp(W, 'js/bundled-champion-3p.js');
  const srcTxt = readFileSync(PACK, 'utf8');
  const at = srcTxt.indexOf('EPIRUS_CHAMPION_3P ');
  const i = srcTxt.indexOf('{', at);
  let d = 0, st = false, esc = false, end = -1;
  for (let k = i; k < srcTxt.length; k++) { const c = srcTxt[k];
    if (st) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') st = false; continue; }
    if (c === '"') { st = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { end = k + 1; break; } } }
  const raw = JSON.parse(srcTxt.slice(i, end));
  const got = packCfgExit(raw, PACK);
  const A2 = installArch2(W, got.cfg);
  if (W.EpirusPolicy.__arch2) W.EpirusPolicy.__arch2.rngRef.r = W.EpirusTrainer.mulberry32(4242);
  const params = Float64Array.from(W.EpirusPolicy.unpack(raw, true));
  console.log('面B paramCount =', W.EpirusPolicy.paramCount(), '‖ L.n =', A2.L.n, '‖ ctxDim', A2.L.ctxDim, 'actIn', A2.L.actIn, 'candIn', A2.L.candIn, 'seatIn', A2.L.seatIn, '‖ cfg =', JSON.stringify(got.cfg));
  runOnce('面B（packCfgExit, rngRef=4242）:', W, params, refB);
}
