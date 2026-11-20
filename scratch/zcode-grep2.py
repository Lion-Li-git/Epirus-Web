# -*- coding: utf-8 -*-
"""zcode-grep2.py —— zcode db 按关键字检索（带时间与会话 id，全表流式）
用法：python -I scratch/zcode-grep2.py <关键字> [最大命中=20]
"""
import io, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
DB = r'C:/Users/14765/.zcode/cli/db/db.sqlite'
KW = sys.argv[1]
MAXH = int(sys.argv[2]) if len(sys.argv) > 2 else 20
con = sqlite3.connect(DB)
con.text_factory = lambda b: b.decode('utf-8', errors='replace')
n = 0
for tab in ('part', 'message'):
    cols = [r[1] for r in con.execute('pragma table_info(%s)' % tab)]
    if 'data' not in cols:
        continue
    for row in con.execute('select rowid, session_id, time_created, data from %s' % tab):
        blob = row[3] or ''
        if KW in blob:
            n += 1
            i = blob.find(KW)
            print('== %s rowid=%s sess=%s t=%s' % (tab, row[0], (row[1] or '')[:12], row[2]))
            print(blob[max(0, i - 500):i + 320].replace('\n', ' ⏎ ')[-800:])
            if n >= MAXH:
                sys.exit(0)
print('total hits', n)
