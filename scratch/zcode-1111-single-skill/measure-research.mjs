/* 研究矩阵收账：8 实验 × 分臂包 → 用量探针（self/script/f2 三桌）+ 台账 C → rmatrix.tsv
 * 用法：node measure-research.mjs（链条收完后跑） */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
const TARGET = { 'imit-bigT': 'bigT', 'packopp-bigT': 'bigT', 'selbigt-strong': 'bigT', 'seq10-elec': 'railgun',
  'ring-full': 'ring', 'laser-hard': 'laserEye', 'selcards5': '*', 'drain-window': 'drain' };
const EXP = Object.keys(TARGET);
const rows = [['exp', 'pack', 'C', 'selfTop', 'scriptTop', 'f2Top', 'tgtSelf', 'tgtScript', 'tgtF2']];
const led = readFileSync('scratch/night-adapt2/triplet-ledger.tsv', 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
for (const exp of EXP) {
  const packs = readdirSync('docs/artifacts/night-adapt').filter((f) => f.startsWith('MSB15R-' + exp + '-R1') && f.endsWith('.js')).map((f) => 'docs/artifacts/night-adapt/' + f);
  for (const p of packs) {
    const lr = [...led].reverse().find((r) => r.pack && r.pack.endsWith('/' + p.split('/').pop()));
    const C = lr ? String(lr.X4P_S).slice(0, 6) : '-';
    const out = await new Promise((res) => execFile(process.execPath, ['scratch/zcode-1111-single-skill/usage-probe.mjs', p],
      { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 240000 }, (e, so) => res(so || '')));
    const tsv = TARGET[exp];
    const getTable = (tag) => { const line = out.split(/\r?\n/).find((l) => l.includes(tag) && l.includes('出手')); if (!line) return null;
      const m = line.match(/(\w+) (\d+)%/g) || []; const top = m.slice(0, 3).join(' ');
      const hit = m.find((x) => x.startsWith(tsv + ' ')); return { top, share: hit ? hit.split(' ')[1] : '0%' }; };
    const self = getTable('self'), script = getTable('script'), f2 = getTable('f2');
    rows.push([exp, p.split('/').pop().replace('.js', ''), C, self ? self.top : '-', script ? script.top : '-', f2 ? f2.top : '-',
      self && tsv !== '*' ? self.share : '-', script && tsv !== '*' ? script.share : '-', f2 && tsv !== '*' ? f2.share : '-']);
    console.log(exp.padEnd(16), p.split('/').pop().replace('MSB15R-', '').replace('.js', ''), 'C=' + C,
      'tgt:', self && tsv !== '*' ? self.share : '-', '/', script && tsv !== '*' ? script.share : '-', '/', f2 && tsv !== '*' ? f2.share : '-');
  }
}
writeFileSync(new URL('./rmatrix.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), rows.map((r) => r.join('\t')).join('\n') + '\n');
console.log('落盘 rmatrix.tsv');
