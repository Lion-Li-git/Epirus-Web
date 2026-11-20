# -*- coding: utf-8 -*-
"""zcode-twindow.py —— 时间窗内的 bash 调用行（找某包的创建命令）
用法：python -I scratch/zcode-twindow.py <t0ms> <t1ms> <关键字>
"""
import io, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
DB = r'C:/Users/14765/.zcode/cli/db/db.sqlite'
T0, T1, KW = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
con = sqlite3.connect(DB)
con.text_factory = lambda b: b.decode('utf-8', errors='replace')
for row in con.execute('select rowid, time_created, data from part where time_created between ? and ? order by rowid', (T0, T1)):
    d = row[2] or ''
    if KW not in d:
        continue
    i = d.find('"command":"')
    if i < 0:
        continue
    cmd = d[i + 11:i + 700].replace('\\n', ' ⏎ ')
    if KW not in cmd and KW not in d[max(0, i - 200):i]:
        continue
    print('--- rowid=%s t=%s' % (row[0], row[1]))
    print('   ', cmd[:620])
