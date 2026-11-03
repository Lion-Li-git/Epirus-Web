#!/usr/bin/env node
/* night6-score13-table.mjs —— 16-lane × gen-3 校准表（ZCode · 11-04 凌晨）
 * 吃 scratch/night6/promote/*.txt + score13 逐条判语 ⇒ 一张 16 行 × N 包的 TSV + 每行校准注记。
 * 用法: node scratch/night6-score13-table.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/* 每包的 A 考卷强度实值（5P multi 200 局，seed 77000——§三十一 同源） */
const STRENGTH = { 'L5-1200-s13': 60.1, 'D-a-s13': 38.6, 'EFFG-s41': 52.7, 'GD3ALL-PUSHON-s41': 62.9, 'G5DEF-s41': 55.1, 'CB-s13': 26.0, 'GD3ALL-G5-8p-s41': 52.3, 'GD3ALL-NGA2R-s41': 10.4 };

const files = readdirSync('scratch/night6/promote').filter((f) => f.endsWith('.txt'));
const marks = {};
for (const f of files) {
  const pack = f.replace(/\.txt$/, '');
  const cmd = ['tools/score13.mjs', '--promote=scratch/night6/promote/' + f, '--strength=' + (STRENGTH[pack] != null ? STRENGTH[pack] : '55')];
  const r = spawnSync('node', cmd, { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  for (const m of out.matchAll(/^([✅❌◻])[\s　]+(\S+)/gm)) {
    marks[pack] = marks[pack] || {};
    marks[pack][m[2]] = m[1];
  }
  if (!marks[pack] || !Object.keys(marks[pack]).length) console.log('⚠ ' + pack + ' 判语解析为空（exit ' + r.status + '）');
}
const laneNames = ['坐哪个位置都一样能打', '交出去的动作没有被静默改写', '一局里真打得出伤害', '这局收得了场，不是一起耗到上限', '没人威胁时不是一直摆架势；出手防御时通常真有人来打', '被围殴时不是只攒钱不还手', '会用的招不止两三种', '对面都摆反弹时不是一枪不发', '对面都在攒钱不动时，能把人打死', '不会被一套固定操作连续吃掉', '有人往那一躺只防不还手时，它赢不赢得了', '攒下来的珠没有被囤成一堆过期废物', '玩家抽到它时赢不赢得了'];
const short = ['座', '废手', '伤', '平', '架', '还', '广', '墙', '场B', 'G4', 'G5', '珠', '强'];
const packs = Object.keys(marks);
let out = ['lane\t' + packs.join('\t')].join('\n') + '\n';
laneNames.forEach((nm, i) => {
  out += short[i] + '\t' + packs.map((p) => {
    const ks = Object.keys(marks[p]).filter((k) => k.indexOf(nm.slice(0, 6)) === 0);
    return ks.length ? marks[p][ks[0]] : '·';
  }).join('\t') + '\n';
});
out += '\n✅=过 ❌=不过 ◻=读不出 ·=该包没有这次判语\n';
out += '强度实值（--strength 入参，A 考卷尺）: ' + packs.map((p) => p + '=' + (STRENGTH[p] != null ? STRENGTH[p] : '?')).join(' ') + '\n';
writeFileSync('scratch/night6/score13-table.txt', out);
console.log(out);
