/* 产品侧地面真值：从用户的实机对局记录（`results/**\/*.txt`）里，按**席位**统计行动构成。
 *
 * 为什么需要（2026-09-21 用户 + 千问 §23 + DS 实测三方撞到同一件事）：
 *   · 千问实测：同一包（现役）长程 5 席自对局，**两套口径差 4 倍**（ε=0 电磁炮 3.87/局 vs ε0.2 soft 0.93/局）⇒
 *     "**产品行为由探索主导**"，而所有"这个包学会了 X"的证据都是 ε=0 量的 ⇒ 对玩家不成立。
 *   · DS 实测（`results/31` 五局）：AI 四席里**防御类占 ≈24%**、电磁炮 **0.2 次/局** —— 比任何模拟装配都更"防御多"。
 *   · ⇒ **模拟替代不了产品**：真人席在场上时，威胁结构与 ep 节奏都不一样 ⇒ 唯一的地面真值是**用户实际打的局**。
 * 本工具把"看日志"变成可复现读数，供"能力项两栏都达标才算数"（千问 DOING-1）里的**第三栏：真机栏**。
 *
 * 用法：node tools/log-behavior.mjs [目录或文件...]（默认 results/ 下**递归**最新 5 个 .txt）
 * 口径：逐回合行的 `玩家N=【行动】`；AI 席默认取 2..5（可用 `--human=1` 改用户席位，`--seats=2,3,4,5` 改 AI 席）。
 * ⚠️ 只读：不写 results/，不改任何包。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SEAT_ARG = (function () {
  const h = process.argv.find(function (a) { return a.indexOf('--seats=') === 0; });
  if (h) return h.split('=')[1].split(',').map(Number);
  const hu = process.argv.find(function (a) { return a.indexOf('--human=') === 0; });
  const human = hu ? Number(hu.split('=')[1]) : 1;
  return [0, 1, 2, 3, 4].map(function (i) { return i + 1; }).filter(function (p) { return p !== human; });
})();
const WANT = process.argv.slice(2).filter(function (a) { return a.indexOf('--') !== 0; });

/* 能力项（与 skill-report / 门禁同名，便于三栏对照） */
const CAP = {
  '电磁炮': /电磁炮/,
  '蓄能': /蓄能/,
  '摄魂': /摄魂/,
  '激光眼': /激光眼/,
  '贴贴': /贴贴/,
  '天火': /天火/,
  '枪': /枪(?!法)/,
  '狙击枪': /狙击枪/,
  'ジ': /^ジ/
};
const DEF_KEY = /防御|反弹|八卦阵|原型制御|金钟|镜面/;

function list(dir) {
  const out = [];
  for (const nm of readdirSync(dir)) {
    const p = join(dir, nm);
    let st;
    try { st = statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) out.push.apply(out, list(p));
    else if (/\.txt$/.test(nm)) out.push({ p: p, t: st.mtimeMs });
  }
  return out;
}
let FILES = [];
for (const a of WANT) {                       // 参数既可以是文件，也可以是目录（含嵌套）
  let st;
  try { st = statSync(a); } catch (e) { throw new Error('读不到：' + a); }
  if (st.isDirectory()) FILES.push.apply(FILES, list(a).sort(function (x, y) { return x.t - y.t; }).map(function (o) { return o.p; }));
  else FILES.push(a);
}
if (!FILES.length) {
  FILES = list('results').sort(function (a, b) { return b.t - a.t; }).slice(0, 5).map(function (o) { return o.p; });
}
const cap = {}, all = {}, defTotal = { n: 0 };
let roundsAll = 0, games = 0;
console.log('=== 实机地面真值（AI 席 = ' + SEAT_ARG.join('/') + '）===');
for (const f of FILES) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  const per = {}, localCap = {};
  let rounds = 0;
  for (const ln of lines) {
    const m = /^第 (\d+) 回合：(.*)$/.exec(ln);
    if (!m) continue;
    rounds = Number(m[1]);
    const re = /玩家(\d)=【([^】]*)】/g;
    let x;
    while ((x = re.exec(m[2]))) {
      const pid = Number(x[1]), act = x[2];
      per[pid] = (per[pid] || 0) + 1;
      all[pid] = (all[pid] || 0) + 1;
      if (SEAT_ARG.indexOf(pid) < 0) continue;                       // 只统计 AI 席
      defTotal.n++;
      if (DEF_KEY.test(act)) defTotal.def = (defTotal.def || 0) + 1;
      for (const k in CAP) if (CAP[k].test(act)) {
        cap[k] = (cap[k] || 0) + 1; localCap[k] = (localCap[k] || 0) + 1;
      }
    }
  }
  games++; roundsAll += rounds;
  console.log('  ' + f.replace(/\\/g, '/') + '  (' + rounds + ' 回合)  ' +
    Object.keys(CAP).map(function (k) { return k + '=' + (localCap[k] || 0); }).join(' · '));
}
const r = function (n) { return (n / games).toFixed(2); };
console.log('\n=== ' + games + ' 局合计（AI 席 ' + SEAT_ARG.join('/') + ' · 均 ' + (roundsAll / games).toFixed(1) + ' 回合/局）===');
console.log('  ' + Object.keys(CAP).map(function (k) { return k + ' **' + r(cap[k] || 0) + '**/局'; }).join(' · '));
console.log('  防御类（防御/反弹/八卦/原型制御/金钟/镜面）**' + r(defTotal.def || 0) + '**/局 · 占 AI 出手 ' +
  (100 * (defTotal.def || 0) / Math.max(1, defTotal.n)).toFixed(1) + '%');
console.log('\n读法：这一栏 = "真机栏"。千问 DOING-1 要的是"能力项**两栏**（ε=0 与浏览器口径）都达标才写进上线理由"；');
console.log('      模拟替代不了产品（真人席在场时威胁结构与 ep 节奏都不同）⇒ 真机栏应是**第三个**必看列。');
