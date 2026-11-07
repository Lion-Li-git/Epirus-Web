/* champion-map 分类 v2：剥注释后的活引用判定（11-07 午）
 * 活引用面 = 活脚本（剥掉注释行后再查）+ tools/server/js + CI workflow + bake-flags.txt
 * 对 DATA-LIVE 候选打印证据行（哪个活文件、第几行、内容前 90 字符）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = 'D:/code/Epirus-Web';
const CM = ROOT + '/champion-map';
const stripComments = (t) => t.split('\n').filter(l => { const s = l.trim(); return !(s.startsWith('*') || s.startsWith('/*') || s.startsWith('//')); }).join('\n');

const LIVE_MJS = readdirSync(CM).filter(f => f.endsWith('.mjs') && !/^_/.test(f) &&
  !/^(gen3-map|gen3-evolution|directions|gapscan|seatassoc|seatroster|selkeys|stats-lib|trace-game|vetoline|holefeatures|hlong-compare|holoprobe|iso-sweep|k8arms|k8measure|oldpacks|eps-arms|duel-stats|pool-arrange|pool-basin|pool-screen|pool-traits|promscan|ship-scan|widhunt|eps2seed|evaln-noise|feas|epsread|chain-scan|duelscan|duel-run|seat-parse|seatgap|holo2proto|point-data|promote|pool-hp|usage)/.test(f));
let LIVE = '';
for (const f of LIVE_MJS) { try { LIVE += '\n@@' + f + '\n' + stripComments(readFileSync(join(CM, f), 'utf8')); } catch (e) {} }
LIVE += '\n@@bake-flags\n' + readFileSync(join(CM, 'bake-flags.txt'), 'utf8');
for (const f of ['tools/pool-add.mjs', 'tools/np-test.mjs', 'tools/spec-run.mjs']) { try { LIVE += '\n@@' + f + '\n' + stripComments(readFileSync(ROOT + '/' + f, 'utf8')); } catch (e) {} }
try { LIVE += '\n@@CI\n' + execFileSync('grep', ['-rh', '-e', 'champion-map', '.github/workflows/'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }); } catch (e) {}
/* scratch 的两条活链也算：night6-join（1105 的建造器）与 r64-attach */
for (const f of ['scratch/night6-join-coords.mjs', 'scratch/zcode-1106/r64-attach.mjs']) { try { LIVE += '\n@@' + f + '\n' + stripComments(readFileSync(ROOT + '/' + f, 'utf8')); } catch (e) {} }

const files = readdirSync(CM).filter(f => { try { return statSync(join(CM, f)).isFile(); } catch (e) { return false; } });
const LIVE_MJS_SET = new Set(LIVE_MJS);
const rows = [];
for (const f of files) {
  if (LIVE_MJS_SET.has(f)) { rows.push(['SCRIPT-LIVE', f, '']); continue; }
  const idx = LIVE.indexOf(f);
  if (idx >= 0 && f.length > 4) {
    const at = LIVE.lastIndexOf('@@', idx);
    const src = LIVE.slice(at + 2, LIVE.indexOf('\n', at));
    const line = LIVE.slice(idx - 60, idx + 40).split('\n').pop().trim().slice(0, 90);
    rows.push(['DATA-LIVE', f, src + ' ‖ …' + line]);
  } else rows.push(['ARCHIVE?', f, '']);
}
let cur = '';
for (const [c, f, ev] of rows) {
  if (c !== cur) { console.log('\n== ' + c + ' =='); cur = c; }
  console.log('  ' + f + (ev ? '   ← ' + ev : ''));
}
const n = c => rows.filter(r => r[0] === c).length;
console.log('\nSCRIPT-LIVE=' + n('SCRIPT-LIVE') + '  DATA-LIVE=' + n('DATA-LIVE') + '  ARCHIVE?=' + n('ARCHIVE?'));
