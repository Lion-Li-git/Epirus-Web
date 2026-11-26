#!/usr/bin/env node
/* build-skill-page.mjs —— 烘 champion-map/skill-report.html（池级 skill-report 可视化页）
 *（2026-11-19 凌夜 · PLAN-2026-11-18-late 批 1d · 用户令「champion-map 另开一页 + 观感重构」）
 *
 * 纪律：
 *   · champion-map/index.html 由 viewer.mjs 烘焙、不许手改 —— 本页同理：**产物不许手改**，由本器烘出。
 *   · 自包含单文件（数据内联），双击 file:// 可看，无外部请求。
 *   · 数据真源 = data/skill-report/<id>.json（pool-skill-report.mjs 产物）；本页只做视图，
 *     不内联原始 cells/buckets（那 120 格原始计数留在 JSON 里可离线重算，页面只放派生列）。
 *   · 观感按 champion-map 现役页设计语言重做：暗色、紧凑卡片、色盲友好热力（明度梯度，不用红绿对撞）、
 *     分层强度判语沿用 skill-report 的语义色（坑红/主力绿/没学会橙/死技能紫/噪声灰）。
 *
 * 用法：node champion-map/build-skill-page.mjs [--out=champion-map/skill-report.html] [--quiet]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox } from '../tools/audit-lib.mjs';
import { rulesFingerprint } from '../tools/rules-fingerprint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'champion-map/data/skill-report');
const POOL_TSV = join(ROOT, 'champion-map/data/page/pool-members.tsv');
const DEFAULT_OUT = join(ROOT, 'champion-map/skill-report.html');

const DEAD_CARDS = ['tank', 'jinshield', 'armor', 'miniT', 'rod', 'firestorm', 'taunt', 'purify'];
/* 配额线（v1.8.44 验收线的方向读数；口径 = 观察层覆盖率>0 的包数，标注为跨环境口径） */
const QUOTAS = [
  { name: '聚能环', keys: ['ring'], min: 0.5 },
  { name: '大雷', keys: ['bigT'], min: 0.5 },
  { name: '电磁炮', keys: ['railgun'], min: 0.5 },
  { name: '激光眼', keys: ['laserEye'], min: 0.25 },
  { name: '过载炮', keys: ['cannon'], min: 0.25 },
  { name: '贴贴', keys: ['curse'], min: 0, atLeast1: true },
  { name: '天火', keys: ['firestorm'], min: 0, atLeast1: true },
  { name: '贴爆闭环', keys: ['curse', 'firestorm'], min: 0, atLeast1: true },
  { name: '小雷', keys: ['miniT'], min: 0, atLeast1: true },
  { name: '转移伤害', keys: ['transfer'], min: 0, atLeast1: true },
  { name: '原型制御', keys: ['proto'], min: 0, atLeast1: true },
];

function loadPool() {
  const lines = readFileSync(POOL_TSV, 'utf8').split('\n').map(s => s.replace(/\r/g, '')).filter(Boolean);
  const head = lines[0].split('\t');
  const ix = n => head.indexOf(n);
  return lines.slice(1).map(l => {
    const c = l.split('\t');
    return { id: c[ix('id')], wid: c[ix('wid')], path: c[ix('path')], tier: c[ix('tier')] };
  });
}

export function bake(opts = {}) {
  const quiet = !!opts.quiet;
  const pool = loadPool();
  const W = sandbox(ROOT);
  const R = W.EpirusRules;
  const SK30 = (R.skills || []).map(d => ({ key: d.key, name: d.name, cat: d.cat, cost: d.cost }));
  const keyName = {}; for (const s of SK30) keyName[s.key] = s.name;

  const docs = [];
  const missing = [];
  for (const m of pool) {
    const f = join(DATA_DIR, m.id + '.json');
    if (!existsSync(f)) { missing.push(m.id); continue; }
    const d = JSON.parse(readFileSync(f, 'utf8'));
    d.tier = m.tier;   /* 单一真源：以 pool-members.tsv 最新带位为准，避免下放/调带后沿用旧 JSON 里的 tier */
    docs.push(d);
  }
  if (missing.length) console.error('⚠ 无 skill-report JSON（页里显示"未测"）：' + missing.join(', '));
  const fps = [...new Set(docs.map(d => d.rulesFingerprint).filter(Boolean))];
  const fxKeys = [...new Set(docs.map(d => d.fixtureKey).filter(Boolean))];
  if (fxKeys.length > 1) console.error('⚠ skill-report 存在多代 fixtureKey 混表：' + fxKeys.join(', ') + ' ⇒ 应执行 pool-skill-report --stage=1 --all-pool 统一');
  /* 指纹新鲜度：raw 里的指纹 vs **现算**规则指纹（tools/rules-fingerprint.mjs 唯一登记处） */
  let bundleFp = null;
  try { bundleFp = rulesFingerprint(); } catch (e) { bundleFp = null; }

  const bandOf = t => (t === 'hard' ? 'hard' : 'soft');
  const bands = { hard: [], soft: [] };
  for (const d of docs) (bands[bandOf(d.tier)] || bands.soft).push(d);
  for (const b of Object.keys(bands)) bands[b].sort((a, b2) => (b2.stage1 ? b2.stage1.unionN : -1) - (a.stage1 ? a.stage1.unionN : -1));

  /* 池级/带级聚合 */
  function bandAgg(list) {
    const union = new Set();
    for (const d of list) if (d.stage1) for (const k of Object.keys(d.stage1.coverage)) union.add(k);
    const covCount = {};
    for (const k of union) covCount[k] = list.filter(d => d.stage1 && (d.stage1.coverage[k] || 0) > 0).length;
    return { union: [...union].sort(), covCount, n: list.length };
  }
  const agg = { hard: bandAgg(bands.hard), soft: bandAgg(bands.soft) };

  /* ===== HTML ===== */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtPct = v => (v == null) ? '—' : (100 * v).toFixed(1) + '%';
  const covColor = cells => {
    if (!cells) return 'background:#1a1f2b;color:#3d4557';
    const t = Math.min(1, cells / 30);
    const light = 42 + t * 38;
    return 'background:hsl(172 62% ' + light.toFixed(0) + '%);color:' + (t > 0.45 ? '#06251f' : '#e7fff9');
  };
  const deltaFmt = (d, se) => {
    if (d == null) return '—';
    const s = (d * 100 >= 0 ? '+' : '') + (d * 100).toFixed(1);
    return s + (se > 0 ? '<i>±' + (se * 196).toFixed(1) + '</i>' : '');
  };

  function strengthRows(d) {
    if (!d.stage2) return '<div class="none">强度层未测（入池时跑 Stage 2）</div>';
    const cs = (d.stage1 && d.stage1.curseStats) || {};
    const bds = (d.stage1 && d.stage1.bead) || null;
    const curseOk = cs.curseOk != null ? cs.curseOk : ((d.stage1 && d.stage1.totalUses && d.stage1.totalUses.curse) || 0);
    const fireOk = cs.firestormOk != null ? cs.firestormOk : ((d.stage1 && d.stage1.totalUses && d.stage1.totalUses.firestorm) || 0);
    const fireHits = cs.firestormHits || 0;
    const curseLanded = cs.curseLanded != null ? cs.curseLanded : curseOk;
    const blocked = Math.max(0, curseOk - curseLanded);
    const blockedPct = curseOk > 0 ? Math.round(100 * blocked / curseOk) : 0;
    const loopRate = cs.stickGames > 0 ? cs.loopGames / cs.stickGames : null;
    const takeRate = cs.fsLegalDecisions > 0 ? cs.fsTakenWhenLegal / cs.fsLegalDecisions : null;
    const loopPct = loopRate == null ? '—' : Math.round(100 * loopRate) + '%';
    const takePct = takeRate == null ? '—' : Math.round(100 * takeRate) + '%';
    const detRate = curseOk > 0 ? fireOk / curseOk : (fireOk > 0 ? 1 : 0);
    const detPct = Math.round(100 * detRate);
    const rows = [...d.stage2.results].sort((a, b) => a.key.localeCompare(b.key));
    let h = '<table class="stab"><tr><th>技能</th><th>层</th><th>口径</th><th>Δ_rich</th><th>Δ_nat/Δ_lost</th><th>判语</th></tr>';
    for (const r of rows) {
      const rich = r.arms.find(a => a.econ === 'rich');
      const nat = r.arms.find(a => a.econ === 'native' && a.kind === 'forced');
      const ban = r.arms.find(a => a.kind === 'ban');
      const na = (rich && rich.forceHit != null && rich.forceHit < 0.05);
      let verdict = '—', vcls = 'v0';
      if (na) { verdict = '实验未生效'; vcls = 'vna'; }
      else if (ban) {
        const sig = ban.se > 0 && Math.abs(ban.deltaLost) > 1.96 * ban.se;
        verdict = !sig ? '消融噪声内' : (ban.deltaLost > 0 ? '承重（拿掉掉分）' : '陷阱（拿掉变好）');
        vcls = !sig ? 'vnoise' : (ban.deltaLost > 0 ? 'vmain' : 'vpit');
      } else if (rich && rich.se > 0) {
        const natA = nat || rich;
        const sig = Math.abs(rich.delta) > 1.96 * rich.se || (nat && nat.se > 0 && Math.abs(nat.delta) > 1.96 * nat.se);
        const best = Math.max(rich.delta || 0, natA ? (natA.delta || 0) : 0);
        const bd = R.byKey[r.key] || {};
        const isUtil = !(bd.dmg && bd.dmg.amt > 0);   /* 承 skill-report：无伤害类 mono-spam 结构性为负，不是坑 */
        if (!sig) { verdict = '噪声内'; vcls = 'vnoise'; }
        else if (best > 0.005) { verdict = '没学会的强招'; vcls = 'vlearn'; }
        else if (best < -0.005) { verdict = isUtil ? '辅助类（结构性为负）' : '用了反而亏'; vcls = isUtil ? 'v0' : 'vpit'; }
        else { verdict = '中性'; vcls = 'v0'; }
      }
      let extra = '';
      if (r.key === 'curse' && curseOk >= 3) {
        const notes = [];
        if (loopRate != null && loopRate < 0.25) notes.push('局闭环 ' + loopPct);
        if (blockedPct >= 25) notes.push('被盾挡 ' + blockedPct + '%');
        if (notes.length) extra = ' <span class="tag ' + (loopRate != null && loopRate < 0.25 ? 'vpit' : 'v0') + '" title="贴=' + curseOk + ' / 落=' + curseLanded + ' / 闭环局=' + (cs.loopGames || 0) + '/' + (cs.stickGames || 0) + '">' + notes.join(' · ') + '</span>';
      } else if (r.key === 'firestorm' && (curseOk > 0 || fireOk > 0)) {
        const dc = (loopRate != null && loopRate < 0.25) ? 'neg' : (loopRate != null && loopRate >= 0.75 ? 'pos' : '');
        extra = '<div class="subinfo">局闭环 <b class="' + dc + '">' + loopPct + '</b>（' + (cs.loopGames || 0) + '/' + (cs.stickGames || 0) + '局）'
          + ' · 抓手 <b>' + takePct + '</b>（' + (cs.fsTakenWhenLegal || 0) + '/' + (cs.fsLegalDecisions || 0) + '次）'
          + ' · 被盾挡 <b>' + blockedPct + '%</b>（' + blocked + '/' + curseOk + '贴）'
          + (fireHits ? ' · ' + fireHits + ' 伤' : '') + '</div>';
      } else if (r.key === 'charge' && bds) {
        const ep = bds.elecGained > 0 ? Math.round(100 * bds.elecSpent / bds.elecGained) + '%' : '—';
        const bp = bds.boomGained > 0 ? Math.round(100 * bds.boomSpent / bds.boomGained) + '%' : '—';
        extra = '<div class="subinfo">电珠 <b>' + ep + '</b>（' + bds.elecSpent + '/' + bds.elecGained + '）· 爆珠 <b>' + bp + '</b>（' + bds.boomSpent + '/' + bds.boomGained + '）</div>';
      }
      h += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.stratum) + '</td><td>' + (r.inUse ? '<b class="ban">消融</b>' : '强制') + '</td>'
        + '<td class="' + (rich && rich.delta > 0 ? 'pos' : 'neg') + '">' + deltaFmt(rich && rich.delta, rich && rich.se) + '</td>'
        + '<td class="' + ((nat ? nat.delta : (ban ? ban.deltaLost : 0)) > 0 ? 'pos' : 'neg') + '">' + deltaFmt(nat ? nat.delta : (ban ? ban.deltaLost : null), nat ? nat.se : (ban ? ban.se : 0)) + '</td>'
        + '<td><span class="tag ' + vcls + '">' + verdict + '</span>' + extra + '</td></tr>';
    }
    return h + '</table>';
  }

  function packCard(d) {
    const s1 = d.stage1;
    const fresh = !bundleFp || !d.rulesFingerprint || d.rulesFingerprint === bundleFp;
    let h = '<div class="pcard" data-union="' + (s1 ? s1.unionN : -1) + '" data-tier="' + esc(d.tier) + '">';
    h += '<div class="phead"><b class="pid">' + esc(d.id) + '</b><span class="chip ' + (d.tier === 'hard' ? 'ch' : 'cs') + '">' + (d.tier === 'hard' ? '困难' : '简单') + '</span>'
      + '<span class="fresh ' + (fresh ? 'fok' : 'fexp') + '" title="rulesFingerprint ' + esc(d.rulesFingerprint || '—') + ' vs bundle ' + esc(bundleFp || '—') + '">' + (fresh ? '新鲜' : '指纹过期') + '</span>'
      + '<span class="when">' + esc((d.measuredAt || '').slice(0, 16).replace('T', ' ')) + '</span></div>';
    if (!s1) { h += '<div class="none">观察层未测</div></div>'; return h; }
    h += '<div class="mrow">'
      + '<span class="m"><b>' + s1.unionN + '</b>并集</span>'
      + '<span class="m"><b>' + s1.selfUnionN + '</b>自对局</span>'
      + '<span class="m"><b>' + s1.envOnlySkills.length + '</b>环境独有</span>'
      + '<span class="m"><b>' + (s1.switchJs == null ? '—' : s1.switchJs) + '</b>换招JS</span>'
      + '<span class="m"><b>' + fmtPct(s1.winRate) + '</b>胜率</span>'
      + '</div>';
    if (s1.envOnlySkills.length) h += '<div class="envonly">镜像看不见但环境会：' + s1.envOnlySkills.map(k => '<i title="' + esc(keyName[k] || k) + '">' + esc(keyName[k] || k) + '</i>').join('') + '</div>';
    h += '<div class="heat">';
    for (const s of SK30) {
      const cov = s1.coverage[s.key] || 0;
      const uses = s1.totalUses[s.key] || 0;
      const dead = DEAD_CARDS.includes(s.key) && !cov ? ' dead' : '';
      h += '<span class="cell' + dead + '" style="' + covColor(cov) + '" title="' + esc(s.name) + '（' + s.key + '）· 覆盖 ' + cov + '/120 格 · ' + uses + ' 手' + (dead ? ' · 死卡短名单' : '') + '">' + esc(s.key.slice(0, 5)) + '</span>';
    }
    h += '</div>';
    h += strengthRows(d);
    h += '</div>';
    return h;
  }

  function bandSection(name, label, list, a) {
    const quotaRows = QUOTAS.map(q => {
      const cnt = q.keys.length > 1
        ? list.filter(d => d.stage1 && q.keys.every(k => (d.stage1.coverage[k] || 0) > 0)).length
        : (a.covCount[q.keys[0]] || 0);
      const ok = q.atLeast1 ? cnt >= 1 : (cnt / Math.max(1, a.n)) >= q.min;
      return '<span class="q ' + (ok ? 'qok' : 'qbad') + '" title="' + esc(q.name) + ' ' + cnt + '/' + a.n + ' 包有跨环境使用（观察层口径）">' + esc(q.name) + ' ' + cnt + '/' + a.n + '</span>';
    }).join('');
    let h = '<section><div class="bhead"><h2>' + esc(label) + '<span class="bn">' + list.length + ' 枚 · 池级并集 ' + a.union.length + '/30</span></h2><div class="quotas">' + quotaRows + '</div></div>';
    h += '<div class="pgrid">' + list.map(packCard).join('') + '</div></section>';
    return h;
  }

  const builtAt = new Date().toISOString();
  let html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  html += '<title>Epirus 池级 Skill-Report</title><style>';
  html += 'body{background:#0b0e14;color:#dfe3ec;font:13px/1.55 system-ui,"Microsoft YaHei",sans-serif;margin:0;padding:22px 26px}a{color:#9fc3ff;text-decoration:none}a:hover{text-decoration:underline}';
  html += 'h1{font-size:19px;margin:0 0 2px}h2{font-size:15px;margin:0;color:#e8ecf5}.sub{color:#7f879b;font-size:12px;margin:2px 0 14px}';
  html += '.stamp{display:inline-block;background:#141926;border:1px solid #232b3d;border-radius:6px;padding:3px 9px;margin:0 6px 6px 0;font-size:11px;color:#9aa3ba}.stamp b{color:#cfd6e6}';
  html += '.bhead{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin:26px 0 10px;border-bottom:1px solid #1d2433;padding-bottom:8px}.bn{font-weight:400;color:#7f879b;font-size:12px;margin-left:10px}';
  html += '.quotas{display:flex;flex-wrap:wrap;gap:6px}.q{font-size:11px;padding:2px 8px;border-radius:10px;background:#141926;border:1px solid #232b3d;color:#8b93a7}.qok{border-color:#1f5c4a;color:#5ee0b8}.qbad{border-color:#6b2b2b;color:#f08c8c}';
  html += '.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:12px}';
  html += '.pcard{background:#10141d;border:1px solid #1e2534;border-radius:10px;padding:12px 14px}';
  html += '.phead{display:flex;align-items:center;gap:8px;margin-bottom:8px}.pid{font-size:14px;color:#f2f5fb}.chip{font-size:10px;padding:1px 7px;border-radius:9px;font-weight:700}.ch{background:#3b2f14;color:#f5b95e}.cs{background:#123a33;color:#5ee0b8}';
  html += '.fresh{font-size:10px;padding:1px 7px;border-radius:9px}.fok{background:#122b24;color:#4fd6a2}.fexp{background:#3a1515;color:#f08c8c}.when{margin-left:auto;font-size:10px;color:#69718a}';
  html += '.mrow{display:flex;gap:14px;margin:6px 0 8px}.m{font-size:11px;color:#7f879b}.m b{font-size:15px;color:#e8ecf5;margin-right:3px;font-weight:700}';
  html += '.envonly{font-size:11px;color:#8fb7ff;margin:2px 0 6px}.envonly i{font-style:normal;background:#152036;border-radius:4px;padding:1px 5px;margin-right:4px}';
  html += '.subinfo{font-size:10px;color:#8b93a7;margin-top:2px;line-height:1.35}';
  html += '.heat{display:flex;flex-wrap:wrap;gap:3px;margin:6px 0 10px}.cell{font-size:9px;padding:2px 4px;border-radius:4px;letter-spacing:.2px}.cell.dead{outline:1px dashed #7d3b3b}';
  html += '.none{color:#69718a;font-size:12px;padding:6px 0}';
  html += '.stab{width:100%;border-collapse:collapse;margin-top:6px}.stab th,.stab td{font-size:11px;padding:3px 6px;text-align:left;border-bottom:1px solid #182030;color:#aeb6c8}.stab th{color:#69718a;font-weight:600}';
  html += '.pos{color:#5ee0b8}.neg{color:#f08c8c}.pos i,.neg i{font-style:normal;opacity:.7;font-size:10px}';
  html += '.tag{font-size:10px;padding:1px 7px;border-radius:9px;font-weight:700}.vmain{background:#123a2b;color:#4fd6a2}.vlearn{background:#3a2c10;color:#f5b95e}.vpit{background:#3a1a1a;color:#f08c8c}.vnoise{background:#232b3d;color:#9aa3ba}.vna{background:#20242e;color:#69718a}.v0{background:#232b3d;color:#8b93a7}.ban{color:#f5b95e;font-size:10px}';
  html += '.filters{display:flex;gap:8px;margin:0 0 6px}button{background:#141926;border:1px solid #232b3d;color:#9aa3ba;border-radius:6px;padding:3px 12px;font-size:12px;cursor:pointer}button.on{border-color:#2dd4bf;color:#2dd4bf}';
  html += 'footer{margin-top:26px;color:#5b6377;font-size:11px}';
  html += '</style></head><body>';
  html += '<h1>Epirus 池级 Skill-Report</h1>';
  html += '<div class="sub">困难 / 简单两带逐包的跨环境覆盖（观察层）与分层强度（强度层）。数据真源 <code>data/skill-report/&lt;id&gt;.json</code>；本页为烘焙产物，不许手改。· <a href="index.html">← 返回冠军演化图</a> · <a href="trends.html">A/B 趋势 ↗</a></div>';
  html += '<div>'
    + '<span class="stamp">fixture <b>' + esc(fxKeys.join(' / ') || '—') + '</b></span>'
    + '<span class="stamp">规则指纹 <b>' + esc(bundleFp || '—') + '</b></span>'
    + '<span class="stamp">在池 <b>' + docs.length + '/' + pool.length + '</b> 枚已测</span>'
    + '<span class="stamp">烘焙 <b>' + esc(builtAt.slice(0, 16).replace('T', ' ')) + '</b></span>'
    + '</div>';
  html += '<div class="filters"><button class="on" data-f="all">全部</button><button data-f="hard">困难带</button><button data-f="soft">简单带</button><span class="sub" style="margin:0 0 0 10px;align-self:center">热力 = 每技能环境覆盖格数（/120，≥3 格判"在该环境会用"）；虚线框 = 死卡短名单且 0 覆盖</span></div>';
  html += bandSection('hard', '困难 · 冠军带', bands.hard, agg.hard);
  html += bandSection('soft', '简单 · 陪练带', bands.soft, agg.soft);
  html += '<footer>口径注记：覆盖/并集/换招JS = Stage 1 观察层（fixtures.tsv 声明的对手矩阵 × 2/3/5/8 人 × multi/long × 10 局/格，ε=0.15 冠军自由发挥）；Δ_rich=富裕经济强制/消融配对差（潜力），Δ_nat=原生经济（实际含机会成本）；判语先过 |Δ|&gt;1.96·SE（承 skill-report v1.5.190 Q-9 纪律）。配额行 = 观察层口径的方向读数，验收以 tools/champion-gate.mjs 为准。</footer>';
  html += '<script>(function(){var bs=document.querySelectorAll(".filters button");bs.forEach(function(b){b.onclick=function(){bs.forEach(function(x){x.classList.remove("on")});b.classList.add("on");var f=b.dataset.f;document.querySelectorAll("section").forEach(function(s,i){s.style.display=(f==="all"||["hard","soft"][i]===f)?"":"none"});};});})();</script>';
  html += '</body></html>';
  const out = join(ROOT, 'champion-map/skill-report.html');
  writeFileSync(out, html, 'utf8');
  if (!quiet) console.log('skill-report 页已烘焙 → ' + out + '（' + html.length + ' 字节，' + docs.length + ' 枚，missing=' + missing.length + '）');
  return { out, docs: docs.length, missing: missing.length };
}

if (process.argv[1] && process.argv[1].endsWith('build-skill-page.mjs')) {
  bake({ quiet: process.argv.includes('--quiet') });
}
