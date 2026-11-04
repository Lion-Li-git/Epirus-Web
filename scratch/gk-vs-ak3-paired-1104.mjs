/* 波 E′ 判读（11-04 千问）：`guardSpam` 上训练桌到底把 G5 那一格买下来没有？
 * 预登记在 `PREREG-2026-11-04-G5-CLOSING-qoder.md` §十二：
 *   主判据 = 按种子**配对**的 G5 最坏格（防席夺冠，关档口径）；
 *   成立线 = 三粒里 **≥2 粒** GK 比同种子 AK3 低 ≥10pt，且这些粒的 G4 最克格不恶于 AK3。
 * 读数来源两档（都在这把尺的条款内）：
 *   ① 11-04 14:3x 之后的回执有 `G4/G5 逐格数字（PASS 也印）` ⇒ 过线的包也有数（AK3-s7 靠这条才有 15/20）；
 *   ② 更早的回执**只有 FAIL 才印数** ⇒ 过线的格读不出，**不许补 0**。
 * ⚠ 分母只有 3 粒，且两批的**唯一差别是一型对手上桌**（其余配方逐字同）⇒ 判的是这一根杠杆的方向，不是"哪枚包好"。
 * 用法：node scratch/gk-vs-ak3-paired-1104.mjs
 *       读数落 scratch/gk-1104/paired-g5.tsv
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const REPO = 'D:/code/Epirus-Web';
const FILES = {
  /* seed → 两批回执。AK3-s7 用带 margins 的那份（n300 同剂量，可配对）。 */
  7: { ak3: 'scratch/margins-1104/AK3-s7-n300.txt', gk: 'scratch/promote-1104/GK-s7.txt' },
  13: { ak3: 'scratch/promote-1104/AK3-s13.txt', gk: 'scratch/promote-1104/GK-s13.txt' },
  41: { ak3: 'scratch/promote-1104/AK3-s41.txt', gk: 'scratch/promote-1104/GK-s41.txt' },
};

/* 一格的两档来源：先读"逐格数字"（PASS/FAIL 都印），退回 FAIL bullet（只有红才印）。 */
function cells(t, gate) {
  const out = {};
  const reMarg = new RegExp('\\b' + gate + '\\[([^\\]]*)/(long|multi)\\]\\s*(?:最克「[^」]*」|防席夺冠)\\s*([0-9.]+)%/\\d+%', 'g');
  for (const m of t.matchAll(reMarg)) out[m[2]] = Number(m[3]);
  if (gate === 'G5') {
    const reFail = /G5\[(.+?)\/(long|multi)\][^\n]*?实测防席夺冠 ([0-9.]+)%/g;
    for (const m of t.matchAll(reFail)) if (out[m[2]] === undefined) out[m[2]] = Number(m[3]);
  } else {
    const reFail = /G4\[(.+?)\/(long|multi)\][^\n]*?最克「([^」]+)」\s*([0-9.]+)%/g;
    for (const m of t.matchAll(reFail)) if (out[m[2]] === undefined) out[m[2]] = Number(m[4]);
  }
  return out;
}
const worst = (c) => (Object.keys(c).length ? Math.max(...Object.values(c)) : null);
const nBlock = (t) => { const m = /体检未过（(\d+) 项阻断条件）/.exec(t); if (m) return +m[1];
  return /体检通过|自检通过/.test(t) ? 0 : null; };

const rows = [];
for (const seed of Object.keys(FILES)) {
  const r = { seed, ok: true };
  for (const side of ['ak3', 'gk']) {
    const p = FILES[seed][side];
    if (!existsSync(REPO + '/' + p)) { r.ok = false; r[side + 'Note'] = '回执不在盘上（' + p + '）'; continue; }
    const t = readFileSync(REPO + '/' + p, 'utf8');
    if (!/^== 换前体检：/.test(t)) { r.ok = false; r[side + 'Note'] = '首行不是体检表头 ⇒ 这不是回执'; continue; }
    r[side + 'Block'] = nBlock(t);
    r[side + 'G5'] = worst(cells(t, 'G5'));
    r[side + 'G4'] = worst(cells(t, 'G4'));
    r[side + 'src'] = /逐格数字/.test(t) ? '逐格数字(含 PASS)' : 'FAIL bullet(过线格无读数)';
  }
  if (r.ok && r.ak3G5 !== null && r.gkG5 !== null) r.dG5 = +(r.gkG5 - r.ak3G5).toFixed(1);
  if (r.ok && r.ak3G4 !== null && r.gkG4 !== null) r.dG4 = +(r.gkG4 - r.ak3G4).toFixed(1);
  rows.push(r);
}

const L = [];
L.push('波 E′ 配对判读（预登记线：≥2 粒 ΔG5 ≤ −10pt 且这些粒 ΔG4 ≤ 0）· 生成 ' + new Date().toISOString().slice(0, 16));
L.push('seed  AK3 G5‖G4      GK G5‖G4        ΔG5   ΔG4   阻断 AK3→GK   读数来源');
for (const r of rows) {
  if (!r.ok) { L.push(String(r.seed).padEnd(5) + '  未配对：' + (r.ak3Note || r.gkNote || '')); continue; }
  const f = (v) => (v === null || v === undefined ? ' —' : ' ' + String(v).padStart(5));
  L.push(String(r.seed).padEnd(5) +
    f(r.ak3G5) + f(r.ak3G4) + '   ' + f(r.gkG5) + f(r.gkG4) + '   ' +
    (r.dG5 === undefined ? '  —' : (r.dG5 >= 0 ? '+' : '') + r.dG5) + '  ' +
    (r.dG4 === undefined ? '  —' : (r.dG4 >= 0 ? '+' : '') + r.dG4) + '   ' +
    r.ak3Block + '→' + r.gkBlock + '        ' + (r.ak3src === r.gksrc ? r.ak3src : r.ak3src + ' / GK: ' + r.gksrc));
}
const judged = rows.filter(r => r.ok && r.dG5 !== undefined);
const win = judged.filter(r => r.dG5 <= -10 && (r.dG4 === undefined || r.dG4 <= 0));
const worse = judged.filter(r => r.dG5 >= 10);
L.push('');
L.push('可配对 ' + judged.length + '/3 粒 ⇒ 判据读数：赢(Δ≤−10 且 G4 不恶) ' + win.length + ' 粒 ‖ 输(Δ≥+10) ' + worse.length + ' 粒 ‖ 其余噪声内');
L.push(win.length >= 2 ? '⇒ **成立**：guardSpam 上桌把 G5 买下来了（与 10-24 gunFocus 买 G4 同族 ⇒ "上哪型原型修哪格"第二次独立确认）'
  : (judged.length < 3 ? '⇒ **读不出**：配对分母只有 ' + judged.length + ' 粒（缺的那粒按三态写"未测到"，不写"无效"）'
    : '⇒ **不成立**：guardSpam 没有复现"上桌原型单目标" ⇒ 与 10-26 DS 三臂那次"只防御反而更差(75.3/80.3)"并列进"别再往这格加臂"的名单'));
const out = L.join('\n') + '\n';
console.log(out);
writeFileSync(REPO + '/scratch/gk-1104/paired-g5.tsv',
  '# 自动生成：node scratch/gk-vs-ak3-paired-1104.mjs（判据先写在 PREREG §十二，跑完不许改）\n' + out, 'utf8');
console.log('→ 读数已落 scratch/gk-1104/paired-g5.tsv');
