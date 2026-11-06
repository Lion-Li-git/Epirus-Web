const fs = require('fs');
const p = 'docs/research/RESULTS-2026-11-01-NIGHT2-zcode.md';
let s = fs.readFileSync(p, 'utf8');
const add = [

'## 七、P-DIV（02:0x）与 BROAD 复现补粒',
'',
'| 臂 | 配置 | 产品 1st | 广度 | 判 |',
'|---|---|---|---|---|',
'| DIV-s7 | BROAD-tkCH 起 + 产品卷 CEM + `--arenaDivK=0.03` | 21.2%（**塌**） | 15 | P-DIV1 败 |',
'| DIV-s13 | 同上 | **43.3%**（+2.8） | 13 | P-DIV1 差 1.7pt 未达；P-DIV2 过 |',
'',
'⇒ 多样性正则**保广度有效**（本职），但塌陷风险仍在（seed 7 三连塌：BROAD/CMXC/DIV 的产品卷臂）。塌陷的种子聚集（7 塌 13 不塌，跨三个起点）值得白天造"周期 holdout 快照"仪器钉时刻。',
'',
'## 八、3P 读数补全（01:4x）',
'',
'| 包 | 5P | 3P | 广度 |',
'|---|---|---|---|',
'| v7 | 56.9 | **71.2** | 11+ |',
'| RB2P-s13 | **64.0** | 62.6 | 3 |',
'| BROAD-tkCH-s7 | 40.5 | **57.9** | 15 |',
'',
'⇒ 两包互不 dominate v7（RB2P 输 3P 8.6pt、BROAD 输 13.3pt）——"双模式全超 v7"今晚没到；池或更强教师是白天的题。',
''
].join('\n');
s += add;
fs.writeFileSync(p, s);
console.log('backfilled');
