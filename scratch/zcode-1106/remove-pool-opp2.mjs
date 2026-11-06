/* 摘除重复的 EPIRUS_POOL_OPP（行级、CRLF 容忍）· ZCode 11-07 凌晨 */
import { readFileSync, writeFileSync } from 'node:fs';

function editLines(path, dropTests, spliceOps) {
  const raw = readFileSync(path, 'utf8');
  const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  let lines = raw.split('\n').map(l => l.replace(/\r$/, ''));
  for (const t of dropTests) {
    const before = lines.length;
    lines = lines.filter(l => !t(l));
    console.log(path + ': 删 ' + (before - lines.length) + ' 行 (test ' + t.toString().slice(0, 40) + '…)');
  }
  for (const op of spliceOps || []) lines = op(lines);
  writeFileSync(path, lines.join(eol));
}

/* 1) evo.js：摘定义块（232-268 区段）+ 消费分支 + 导出行 */
{
  const raw = readFileSync('js/train/evo.js', 'utf8');
  const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  let lines = raw.split('\n').map(l => l.replace(/\r$/, ''));
  // 定义块：从"池对手席：fitness 的脚本对手席"注释行到"桌形混合"注释行前一行
  const s = lines.findIndex(l => l.indexOf('池对手席：fitness 的脚本对手席') >= 0 && l.indexOf('=====') >= 0);
  const eIdx = lines.findIndex(l => l.indexOf('=====（ZCode · 11-06 深夜）桌形混合') >= 0);
  if (s < 0 || eIdx < 0 || eIdx <= s) { console.error('evo 定义块定位失败 ' + s + '/' + eIdx); process.exit(1); }
  lines.splice(s, eIdx - s);
  // 消费分支：从 "} else {" 前导（下一行是池对手席注释）到 wrapBotN 行 + "        }" 收行
  const c = lines.findIndex(l => l.indexOf('池对手席：抽中') >= 0);
  if (c < 0) { console.error('evo 消费注释定位失败'); process.exit(1); }
  // c 是注释行；它上一行是 "} else {"；分支结束 = wrapBotN 行再下一行的 "        }"
  let wIdx = -1;
  for (let i = c; i < lines.length; i++) if (lines[i].indexOf('opps[oppSeatIndex(gen, g, ok++, opps.length, OPP_BLOCK)].sel)); }') >= 0) { wIdx = i; break; }
  if (wIdx < 0) { console.error('evo wrapBotN 行定位失败'); process.exit(1); }
  const closeIdx = (lines[wIdx + 1] || '').trim() === '}' ? wIdx + 1 : wIdx;
  const elseLine = c - 1;
  lines.splice(elseLine, closeIdx - elseLine + 1, '        } else { choosers.push(wrapBotN(opps[oppSeatIndex(gen, g, ok++, opps.length, OPP_BLOCK)].sel)); }');
  // 导出行
  const xi = lines.findIndex(l => l.indexOf('setPoolOpp, countPoolOppSeats') >= 0);
  if (xi >= 0) lines[xi] = '    setMixHpEvery, mixHpMode, countMixHpFlips,   //（ZCode · 11-06 深夜）桌形混合（默认 0=关；收据 countMixHpFlips）';
  writeFileSync('js/train/evo.js', lines.join(eol));
  console.log('evo.js 已清（POOL_OPP 全摘）');
}
/* 2) train-3p.mjs */
editLines('tools/train-3p.mjs', [
  l => l.indexOf("'EPIRUS_POOL_OPP',") >= 0 && l.indexOf('11-06 深夜') >= 0,
  l => l.indexOf("['EPIRUS_POOL_OPP', 'setPoolOpp'") >= 0,
  l => l.indexOf('池 bundle 进 CLI 沙箱') >= 0 || l.indexOf('收据闸（[poolOpp] 一席未注 exit 8）会把这种"假池臂"拦下来') >= 0 || l.indexOf('if (existsSync(f)) vm.runInNewContext(readFileSync(f, \'utf8\'), sb, { filename: f });') >= 0,
], [
  // 收据块：摘 [poolOpp] 段（从注释到它的 if 闭合），保留 mixHp 段
  (lines) => {
    const s = lines.findIndex(l => l.indexOf('池对手席 / 桌形混合 收据') >= 0);
    if (s < 0) return lines;
    const eIdx = lines.findIndex(l => l.indexOf('/* ===== 10-23（用户裁定）：G4/G5 最坏格否决') >= 0);
    if (eIdx < 0 || eIdx <= s) return lines;
    const mixStart = lines.findIndex(l => l.indexOf('桌形混合 收据：同 [course] 的形状') >= 0);
    if (mixStart < 0 || mixStart <= s) return lines;   // mixHp 段不在块内（异常），整块不动
    return lines.slice(0, s).concat(lines.slice(mixStart), lines.slice(eIdx));
  },
]);
/* 3) worker */
editLines('server/train-worker.mjs', [
  l => l.indexOf('池 bundle 进沙箱') >= 0,
  l => l.indexOf("if (existsSync(p)) vm.runInNewContext(readFileSync(p, 'utf8'), sb, { filename: f });") >= 0 && l.indexOf('bundled-champion-pool') >= 0,
  l => l.indexOf("import { readFileSync, existsSync } from 'node:fs';") >= 0,
  l => l.indexOf("for (const f of ['js/bundled-champion-pool.js', 'js/bundled-champion-pool-2p.js']) {") >= 0,
  l => l.indexOf('const p = join(root, f);') >= 0 && false, // 占位（join(root,f) 别处也有，只删上面 for 行即可，for 体一并删：）
  l => l.indexOf('vm.runInNewContext(readFileSync(p, \'utf8\'), sb, { filename: f });') >= 0,
  l => l.indexOf('懒加载语义：evo 侧 poolOppParams') >= 0,
  l => l.indexOf('而 evo.js 的读法是 `globalThis.EPIRUS_CHAMPION_POOL`') >= 0,
  l => l.indexOf('两个 bundle 各 ~3MB，每 worker 一次性读入') >= 0,
]);
console.log('完成');
