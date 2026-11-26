import { readFileSync } from 'node:fs';

const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith('--' + k + '=')); return h ? h.slice(k.length + 3) : d; };
const candPath = arg('candidate', '');
const basePath = arg('baseline', '');
if (!candPath || !basePath) throw new Error('usage: --candidate=<json> --baseline=<json>');
const skills = (arg('skills', 'charge,railgun,tank,transfer,firestorm') || '').split(',').filter(Boolean);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const cand = read(candPath), base = read(basePath);

function profile(j, skill) {
  const s = j.stage1 || {};
  const raw = { uses: 0, games: 0, cells: 0, nonzero: 0, byN: {} };
  for (const c of s.cells || []) {
    const u = Number(c.keys?.[skill] || 0);
    raw.uses += u; raw.games += c.games; raw.cells++;
    if (u > 0) raw.nonzero++;
    const n = c.n, b = raw.byN[n] || (raw.byN[n] = { uses: 0, games: 0, cells: 0, nonzero: 0 });
    b.uses += u; b.games += c.games; b.cells++;
    if (u > 0) b.nonzero++;
  }
  const cl = s.closure?.[skill] || null;
  return { raw, closure: cl };
}
const rows = [];
for (const skill of skills) {
  for (const [label, j] of [['baseline', base], ['candidate', cand]]) {
    const p = profile(j, skill);
    rows.push({ label, skill, winRate: j.stage1?.winRate, unionN: j.stage1?.unionN,
      uses: p.raw.uses, nonzeroCells: p.raw.nonzero,
      closureUses: p.closure?.uses ?? '', closurePaid: p.closure?.paid ?? '', closureRate: p.closure?.rate ?? '',
      byN: Object.entries(p.raw.byN).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, v]) => `${n}:${v.uses}/${v.games}/${v.nonzero}`).join(',') });
  }
}
console.table(rows);
