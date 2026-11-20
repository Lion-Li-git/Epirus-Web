# -*- coding: utf-8 -*-
"""zcode-window.py —— 按行号窗 dump 会话行（看 make-seed5 执行上下文）
用法：python -I scratch/zcode-window.py <rowid0> <rowid1>
"""
import io, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
DB = r'C:/Users/14765/.zcode/cli/db/db.sqlite'
A, B = int(sys.argv[1]), int(sys.argv[2])
con = sqlite3.connect(DB)
con.text_factory = lambda b: b.decode('utf-8', errors='replace')
for row in con.execute('select rowid, time_created, data from part where rowid between ? and ? order by rowid', (A, B)):
    d = row[2] or ''
    typ = '"type":"?'
    i = d.find('"type":"')
    if i >= 0:
        typ = d[i:i + 24]
    # 只打印命令行/结果首行，避免刷屏
    kind = ''
    for k in ('"command":"', '"output":"', '"text":"'):
        j = d.find(k)
        if j >= 0:
            kind = d[j:j + 240]
            break
    print('--- rowid=%s t=%s %s' % (row[0], row[1], typ))
    if kind:
        print('    ', kind[:230].replace('\\n', ' ⏎ '))
