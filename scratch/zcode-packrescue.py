# -*- coding: utf-8 -*-
"""zcode-packrescue.py —— 指定时间窗+会话内找含包正文的工具结果行（KDO5 抢救）
用法：python -I scratch/zcode-packrescue.py <t0ms> <t1ms> [最小KB=20]
"""
import io, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
DB = r'C:/Users/14765/.zcode/cli/db/db.sqlite'
T0, T1 = int(sys.argv[1]), int(sys.argv[2])
MINKB = int(sys.argv[3]) if len(sys.argv) > 3 else 20
con = sqlite3.connect(DB)
con.text_factory = lambda b: b.decode('utf-8', errors='replace')
n = 0
for row in con.execute('select rowid, time_created, length(data), data from part where session_id like \'%ef8b557%\' and time_created between ? and ? order by rowid', (T0, T1)):
    if row[2] < MINKB * 1024:
        continue
    d = row[3]
    if 'EPIRUS_CHAMPION_3P = {"' not in d and 'EPIRUS_CHAMPION_3P = {\\' not in d:
        continue
    n += 1
    i = d.find('EPIRUS_CHAMPION_3P = {')
    print('== rowid=%s t=%s len=%dkB' % (row[0], row[1], row[2] // 1024))
    print('   上下文头: ', d[max(0, i - 260):i + 60].replace('\n', ' ')[-320:])
print('total', n)
