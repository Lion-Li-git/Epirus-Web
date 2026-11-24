/* 换招/分布距离的单一来源：pool-skill-report 与残局探针共用同一算术。 */
export function hpEpBucket(state, pid) {
  const me = (state && state.p && state.p[pid]) || {};
  const hp = me.hp != null ? me.hp : 0, ep = me.ep != null ? me.ep : 0;
  return (hp >= 4 ? 0 : (hp >= 2 ? 1 : 2)) * 4 + Math.min(3, ep);
}

export function jsDiv(p, q) {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  let np = 0, nq = 0;
  for (const k of keys) { np += p[k] || 0; nq += q[k] || 0; }
  if (!np || !nq) return 0;
  let d = 0;
  for (const k of keys) {
    const a = (p[k] || 0) / np, b = (q[k] || 0) / nq, m = (a + b) / 2;
    if (a > 0) d += 0.5 * a * Math.log2(a / m);
    if (b > 0) d += 0.5 * b * Math.log2(b / m);
  }
  return d;
}

export function entropy(dist) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  let h = 0;
  for (const k in dist) { const p = dist[k] / total; if (p > 0) h -= p * Math.log2(p); }
  return h;
}

export function switchRate(keys) {
  if (!keys || keys.length < 2) return null;
  let changed = 0;
  for (let i = 1; i < keys.length; i++) if (keys[i] !== keys[i - 1]) changed++;
  return changed / (keys.length - 1);
}

export function nonJiSwitchRate(sequences) {
  let prev = null, transitions = 0, changes = 0;
  for (const seq of sequences || []) for (const k of seq) {
    if (k === 'ji') continue;
    if (prev != null) { transitions++; if (k !== prev) changes++; }
    prev = k;
  }
  return transitions ? changes / transitions : null;
}

export function bucketJs(a, b, minActions) {
  const floor = minActions || 30;
  const total = (x) => Object.values(x).reduce((s, n) => s + n, 0);
  let sum = 0, n = 0;
  for (const bk of Object.keys(a)) {
    if (!b[bk]) continue;
    if (total(a[bk]) >= floor && total(b[bk]) >= floor) { sum += jsDiv(a[bk], b[bk]); n++; }
  }
  return { js: n ? sum / n : null, buckets: n };
}
