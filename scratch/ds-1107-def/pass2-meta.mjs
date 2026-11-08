
import { readFileSync } from 'node:fs';
const s = readFileSync('docs/artifacts/night-adapt/PASS2-Q-s13.js', 'utf8').slice(0, 1500);
const m = s.match(/window\.EPIRUS_CHAMPION_3P_META = (\{.*?\});/s);
if (m) {
  try { const o = JSON.parse(m[1]); console.log(JSON.stringify({ arm: o.arm, ts: o.ts, seed: o.seed, gens: o.gens, pop: o.pop, games: o.games, n: o.n, hotstartFrom: o.hotstartFrom, up: o.up, arch: o.arch }, null, 1)); } catch (e) { console.log(m[1].slice(0, 600)); }
}
