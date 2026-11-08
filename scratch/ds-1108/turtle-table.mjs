
const rows = [
  ['Q-s47（v7 教师）', 'sword 10% / gun 3% / bagua 13% / guard 13%', '6.00', '2.91', '34.8%'],
  ['U-s205（v7）', 'guard 26 / reflect 26 / bagua 25 / sword 6 / gun 2', '3.50', '0.00', '29.5%'],
  ['KDQ3-l（2.0 蒸馏 2000 步）', 'guard 71% / ji 18% / sword 5% / gun 2%', '4.00', '0.00', '19.4%'],
  ['CTRL2-Q-s7（2.0，图上前二）', 'reflect 91% / guard 4 / ji 4', '0.30', '0.00', '18.2%'],
  ['PASS2C-Q-s13（2.0，X̄₄ 0.52）', 'reflect 75% / ji 14% / holo 12%', '0.00', '0.00', '12.7%'],
];
console.log('| 包 | 对 4 个农民时的出手谱 | 伤害/局 | 场B 清场 | 场A 还手 |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log('| ' + r.join(' | ') + ' |');
