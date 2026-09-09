# -*- coding: utf-8 -*-
import io

def load(p): return io.open(p, encoding='utf-8').read()
def save(p, s): io.open(p, 'w', encoding='utf-8').write(s)
def rep(s, old, new, cnt=1):
    n = s.count(old)
    assert n == cnt, 'BAD(%d): %s' % (n, old[:80])
    return s.replace(old, new)

# ================= rules.js =================
p = 'js/core/rules.js'
s = load(p)
s = rep(s, "  const DMG = { NORMAL: 'normal', LIGHT: 'light', FIRE: 'fire', ELECTRIC: 'electric' };",
           "  const DMG = { NORMAL: 'normal', LIGHT: 'light', FIRE: 'fire', ELECTRIC: 'electric', FIRELIGHT: 'firelight' };  // N18 光&火复合")
s = rep(s, "    mk(SK.MIRROR, '\u955c\u9762\u53cd\u5c04', CAT.SPECIAL, 3, 3, 'enemy', { desc: '\uff08\u591a\u4eba\uff09\u590d\u5236\u4f5c\u7528\u8005 1 \u7684\u6280\u80fd\u5bf9\u4f5c\u7528\u8005 2 \u4f7f\u7528' })",
           "    mk(SK.MIRROR, '\u955c\u9762\u53cd\u5c04', CAT.SPECIAL, 3, 3, 'enemy', { desc: '\uff08\u591a\u4eba\uff09\u590d\u5236\u76ee\u6807 1 \u672c\u56de\u5408\u7684\u4f24\u5bb3\u6280\u80fd\uff0c\u5bf9\u76ee\u6807 2 \u65bd\u52a0\uff1b\u590d\u5236\u53cc\u67aa\u53ea\u7b97\u4e00\u67aa' })")
s = rep(s, "  // N9\uff1a3-5 \u4eba\u542f\u7528\u5168\u90e8\u6280\u80fd\uff0c\u4f46\u300c\u955c\u9762\u53cd\u5c04\u300d\u672c\u7248\u672a\u5b9e\u73b0\uff08N11\uff09\u6545\u6392\u9664\n  const AVAILABLE_MULTI = skills.filter(function (s) { return s.key !== SK.MIRROR; });",
           "  // N9/N14\uff1a3-5 \u4eba\u542f\u7528\u5168\u90e8\u6280\u80fd\uff08\u542b\u591a\u4eba\u4e13\u7528 \u53cc\u67aa\u5c04\u624b / \u955c\u9762\u53cd\u5c04\uff09\n  const AVAILABLE_MULTI = skills;")
save(p, s)
print('rules.js ok')

# ================= resolve.js =================
p = 'js/core/resolve.js'
s = load(p)

# 1) 火弱 / 光弱 支持复合属性
s = rep(s, "    if (opts.type === R.DMG.FIRE && p.fireWeakNow) hit += 1;",
           "    if ((opts.type === R.DMG.FIRE || opts.type === R.DMG.FIRELIGHT) && p.fireWeakNow) hit += 1;  // N18")
s = rep(s, "    if (target.vampire && dmg.type === R.DMG.LIGHT) amt += 1;         // R47",
           "    if (target.vampire && (dmg.type === R.DMG.LIGHT || dmg.type === R.DMG.FIRELIGHT)) amt += 1;  // R47 / N18")

# 2) 合二为一（小雷 pass 末尾）
s = rep(s, """      } else {
        setVoid(state, t, SK.MINI_T);
        ev(state, { type: 'voidedBy', pid: t, by: SK.MINI_T });
      }
    }""",
           """      } else {
        setVoid(state, t, SK.MINI_T);
        ev(state, { type: 'voidedBy', pid: t, by: SK.MINI_T });
      }
    }
    // N17 合二为一：>=2 人同时对同一目标用小雷 → 目标额外 1 点电伤
    const miniByTarget = {};
    for (const c of mini) {
      if (!actionOf(state, c)) continue;
      const t = targetOf(state, c);
      if (t != null) (miniByTarget[t] = miniByTarget[t] || []).push(c);
    }
    for (const tk in miniByTarget) {
      if (miniByTarget[tk].length >= 2) {
        ev(state, { type: 'hidden', name: '合二为一', pids: miniByTarget[tk].slice(), to: +tk });
        rawDamage(state, +tk, 1, '合二为一', 'unite', { type: R.DMG.ELECTRIC });
      }
    }""")

# 3) mirrorPass 函数（插在 clashPass 之后）
anchor = "  /* ---------- \u56de\u5408\u4e2d\u7ed3\u7b97 ---------- */"
assert s.count(anchor) == 1
mirror = u"""  /* ---------- N14 \u955c\u9762\u53cd\u5c04 / N15 \u53cd\u590d\u6a2a\u8df3 / N16 \u805a\u5149\u70ae ---------- */
  /* \u53ef\u88ab\u590d\u5236\u7684\u201c\u4f24\u5bb3\u6548\u679c\u201d\uff1a\u67b6\u52bf/\u81ea\u589e\u76ca/\u80fd\u91cf\u7c7b/\u72b6\u6001\u7c7b\u8fd4\u56de null */
  function copyEffect(key) {
    const def = R.byKey[key];
    if (!def) return null;
    if (key === SK.DUAL_GUN) return { amt: 1, type: R.DMG.NORMAL, pierce: {}, via: SK.GUN };  // \u539f\u6587\uff1a\u53ea\u7b97\u4e00\u67aa
    if (key === SK.LASER_EYE) return { amt: 1, type: R.DMG.LIGHT, pierce: {}, via: SK.LASER_EYE };
    if (key === SK.CANNON) return { amt: 1, type: R.DMG.NORMAL, pierce: {}, via: SK.CANNON };
    if (def.dmg && def.dmg.amt) return { amt: def.dmg.amt, type: def.dmg.type, pierce: def.pierce || {}, via: key };
    return null;
  }

  /* \u6709\u5411\u56fe\u662f\u5426\u5b58\u5728\u73af\uff08\u53cd\u590d\u6a2a\u8df3\u89e6\u53d1\u5224\u5b9a\uff09 */
  function hasCycle(edges) {
    const adj = {};
    for (const e of edges) (adj[e[0]] = adj[e[0]] || []).push(e[1]);
    const color = {};
    let found = false;
    function dfs(u) {
      color[u] = 1;
      const nxt = adj[u] || [];
      for (const v of nxt) {
        if (color[v] === 1) { found = true; return; }
        if (!color[v]) { dfs(v); if (found) return; }
      }
      color[u] = 2;
    }
    for (const k in adj) { if (!color[k]) { dfs(+k); if (found) break; } }
    return found;
  }

  function mirrorPass(state) {
    const mirrors = [];
    for (let i = 0; i < playerCount(state); i++) {
      const a = actionOf(state, i);
      if (a && a.key === SK.MIRROR) mirrors.push(i);
    }
    if (!mirrors.length) return;
    // \u76ee\u6807\u89e3\u6790\uff1at1=\u590d\u5236\u5bf9\u8c61\uff0ct2=\u8f93\u51fa\u5bf9\u8c61\uff08\u7f3a\u7701/\u5408\u6cd5\u6027\u6821\u9a8c\uff09
    const info = {};
    for (const m of mirrors) {
      const a = actionOf(state, m);
      const opps = aliveOpps(state, m);
      let t1 = a.target, t2 = a.target2;
      if (t1 == null || t1 === m || !state.p[t1] || state.p[t1].hp <= 0) t1 = opps.length ? opps[0] : null;
      if (t2 == null || t2 === m || t2 === t1 || !state.p[t2] || state.p[t2].hp <= 0) {
        t2 = null;
        for (const o of opps) { if (o !== t1) { t2 = o; break; } }
      }
      info[m] = { t1, t2 };
      if (t1 == null || t2 == null) setVoid(state, m, '\u955c\u9762\u53cd\u5c04\u65e0\u76ee\u6807');
    }
    // ---- N16 \u805a\u5149\u70ae ----
    const usedEdge = {};
    for (let x = 0; x < mirrors.length; x++) {
      for (let y = x + 1; y < mirrors.length; y++) {
        const A = mirrors[x], B = mirrors[y];
        const iA = info[A], iB = info[B];
        if (!iA || !iB || iA.t1 == null || iB.t1 == null || iA.t2 == null) continue;
        if (iA.t1 === B && iB.t1 === A && iA.t2 === iB.t2) {
          ev(state, { type: 'hidden', name: '\u805a\u5149\u70ae', pid: A, to: iA.t2 });
          rawDamage(state, iA.t2, 1, '\u805a\u5149\u70ae', 'focusCannon', { type: R.DMG.FIRELIGHT });
          usedEdge[A] = true; usedEdge[B] = true;
        }
      }
    }
    // ---- N15 \u53cd\u590d\u6a2a\u8df3\uff1a\u672a\u88ab\u805a\u5149\u70ae\u5360\u7528\u7684 (t1->t2) \u8fb9\u6210\u73af ----
    const edges = [];
    const freeUsers = [];
    for (const m of mirrors) {
      if (usedEdge[m]) continue;
      const it = info[m];
      if (it && it.t1 != null && it.t2 != null) { edges.push([it.t1, it.t2]); freeUsers.push(m); }
    }
    if (edges.length >= 2 && hasCycle(edges)) {
      ev(state, { type: 'hidden', name: '\u53cd\u590d\u6a2a\u8df3', pids: freeUsers.slice() });
      for (const u of freeUsers) rawDamage(state, u, 1, '\u53cd\u590d\u6a2a\u8df3', 'hop', { type: R.DMG.FIRELIGHT });
    }
    // ---- N14 \u590d\u5236\u4f24\u5bb3 ----
    for (const m of mirrors) {
      const a = actionOf(state, m);
      if (!a) continue;
      const it = info[m];
      if (!it || it.t1 == null || it.t2 == null) continue;
      const ta = actionOf(state, it.t1);
      if (!ta) { ev(state, { type: 'mirrorNoEffect', pid: m, from: it.t1 }); continue; }
      const eff = copyEffect(ta.key);
      if (!eff) { ev(state, { type: 'mirrorNoEffect', pid: m, from: it.t1, key: ta.key }); continue; }
      ev(state, { type: 'mirror', pid: m, from: it.t1, to: it.t2, key: ta.key });
      deliverDamage(state, {
        amt: eff.amt, type: eff.type, source: m, via: eff.via, pierce: eff.pierce || {}
      }, it.t2, { reason: '\u955c\u9762\u53cd\u5c04\u00b7' + R.byKey[ta.key].name });
    }
  }

"""
s = s.replace(anchor, mirror + anchor)

# 4) 在 pri3 之后调用 mirrorPass
s = rep(s, """    // \u4e92\u52fe \u2192 \u94c1\u7d22\u8fde\u73af\uff08\u5728\u62b5\u9500\u68c0\u67e5\u4e2d\u88ab\u8c41\u514d\uff0c\u53cc\u65b9\u5747\u5df2\u7ed3\u7b97\uff09""",
           """    // ====== \u2463b \u955c\u9762\u53cd\u5c04 / \u53cd\u590d\u6a2a\u8df3 / \u805a\u5149\u70ae\uff08N14/N15/N16\uff09======
    mirrorPass(state);

    // \u4e92\u52fe \u2192 \u94c1\u7d22\u8fde\u73af\uff08\u5728\u62b5\u9500\u68c0\u67e5\u4e2d\u88ab\u8c41\u514d\uff0c\u53cc\u65b9\u5747\u5df2\u7ed3\u7b97\uff09""")

save(p, s)
print('resolve.js ok')
