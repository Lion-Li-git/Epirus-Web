#!/usr/bin/env bash
# v7 冠军池 30 枚成员的**技能使用剖面**（产品考卷 5P 420 局，seed 77000）—— 对照代 3 候选
set -u
cd /d/code/Epirus-Web || exit 1
OUT=scratch/pool-usage-1101.tsv
printf "id\ttier\t1st\t出手种类\t" > "$OUT"
KEYS=(ジ 大雷 聚能环 电磁炮 激光眼 小雷 过载炮 枪 狙击 转移 防御 蓄能 藤甲 八卦 全息 地雷 净化 反伤 原型制御)
for k in "${KEYS[@]}"; do printf "%s\t" "$k" >> "$OUT"; done
printf "费用档\n" >> "$OUT"
n=0
while IFS=$'\t' read -r id tier path; do
  [ -n "$id" ] || continue
  o=$(node tools/eval-5p.mjs 12 5 77000 "$path" 2>/dev/null)
  f=$(echo "$o" | grep -oE '^\[冠军\] 1st=[0-9.]+' | head -1 | cut -d= -f2)
  d=$(echo "$o" | grep -oE '出手种类=[0-9]+' | head -1 | cut -d= -f2)
  blk=$(echo "$o" | sed -n '/分布（前 12）/,/耗时/p')
  line="$id\t$tier\t$f\t$d"
  for k in "${KEYS[@]}"; do
    v=$(echo "$blk" | grep -E "^ +$k " | head -1 | grep -oE '[0-9.]+%' | head -1)
    line="$line\t${v:--}"
  done
  cost=$(echo "$blk" | grep -oE '费用=[0-9?]+' | sort -u | tr -d '费用=' | tr '\n' ',')
  echo -e "$line\t$cost" >> "$OUT"
  n=$((n+1)); printf "[%2d/30] %-16s 1st=%-6s 种类=%s\n" "$n" "$id" "$f" "$d" >&2
done < <(awk -F'\t' 'NR>1{print $1"\t"$4"\t"$3}' champion-map/pool-members.tsv)
echo "### 写了 $n 枚 → $OUT" >&2
