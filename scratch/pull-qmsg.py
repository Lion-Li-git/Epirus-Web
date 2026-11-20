# -*- coding: utf-8 -*-
"""pull-qmsg.py —— 从 qoder transcript 按 message uuid 抽 Write/bash input 全文
用法：python -I scratch/pull-qmsg.py <jsonl路径> <message-uuid> [输出.txt]
"""
import io, json, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
f, uid = sys.argv[1], sys.argv[2]
outp = sys.argv[3] if len(sys.argv) > 3 else None
found = 0
with io.open(f, encoding='utf-8', errors='replace') as fh:
    for line in fh:
        if uid not in line:
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        msg = o.get('message') or {}
        cont = msg.get('content') or []
        if isinstance(cont, dict):
            cont = [cont]
        for c in cont:
            if c.get('type') != 'tool_use':
                continue
            inp = c.get('input') or {}
            body = inp.get('content') or inp.get('command') or json.dumps(inp, ensure_ascii=False)
            found += 1
            print('===== tool_use %s (len %d) =====' % (c.get('id'), len(body)))
            print(body[:8000])
if outp and found:
    pass
print('found', found)
