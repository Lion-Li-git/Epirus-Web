const fs = require('fs');
const p = 'docs/research/RESULTS-2026-11-01-NIGHT2-zcode.md';
let s = fs.readFileSync(p, 'utf8');
const add = [

'## 九、终账（02:2x）：miniT 四连探针终判 + BROAD 四种子定稿',
'',
'### miniT 稀有事件语义墙（四变体全探，负结果记档）',
'',
'| 变体 | miniT 用量 | 语义命中（需 ≥1/2） | 备注 |',
'|---|---|---|---|',
'| 门臂 ×3 种子 | 0（空臂） | — | 强吸引子里无 miniT 路径 |',
'| key 目标 | 15.0/局 ✔ | **1/34** | 用量过线语义不过 |',
'| cand 目标 | 40.0/局 ✔ | **4/57** | 经济被打破（浪费 60%） |',
'| +DAgger=2 | 0（稀释） | — | 稀有类被自访态淹没 |',
'| **rareOnly=0.7 靶向采集** | 152.5/局 | **11/133（8.3%）** | 教师态拟合 100%（含选靶）、自访态不迁移 ⇒ **协变量漂移的靶级版本** |',
'',
'⇒ miniT 选靶语义需要"自己分布上的靶向标签"。靶向采集仪器（`--rareOnly/--rareFrac`）已入库（对 ring 同样可用），',
'白天续方向 = DAgger×rare 组合（学生态+只收代理阳性）或 10× 组数。原件 `mastery-mt*.log`。',
'',
'### BROAD-tkCH 四种子定稿（tk-OB3CH 蒸馏 + mild CEM 24k）',
'',

'',
'⇒ 均值 ≈38.1、散布 22.6~53.1；**s41（53.1 + 广 14）已贴平纯链专家强度带**——"广而强"在 BROAD 线内首次出现。',
'种子散布仍大（广包与链包同病），引用必须带粒。',
''
].join('\n');
s += add;
fs.writeFileSync(p, s);
console.log('final backfilled');
