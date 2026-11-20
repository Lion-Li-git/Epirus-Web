# -*- coding: utf-8 -*-
"""zcode-bigrows.py —— zcode db 里找超大的含包正文行（pack 内容抢救）
用法：python -I scratch/zcode-bigrows.py [最小KB=40] [关键字=可选]
"""
import io, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
DB = r'C:/Users/14765/.zcode/cli/db/db.sqlite'
MINKB = int(sys.argv[1]) if len(sys.argv) > 1 else 40
KW = sys.argv[2] if len(sys.argv) > 2 else None
con = sqlite3.connect(DB)
con.text_factory = lambda b: b.decode('utf-8', errors='replace')
n = 0
for row in con.execute('select rowid, session_id, time_created, length(data), data from part order by rowid'):
    if row[3] < MINKB * 1024:
        continue
    d = row[4]
    if 'EPIRUS_CHAMPION_3P =' not in d:
        continue
    if KW and KW not in d:
        continue
    n += 1
    print('== rowid=%s sess=%s t=%s len=%dkB  头: %s' % (row[0], (row[1] or '')[:12], row[2], row[3] // 1024, d[d.find('EPIRUS_CHAMPION_3P'):d.find('EPIRUS_CHAMPION_3P') + 90].replace('\n', ' ')))
print('total', n)
