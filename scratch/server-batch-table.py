# -*- coding: utf-8 -*-
"""server-batch-table.py —— server 系缺失包按批聚类（id 前缀=批；lineage 配置列）
输出 scratch/v7-mined/server-batches.tsv: batch<TAB>id<TAB>seed<TAB>ts<TAB>oppsN<TAB>gens<TAB>mode<TAB>eraHint
"""
import io, collections

ids = []
with io.open('champion-map/data/page/lineage.tsv', encoding='utf-8') as f:
    hdr = f.readline().rstrip('\n').split('\t')
    ix = {h: i for i, h in enumerate(hdr)}
    led = {}
    with io.open('docs/ARTIFACT-LOSS-1119.tsv', encoding='utf-8') as f2:
        f2.readline()
        for ln in f2:
            c = ln.rstrip('\n').split('\t')
            if len(c) >= 4:
                led[c[0]] = c[2]
    reg_fam = {}
    with io.open('champion-map/data/registry.tsv', encoding='utf-8') as f3:
        h3 = f3.readline().rstrip('\n').split('\t')
        i3 = {h: i for i, h in enumerate(h3)}
        for ln in f3:
            c = ln.rstrip('\n').split('\t')
            if len(c) > i3['fam']:
                reg_fam[c[0]] = c[i3['fam']]
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) < 27:
            continue
        pid = c[0]
        if led.get(pid) != 'missing':
            continue
        fam = reg_fam.get(pid, '?')
        if fam not in ('1', '2', '3', '4', '5', '6'):
            continue
        # 批前缀 = id 去掉 -seed 后缀（末段是数字/seed 名）
        base = pid.rsplit('-', 1)[0] if '-' in pid else pid
        ids.append((fam, base, pid, c[4], c[3], c[ix['oppsN']], c[ix['gens']], c[ix['mode']]))

groups = collections.defaultdict(list)
for fam, base, pid, seed, ts, oppsN, gens, mode in ids:
    groups[(fam, base)].append((pid, seed, ts, oppsN, gens, mode))
print('批数', len(groups), '包数', len(ids))
out = io.open('scratch/v7-mined/server-batches.tsv', 'w', encoding='utf-8', newline='\n')
out.write('fam\tbatch\tn\tpids\tseeds\tts_min\tts_max\toppsN_set\tgens_set\tmode_set\n')
for (fam, base), lst in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])):
    tsmin = min(x[2] for x in lst)
    tsmax = max(x[2] for x in lst)
    out.write('%s\t%s\t%d\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' % (
        fam, base, len(lst),
        ','.join(x[0] for x in lst[:12]) + ('…' if len(lst) > 12 else ''),
        ','.join(x[1] for x in lst[:14]) + ('…' if len(lst) > 14 else ''),
        tsmin[:16], tsmax[:16],
        ','.join(sorted(set(x[3] for x in lst))),
        ','.join(sorted(set(x[4] for x in lst))),
        ','.join(sorted(set(x[5] for x in lst)))))
    print('fam %s %-14s n=%-3d ts %s→%s oppsN=%s gens=%s e.g. %s' % (
        fam, base, len(lst), tsmin[:10], tsmax[:10],
        ','.join(sorted(set(x[3] for x in lst)))[:18],
        ','.join(sorted(set(x[4] for x in lst)))[:14], lst[0][0]))
out.close()
print('→ scratch/v7-mined/server-batches.tsv')
