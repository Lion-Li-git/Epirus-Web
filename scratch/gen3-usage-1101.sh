#!/usr/bin/env bash
# 代 3 候选的同款剖面（与 pool-usage 同一把尺、同一考卷档）
set -u
cd /d/code/Epirus-Web || exit 1
OUT=scratch/gen3-usage-1101.tsv
printf "id\ttier\t1st\t出手种类\t" > "$OUT"
KEYS=(ジ 大雷 聚能环 电磁炮 激光眼 小雷 过载炮 枪 狙击 转移 防御 蓄能 藤甲 八卦 全息 地雷 净化 反伤 原型制御)
for k in "${KEYS[@]}"; do printf "%s\t" "$k" >> "$OUT"; done
printf "费用档\n" >> "$OUT"
for x in GD3-RATION CAP-ration-s7 CAP-ration-s13 RICH-b41-s13 BROAD-tkCH-s41 BROAD-tkCH-s7 GD3-RING GD3-LASER2 gd3b-ks-sb RB2P-s13 GD3-BIGT3; do
  o=$(node tools/eval-5p.mjs 12 5 77000 "scratch/arms/$x.bak" 2>/dev/null)
  f=$(echo "$o" | grep -oE '^\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
  d=$(echo "$o" | grep -oE '出手种类=[0-9]+' | head -1 | cut -d= -f2)
  blk=$(echo "$o" | sed -n '/分布（前 12）/,/耗时/p')
  line="$x\tg3\t$f\t$d"
  for k in "${KEYS[@]}"; do
    v=$(echo "$blk" | grep -E "^ +$k " | head -1 | grep -oE '[0-9.]+%' | head -1)
    line="$line\t${v:--}"
  done
  echo -e "$line" >> "$OUT"
  printf "[%-16s] 1st=%-6s 种类=%s\n" "$x" "$f" "$d" >&2
done
echo "### 代 3 侧写完 → $OUT" >&2
