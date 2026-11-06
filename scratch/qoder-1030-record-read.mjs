/* 只读：把 game-record 的纯文本记录读成行为账（被测席出手直方图 / 违约 / 被挡 / 结果）
   代 2 新落的 6 份 + DS 10-30 留的代 1 记录并排，看"这包到底怎么打"而不是只看聚合分 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'results';
const files = [];
for (const d of readdirSync(ROOT)) {
  const p = join(ROOT, d);
  if (!statSync(p).isDirectory()) continue;
  if (!/^(GEN2|BONS|LEX|RATS|v7|CB|PERN)/.test(d)) continue;
  for (const f of readdirSync(p)) if (f.endsWith('.txt')) files.push({ dir: d, path: join(p, f), file: f });
}

const rows = [];
for (const it of files) {
  const txt = readFileSync(it.path, 'utf8').split('\n');
  const head = txt.slice(0, 4).join('\n');
  const focus = (head.match(/被测席=(\d+)/) || [])[1];
  const temp = (head.match(/温度=([\d.]+)/) || [])[1];
  const seatLine = (txt.find((l) => l.startsWith('坐席=')) || '');
  const opps = seatLine.split('‖').filter((s) => s.indexOf('【被测】') < 0).map((s) => (s.match(/\(([^)]+)\)/) || [])[1]).filter(Boolean);
  const keys = {};
  let acts = 0, weiYue = 0, blockedMe = 0, iBlock = 0, myDmgEvents = 0, jiActs = 0;
  for (const l of txt) {
    const m = l.match(/第 (\d+) 回合：(.*)/);
    if (m && focus) {
      const parts = m[2].split(/ {1,}/).filter((x) => x.startsWith('玩家' + focus + '='));
      for (const p of parts) {
        const k = (p.match(/【([^】]+)】/) || [])[1];
        if (!k) continue;
        acts++;
        const name = k.split('→')[0];
        keys[name] = (keys[name] || 0) + 1;
        if (name === 'ジ') { jiActs++; continue; }
        keys[name] = keys[name] || 0;
      }
    }
    if (l.indexOf('挑衅违约') >= 0 && l.indexOf('玩家' + focus) >= 0) weiYue++;
    if (l.indexOf('挡下') >= 0) { if (l.indexOf('玩家' + focus) >= 0) iBlock++; }
    if (l.indexOf('💥 玩家' + focus) >= 0) blockedMe++;
  }
  const resLine = txt.filter((l) => l.startsWith('结果：')).pop() || '(没有结果行)';
  const hpLine = txt.filter((l) => l.startsWith('血量=')).pop() || '';
  const rounds = (resLine.match(/共 (\d+) 回合/) || [])[1];
  const won = resLine.indexOf('玩家' + focus + ' 获胜') >= 0;
  const myHp = (hpLine.match(new RegExp('玩家' + focus + ':([-\\d.]+)')) || [])[1];
  const nonJi = acts - jiActs;
  const nz = Object.entries(keys).filter(([k]) => k !== 'ジ').sort((a, b) => b[1] - a[1]);
  const nonJiReal = nz.reduce((a, x) => a + x[1], 0);
  const top = nz.slice(0, 4).map(([k, v]) => k + ' ' + (nonJiReal ? (100 * v / nonJiReal).toFixed(0) : '0') + '%');
  const lastSeen = txt.reduce((acc, l) => { const m = l.match(/^第 (\d+) 回合：(.*)/); return (m && focus && m[2].indexOf('玩家' + focus + '=') >= 0) ? Number(m[1]) : acc; }, 0);
  const kindsReal = nz.length;
  rows.push({
    tag: it.dir + '/' + it.file, temp, n: (seatLine.match(/玩家/g) || []).length,
    result: (won ? '胜' : '未胜') + ' ' + (rounds || '?') + '回合 我血量=' + (myHp == null ? '?' : myHp),
    acts, 单卡: top[0] || '—', 次卡: top[1] || '—', 出手种数: kindsReal, 非ジ: nonJiReal, 活到回合: lastSeen + '/' + (rounds || '?'),
    违约: weiYue, 我挡下: iBlock, 我受伤手: blockedMe, opps: opps.slice(0, 4).join(',')
  });
}
console.log('记录数=' + rows.length);
for (const r of rows) {
  console.log('\n· ' + r.tag + '  ‖ t=' + r.temp + ' ‖ 席位 ' + r.n + ' ‖ ' + r.result);
  console.log('   出手 ' + r.acts + ' 手（非ジ ' + r.非ジ + '）‖ 用到 ' + r.出手种数 + ' 种 ‖ 单卡 ' + r.单卡 + ' ‖ 次卡 ' + r.次卡 + ' ‖ ' + r.活到回合 +
    ' ‖ 挑衅违约 ' + r.违约 + ' 次 ‖ 我挡下 ' + r.我挡下 + ' ‖ 我受伤事件 ' + r.我受伤手);
  console.log('   对手（前 4 席）：' + r.opps);
}
