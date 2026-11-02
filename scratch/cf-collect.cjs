/* cf-collect.cjs — 从 cf-arms-*.log / cf400-*.log 取「某一包·某世界·某档」的整行字段（同一行取数，列不会串）
 * 用法：node scratch/cf-collect.cjs <前缀> <包键> <n> <世界> <档名…>
 * ⚠ 剂量后缀是键的一部分（` 剂量 1/1`）——剥掉它会让 1/8 覆盖 1/1，本仓今天就这么错过整列。 */
const fs = require('fs');
const [pre, pack, n, world, ...cells] = process.argv.slice(2);
const file = 'scratch/' + pre + '-' + pack + '-n' + n + '.log';
if (!fs.existsSync(file)) { console.error('缺文件 ' + file); process.exit(1); }
const rows = {};
for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!l.includes(' | ')) continue;
  const c = l.split(' | ').map((x) => x.trim());
  if (c.length < 14 || c[0] !== world) continue;
  rows[c[1]] = c;
}
const g = (s, re) => { const m = String(s).match(re); return m ? m[1] : '—'; };
for (const cd of cells) {
  const x = rows[cd];
  if (!x) { console.error('缺档 ' + cd + '（有：' + Object.keys(rows).join(' / ') + '）'); continue; }
  console.log([pack + ' n=' + n + ' ' + world, cd, '夺1=' + x[2], '回合=' + x[3], '终局HP=' + x[4],
    '出该手=' + x[5], '挡下=' + x[8], '免伤=' + x[9], '我造伤=' + x[10], '存活%=' + x[11],
    '累计挨打=' + g(x[12], /^取([0-9.]+)/), '无来源=' + g(x[12], /无来源 (\S+?)）/), '活人=' + g(x[12], /活([0-9.]+)/)].join(' ‖ '));
}
