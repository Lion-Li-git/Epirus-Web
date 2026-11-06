/* 摘除重复的 EPIRUS_POOL_OPP 旋钮（在册 EPIRUS_POOL_OPPS 顶上；MIXHP 保留）
 * ZCode 11-07 凌晨 · 用 indexOf 跨度做，不用正则。 */
import { readFileSync, writeFileSync } from 'node:fs';

// 1) evo.js
let e = readFileSync('js/train/evo.js', 'utf8');
{
  const s1 = e.indexOf('  /* =====（ZCode · 11-06 深夜）池对手席');
  const e1 = e.indexOf('  /* =====（ZCode · 11-06 深夜）桌形混合');
  if (s1 < 0 || e1 < 0 || e1 < s1) { console.error('evo 定义块定位失败'); process.exit(1); }
  e = e.slice(0, s1) + e.slice(e1);
  const bs = e.indexOf('        } else {\n          /*（ZCode · 11-06 深夜）池对手席');
  if (bs < 0) { console.error('evo 消费分支定位失败'); process.exit(1); }
  const marker = 'choosers.push(wrapBotN(opps[oppSeatIndex(gen, g, ok++, opps.length, OPP_BLOCK)].sel)); }';
  const be = e.indexOf(marker, bs);
  if (be < 0) { console.error('evo 分支结束定位失败'); process.exit(1); }
  e = e.slice(0, bs) + '        } else { choosers.push(wrapBotN(opps[oppSeatIndex(gen, g, ok++, opps.length, OPP_BLOCK)].sel)); }' + e.slice(be + marker.length);
  e = e.replace('    setPoolOpp, countPoolOppSeats, poolOppSeatFor, setMixHpEvery, mixHpMode, countMixHpFlips,   //（ZCode · 11-06 深夜）池对手席 + 桌形混合（默认全 0=关；收据见 countPoolOppSeats/countMixHpFlips）',
    '    setMixHpEvery, mixHpMode, countMixHpFlips,   //（ZCode · 11-06 深夜）桌形混合（默认 0=关；收据 countMixHpFlips）');
  writeFileSync('js/train/evo.js', e);
  console.log('evo.js: 池对手席定义/消费/导出已摘');
}
// 2) train-3p.mjs
let t = readFileSync('tools/train-3p.mjs', 'utf8');
{
  const r1 = "  'EPIRUS_POOL_OPP',   //（ZCode · 11-06 深夜）池对手席：fitness 的脚本对手席以概率 p 换成现役池成员（默认 0=关；收据闸见 [poolOpp]）\n";
  if (t.indexOf(r1) < 0) { console.error('t3p 白名单行定位失败'); process.exit(1); }
  t = t.replace(r1, '');
  const r2 = "    ['EPIRUS_POOL_OPP', 'setPoolOpp', 'poolOpp'],   /*（ZCode · 11-06 深夜）池对手席：脚本对手席以概率 p 换成池成员（用户令\"池进训练\"） */\n";
  if (t.indexOf(r2) < 0) { console.error('t3p 接线行定位失败'); process.exit(1); }
  t = t.replace(r2, '');
  const gs = t.indexOf('/* =====（ZCode · 11-06 深夜）池对手席 / 桌形混合 收据');
  const ge = t.indexOf('/* ===== 10-23（用户裁定）：G4/G5 最坏格否决');
  if (gs < 0 || ge < 0 || ge < gs) { console.error('t3p 收据块定位失败'); process.exit(1); }
  t = t.slice(0, gs) + `/* =====（ZCode · 11-06 深夜）桌形混合 收据：同 [course] 的形状 =====
 * 一局未翻 ⇒ 判据没接上（k<2 被钳 / 表形不匹配）⇒ 本臂作废，不许静默空转。 */
if (Number(process.env.EPIRUS_MIXHP_EVERY || 0) > 0) {
  const flips = (typeof T.countMixHpFlips === 'function') ? T.countMixHpFlips() : -1;
  console.log('[mixHp] 开火计数：换对偶桌 ' + flips + ' 局（mixHpEvery=' + process.env.EPIRUS_MIXHP_EVERY + ' ‖ 主桌=' +
    (typeof T.trainMode === 'function' ? T.trainMode() : '?') + '）');
  if (!(flips > 0)) {
    console.error('[train-3p] ⛔ 下达了 EPIRUS_MIXHP_EVERY=' + process.env.EPIRUS_MIXHP_EVERY + ' 却**一局未翻** ⇒ 本臂作废');
    process.exit(8);
  }
}

` + t.slice(ge);
  // CLI 沙箱池 bundle 装载（POOL_OPP 专用）摘掉
  const cs = t.indexOf('/*（ZCode · 11-06 深夜）池 bundle 进 CLI 沙箱');
  const ce = t.indexOf('/* ===== v1.5.229（用户批准方案 a）：序列奖励 =====');
  if (cs > 0 && ce > cs) t = t.slice(0, cs) + t.slice(ce);
  writeFileSync('tools/train-3p.mjs', t);
  console.log('train-3p.mjs: POOL_OPP 白名单/接线/收据/沙箱装载已摘');
}
// 3) worker
let w = readFileSync('server/train-worker.mjs', 'utf8');
{
  const ws = w.indexOf('/*（ZCode · 11-06 深夜）池 bundle 进沙箱');
  const we = w.indexOf('const T = sb.EpirusTrainer;');
  if (ws < 0 || we < 0 || we < ws) { console.error('worker 块定位失败'); process.exit(1); }
  w = w.slice(0, ws) + w.slice(we);
  w = w.replace("import { readFileSync, existsSync } from 'node:fs';", "import { readFileSync } from 'node:fs';");
  writeFileSync('server/train-worker.mjs', w);
  console.log('train-worker.mjs: 池 bundle 装载已摘');
}
