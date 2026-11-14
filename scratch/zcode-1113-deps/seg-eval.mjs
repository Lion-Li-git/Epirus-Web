/* OBS6 强且宽 · 快照评估驱动（11-14 晚 · ZCode）
 *   对每枚快照：三现役尺考卷（A coop / B F5 × multi/long，100/77000 全口径）→ C5 短/长，
 *   + cardUsageProfile（audit-lib 单一来源，5 席镜像自对局 ε=0）→ 用卡数/防御份额。
 *   选包判据 = C 高 ∧ 用卡 ≥6 ∧ 防御份额不塌（对照系 OBS6-GA2PG-8K 与 OBS6-GA25）。
 *   ⚑ 并行默认（用户 11-14 晚令"改成默认跑并行"）：考卷进程池 jobs=min(8,核数)，--jobs=1 才回串行。 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus } from 'node:os';
import { sandbox, loadChamp, cardUsageProfile } from '../../tools/audit-lib.mjs';

const execFileP = promisify(execFile);
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACKS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!PACKS.length) { console.error('用法：node seg-eval.mjs <pack1> <pack2> ... [--jobs=N]'); process.exit(2); }
const JOBS = Math.max(1, Number(arg('jobs', Math.min(8, cpus().length))) || 1);
const ROOT = process.cwd();
const W = sandbox();
const F5 = 'MSB11-R2S306293884,MSB14-railgun-R1S175656469,WSEL9-200,MSB15R-HITMIX,GD6a-TILT';
const LINE = { A: '[冠军4N]', B: '[冠军4N-B]' };

async function exam(pack, examName, mode, extra) {
  const args = ['tools/exam-4n.mjs', '100', '77000', pack, '--exam=' + examName, '--dose=page', '--mode=' + mode].concat(extra || []);
  const { stdout } = await execFileP('node', args, { cwd: ROOT, maxBuffer: 1 << 26 });
  const line = stdout.split('\n').find((l) => l.startsWith(LINE[examName]));
  if (!line) throw new Error('考卷摘要行缺失（' + examName + '/' + mode + '）');
  const get = (k) => { const m = line.match(new RegExp('[ hnxpkc]' + k + '=([^ ]+)')); return m ? m[1] : ''; };
  return { x2: +get('x2'), x3: +get('x3'), x5: +get('x5'), x8: +get('x8') };
}

async function evalPack(p) {
  const [a, al, b, bl] = await Promise.all([
    exam(p, 'A', 'multi', ['--coop=v3']),
    exam(p, 'A', 'long', ['--coop=v3']),
    exam(p, 'B', 'multi', ['--champ=' + F5, '--champn=1']),
    exam(p, 'B', 'long', ['--champ=' + F5, '--champn=1']),
  ]);
  const c5s = (a.x5 + b.x5) / 2, c5l = (al.x5 + bl.x5) / 2;
  const cAs = (a.x2 + b.x2) / 2, cBs = (a.x3 + b.x3) / 2, cCs = (a.x8 + b.x8) / 2;
  const cAl = (al.x2 + bl.x2) / 2, cBl = (al.x3 + bl.x3) / 2, cCl = (al.x8 + bl.x8) / 2;
  const x4s = 0.15 * cAs + 0.25 * cBs + 0.45 * c5s + 0.15 * cCs;
  const x4l = 0.15 * cAl + 0.25 * cBl + 0.45 * c5l + 0.15 * cCl;
  const params = loadChamp(W, p);
  if (!params) throw new Error('读不出：' + p);
  const cu = cardUsageProfile(W, params, { games: 60, mode: 'multi' });
  return { p, c5s, c5l, x4s, x4l, cards: cu.distinct, defShare: cu.defShare, pct: cu.pct };
}

console.log('并行评估 ' + PACKS.length + ' 枚 × 4 考卷 ‖ jobs=' + JOBS);
const results = [];
let idx = 0, done = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, PACKS.length) }, async () => {
  while (idx < PACKS.length) {
    const p = PACKS[idx++];
    const r = await evalPack(p);
    results.push(r); done++;
    console.log('[' + done + '/' + PACKS.length + '] ' + r.p.split(/[\\/]/).pop());
  }
}));
console.log('\npack'.padEnd(30) + ' C5短    C5长    X̄₄短    X̄₄长    用卡  防御%  カ谱');
for (const r of results) {
  const spec = Object.keys(r.pct).sort((x, y) => r.pct[y] - r.pct[x]).slice(0, 6)
    .map((k) => k + ' ' + r.pct[k].toFixed(0) + '%').join(' ');
  console.log(r.p.split(/[\\/]/).pop().padEnd(30) + ' ' + r.c5s.toFixed(4).padEnd(8) + r.c5l.toFixed(4).padEnd(8) +
    r.x4s.toFixed(4).padEnd(8) + r.x4l.toFixed(4).padEnd(8) + String(r.cards).padEnd(6) +
    r.defShare.toFixed(1).padEnd(7) + spec);
}
console.log('\n=== 强且宽候选排序（C5长 为主键） ===');
for (const r of results.slice().sort((x, y) => y.c5l - x.c5l)) {
  console.log(r.p.split(/[\\/]/).pop().padEnd(30) + ' C5长 ' + r.c5l.toFixed(4) + ' ‖ 用卡 ' + r.cards + ' ‖ 防御 ' + r.defShare.toFixed(1) + '%');
}
