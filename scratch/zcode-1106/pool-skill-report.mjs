/* C：池 20 枚逐包 skill report → 一张 TSV 表（使用率 per 技能 + 富经济 Δ）
 * ZCode 11-06 夜 · PLAN §C。口径：tools/skill-report.mjs 原样、每包 5 局/组（--champ 指池包）。
 * 输出 scratch/zcode-1106/skill-report-pool-1106.tsv + 控制台摘要。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const pool = readFileSync('champion-map/pool-members.tsv', 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const ph = Object.fromEntries(pool[0].map((x, i) => [x, i]));
const members = pool.slice(1).map(r => ({ id: r[ph.id], tier: r[ph.tier], path: r[ph.path] })).filter(m => m.id);

const out = [];
for (const m of members) {
  let t = '';
  try {
    t = execFileSync(process.execPath, ['tools/skill-report.mjs', '5', '5', '--champ=' + m.path],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 420000, maxBuffer: 1 << 24 });
  } catch (e) { t = String(e.stdout || '') + String(e.stderr || ''); console.log(m.id, 'report 失败 rc=' + e.status); }
  // 解析：卡片行 = 「名 费用= N 使用= X% 富经济1st= Y% Δ=Zpt」
  const perSkill = {};
  for (const mm of t.matchAll(/(\S+)\s+费用=\s*(\S+)\s+使用=\s*([\d.]+)%\s+富经济1st=\s*([\d.]+)%\s+Δ=\s*(-?[\d.]+)pt/g)) {
    perSkill[mm[1]] = { cost: mm[2], use: +mm[3], rich1st: +mm[4], delta: +mm[5] };
  }
  const decision = /使用率采样：决策=(\d+)/.exec(t);
  out.push({ id: m.id, tier: m.tier, decisions: decision ? +decision[1] : 0, skills: perSkill });
  console.log(m.id.padEnd(20), '决策', decision ? decision[1] : '?', '| 技能种', Object.keys(perSkill).length);
}
// 汇总表：行=包，列=技能（按全池使用率均值排序）
const allSkills = {};
for (const r of out) for (const [k, v] of Object.entries(r.skills)) { (allSkills[k] = allSkills[k] || []).push(v.use); }
const skillOrder = Object.entries(allSkills).sort((a, b) => b[1].reduce((s, x) => s + x, 0) / b[1].length - a[1].reduce((s, x) => s + x, 0) / a[1].length).map(e => e[0]);
const hdr = ['id', 'tier', 'decisions', ...skillOrder.map(s => s + '使用%'), ...skillOrder.map(s => s + '富Δpt')].join('\t');
const lines = [hdr];
for (const r of out) {
  lines.push([r.id, r.tier, r.decisions,
    ...skillOrder.map(s => r.skills[s] ? r.skills[s].use.toFixed(1) : '0'),
    ...skillOrder.map(s => r.skills[s] ? r.skills[s].delta.toFixed(0) : '-')].join('\t'));
}
writeFileSync('scratch/zcode-1106/skill-report-pool-1106.tsv', lines.join('\n') + '\n');
console.log('写 scratch/zcode-1106/skill-report-pool-1106.tsv（' + out.length + ' 行 × ' + (skillOrder.length * 2 + 3) + ' 列）');
