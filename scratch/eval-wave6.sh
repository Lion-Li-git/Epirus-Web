#!/usr/bin/env bash
# 波次 6 验收：RB-1 强度 / RB-2 三线保住 / RB-3 gunwall 洞 / RB-4 出手剂量轴
set -u
cd /d/code/Epirus-Web || exit 1
for p in RICH-ration-s7 RICH-ration-s13 CTRL-ration-s7 CTRL-ration-s13 GD3-RATION; do
  f=scratch/arms/$p.bak; [ -f "$f" ] || { echo "⚠ 没有 $p"; continue; }
  node tools/proto2/skill-mastery.mjs --pack=$f --games=40 --out=scratch/mt-$p.json > scratch/mastery-$p.log 2>&1
  lines=$(grep -E "会聚能环|会大雷|会电磁炮|会激光眼" scratch/mastery-$p.log | tr -s ' ' | cut -c1-46 | tr '\n' '/')
  v5=$(node tools/eval-5p.mjs 12 5 77000 $f 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  v3=$(node tools/eval-5p.mjs 12 3 77000 $f 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  gw=$(node tools/eval-5p.mjs 40 5 77000 $f --field=gunwall 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  tg=$(node tools/eval-5p.mjs 40 5 77000 $f --field=targeter 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  sp=$(node tools/eval-5p.mjs 40 5 77000 $f --field=sniperwall 2>/dev/null | grep -oE '1st=[0-9.]+'|head -1|cut -d= -f2)
  br=$(node tools/proto2/breadth2.mjs --pack=$f 2>/dev/null | sed -n '4p' | tr -s ' ')
  printf "%-16s 5P=%-6s 3P=%-6s gunwall=%-6s targeter=%-6s sniper=%-6s\n  线: %s\n  剖面: %s\n" "$p" "$v5" "$v3" "$gw" "$tg" "$sp" "$lines" "$br"
done
echo "### done $(date +%H:%M:%S)"
