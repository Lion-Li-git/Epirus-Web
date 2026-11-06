import { readFileSync } from 'node:fs';
function parse(path) {
  const t = readFileSync(path, 'utf8');
  const blocks = t.split(/^== /m).slice(1);
  const out = [];
  for (const b of blocks) {
    const id = (b.split(/[（(]/)[0] || '').trim();
    const sel = {};
    const m = /自选:([^\n]*)/.exec(b);
    if (m) for (const kv of m[1].trim().split(/\s+/)) { const e = kv.split('='); if (e.length === 2) sel[e[0]] = Number(e[1]); }
    const mine = /mine 菜单=(\d+) 自选=(\d+)/.exec(b);
    const drain = /drain 自选 (\d+)/.exec(b);
    out.push({ id, sel, mine: mine ? Number(mine[2]) : 0, drain: drain ? Number(drain[1]) : 0 });
  }
  return out;
}
const pools = { soft: parse('scratch/pool-cover-soft.log'), hard: parse('scratch/pool-cover-hard.log'), gen3: parse('scratch/pool-cover-gen3.log') };
const keys = ['gun','sword','snipe','tank','guard','reflect','bagua','shift','jinshield','armor','proto','holo','charge','ring','bigT','railgun','drain','mine','laserEye','cannon','curse','firestorm','taunt','transfer','rod','purify','miniT','dualGun','mirror'];
for (const [name, arr] of Object.entries(pools)) {
  console.log('## ' + name + '（' + arr.length + ' 成员）');
  const line = [];
  for (const k of keys) { const n = arr.filter((x) => (x.sel[k] || 0) > 0).length; if (n) line.push(k + ':' + n); }
  const d = arr.filter((x) => x.drain > 0).length, mm = arr.filter((x) => x.mine > 0).length;
  line.push('drain:' + d, 'mine:' + mm);
  console.log('  ' + line.join(' '));
}
