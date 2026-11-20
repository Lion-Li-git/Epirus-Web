# -*- coding: utf-8 -*-
"""dump-dsh-all.py —— dsh 会话全部 tool-call（不限 bash，含 Write/Edit）导出
用法：python -I scratch/dump-dsh-all.py <zstd路径> <输出.txt>
"""
import io, json, sys, subprocess

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
f, out = sys.argv[1], sys.argv[2]
r = subprocess.run(['python', '-I', '-c',
    "import zstandard,sys;sys.stdout.reconfigure(encoding='utf-8',errors='replace');"
    "sys.stdout.buffer.write(zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb'),read_across_frames=True).read())",
    f], capture_output=True, timeout=300)
t = r.stdout.decode('utf-8', errors='replace')
n = 0
seen = set()
with io.open(out, 'w', encoding='utf-8', newline='\n') as w:
    for line in t.split('\n'):
        line = line.strip()
        if not line.startswith('{'):
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        d = o.get('data') or {}
        if o.get('type') != 'tool/call':
            continue
        args = d.get('arguments')
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        if not isinstance(args, dict):
            continue
        body = args.get('command') or args.get('content') or args.get('new_string') or json.dumps(args, ensure_ascii=False)
        if not body or len(body) < 12:
            continue
        key = (d.get('name') or '?') + body[:160]
        if key in seen:
            continue
        seen.add(key)
        n += 1
        w.write('#### name=%s seq=%s turn=%s\n%s\n\n' % (d.get('name'), d.get('seq'), d.get('turn'), body))
print('dumped', n, 'unique tool calls ->', out)
