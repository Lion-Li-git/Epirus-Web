import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { widOf } from '../../../champion-map/pack-id.mjs';

const ROOT = process.cwd();
const SIM = 'D:/code/Epirus-Web-pool-sim-l1b';
const OUT = 'docs/research/evidence-2026-11-27-overnight-qwen';
const ID = process.env.SIM_ID || 'L1B-S1200';
const CAND = process.env.SIM_PACK || 'scratch/arms/nov27-long-pgdr-l1b.seg1200.bak';
const SIM_PACK = 'docs/artifacts/' + ID + '.bak';
const targets = (process.env.SIM_TARGETS || 'MX8-R6B-KL,MX6-GD-TF20,MX8-TN35-KL3,RING-MINIT-CONT').split(',');
const full = process.env.SIM_FULL === '1';
const seeds2p = full ? [95001, 95002, 95003, 95004, 95005, 95006, 95007, 95008] : [95001];
const seeds5p = full ? [95001, 95002, 95003, 95004] : [95001];
const tablePath = resolve(SIM, 'champion-map/data/page/pool-members.tsv');
const original = readFileSync(tablePath, 'utf8');
const lines = original.replace(/\r/g, '').trimEnd().split('\n');
const head = lines[0].split('\t');
const rows = lines.slice(1).map((line) => line.split('\t'));
const wid = widOf(readFileSync(resolve(ROOT, CAND), 'utf8'));
const configs = [
  { key: '2p-rule', n: 2, mode: 'standard', surrogate: 'rule', seeds: seeds2p },
  { key: '2p-legacy', n: 2, mode: 'standard', surrogate: 'legacy', seeds: seeds2p },
  { key: '5p-multi', n: 5, mode: 'multi', surrogate: 'legacy', seeds: seeds5p },
  { key: '5p-long', n: 5, mode: 'long', surrogate: 'legacy', seeds: seeds5p },
];
const report = [];

function tierValues(text) {
  const out = {};
  for (const [key, re] of [['hard', /困难/], ['regular', /普通/], ['sparring', /简单/]]) {
    const line = text.split(/\r?\n/).find((s) => re.test(s) && /替身夺冠/.test(s));
    const m = line && line.match(/替身夺冠\s+([\d.]+)%/);
    if (!m) throw new Error('阶梯缺 ' + key + ' 读数');
    out[key] = Number(m[1]);
  }
  return out;
}

try {
  for (const target of targets) {
    const ix = rows.findIndex((r) => r[head.indexOf('id')] === target);
    if (ix < 0) throw new Error('池里没有靶点 ' + target);
    const old = rows[ix].slice();
    rows[ix] = [ID, wid, SIM_PACK, old[head.indexOf('tier')], '0', 'pass', '0', old[head.indexOf('addedAt')], 'pool replacement simulation'];
    writeFileSync(tablePath, [head.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n') + '\n');
    for (const cfg of configs) {
      for (const seed of cfg.seeds) {
        const cp = spawnSync(process.execPath, [
          'tools/probe-diff-ladder.mjs', '--pool=1', '--n=' + cfg.n, '--mode=' + cfg.mode,
          '--games=' + (cfg.n === 2 ? 1000 : 400), '--seed=' + seed, '--surrogate=' + cfg.surrogate,
        ], { cwd: SIM, encoding: 'utf8', maxBuffer: 16 << 20 });
        if (cp.status !== 0) throw new Error(target + ' ' + cfg.key + ' seed=' + seed + ' exit=' + cp.status + '\n' + cp.stderr.slice(-1000));
        const vals = tierValues(cp.stdout);
        report.push({ target, config: cfg.key, seed, ...vals });
        console.log(target + '\t' + cfg.key + '\t' + seed + '\t' + vals.hard + '\t' + vals.regular + '\t' + vals.sparring);
      }
    }
    rows[ix] = old;
    writeFileSync(tablePath, original);
  }
} finally {
  writeFileSync(tablePath, original);
}

writeFileSync(resolve(ROOT, OUT, ID + '-pool-replacement' + (full ? '-full' : '-screen') + '.json'), JSON.stringify(report, null, 2));
const header = ['target', 'config', 'seed', 'hard', 'regular', 'sparring'];
writeFileSync(resolve(ROOT, OUT, ID + '-pool-replacement' + (full ? '-full' : '-screen') + '.tsv'),
  header.join('\t') + '\n' + report.map((r) => header.map((k) => r[k]).join('\t')).join('\n') + '\n');
