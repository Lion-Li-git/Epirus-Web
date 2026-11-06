import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const ruler = rd('scratch/night6/ruler-pool-only-1106.tsv'), rh = Object.fromEntries(ruler[0].map((x, i) => [x, i]));
const multi = rd('champion-map/epsfull-r64-multi-1106.tsv'), mh = Object.fromEntries(multi[0].map((x, i) => [x, i]));
const long = rd('champion-map/epsfull-r64-long-1106.tsv'), lh = Object.fromEntries(long[0].map((x, i) => [x, i]));
const pool = rd('champion-map/pool-members.tsv'), ph = Object.fromEntries(pool[0].map((x, i) => [x, i]));
const ids = ['DSTR4-s13','EFFG-s5','EFFG-s7','GD3ALL-POPP-s41','GD3ALL-PUSHON-s13','D-b-hpseed-s13','DDEF-s13','DSTR-s13','LE-s13','GD3ALL-G5-s13'];
const R = Object.fromEntries(ruler.slice(1).filter(r => ids.includes(r[rh.id])).map(r => [r[rh.id], r]));
const M = Object.fromEntries(multi.slice(1).filter(r => ids.includes(r[mh.id])).map(r => [r[mh.id], r]));
const L = Object.fromEntries(long.slice(1).filter(r => ids.includes(r[lh.id])).map(r => [r[lh.id], r]));
const P = Object.fromEntries(pool.slice(1).filter(r => ids.includes(r[ph.id])).map(r => [r[ph.id], r]));
const missing = ids.filter(id => !R[id] || !M[id] || !L[id] || !P[id]);
if (missing.length) { console.error('missing source rows: ' + missing.join(',')); process.exit(2); }
const T = 0.10;
function addRows(file) {
  const rows = rd(file), h = Object.fromEntries(rows[0].map((x, i) => [x, i]));
  const existing = new Set(rows.slice(1).map(r => r[h.id]));
  const add = ids.filter(id => !existing.has(id));
  if (!add.length) return { file, added: 0, total: rows.length - 1 };
  copyFileSync(file, file + '.bak-pool10');
  for (const id of add) {
    const r = R[id], mp = M[id], lp = L[id], pp = P[id], out = new Array(rows[0].length).fill('');
    out[h.id] = id;
    out[h.lineage] = r[rh.lineage] || '';
    out[h.seed] = (id.match(/s(\d+)$/) || ['', ''])[1];
    out[h.H] = r[rh.H]; out[h.S] = r[rh.S]; out[h.Geff] = r[rh.Geff];
    out[h.F] = (parseFloat(r[rh.H]) / 100 + T * parseFloat(r[rh.S])).toFixed(4);
    for (const k of ['dmg','heavy','holo','rounds','drawRate','zeroRate','seatSpread','distinctKeys','charges','waste','noThreatStance','fieldAAtk','rwDmg']) out[h[k]] = r[rh[k]];
    out[h.Hp] = mp[mh.page]; out[h.De] = mp[mh.d];
    out[h.path] = pp[ph.path]; out[h.dupN] = '1'; out[h.dupOf] = id;
    out[h.examG] = r[rh.examG] || '120';
    out[h.Hlong] = lp[lh.exam]; out[h.Hplong] = lp[lh.page];
    out[h.Flong] = (parseFloat(lp[lh.page]) / 100 + T * parseFloat(r[rh.S])).toFixed(4);
    out[h.ver] = '2.0';
    rows.push(out);
  }
  const iHp = h.Hp, iS = h.S, iRank = h.rank;
  const body = rows.slice(1);
  const fv = body.map(r => (parseFloat(r[iHp]) || 0) / 100 + T * (parseFloat(r[iS]) || 0));
  const order = fv.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  order.forEach((x, k) => { body[x[1]][iRank] = String(k + 1); });
  writeFileSync(file, [rows[0]].concat(body).map(r => r.join('\t')).join('\n') + '\n');
  return { file, added: add.length, total: body.length };
}
const a = addRows('champion-map/coords-gen3-1105.tsv');
const b = addRows('champion-map/coords-view-20.tsv');
console.log(JSON.stringify({main:a,view20:b}));
if (a.added !== 10 || b.added !== 10) process.exit(3);
