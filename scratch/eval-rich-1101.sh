#!/usr/bin/env bash
# RICH/CTRL 验收（PREREG-2026-11-01-OPPONENT-FACE §三 R-1..R-4）
set -u
cd /d/code/Epirus-Web || exit 1
PACKS="scratch/arms/RICH-b41-s7.bak scratch/arms/RICH-b41-s13.bak scratch/arms/RICH-rb2-s7.bak scratch/arms/RICH-rb2-s13.bak scratch/arms/CTRL-b41-s7.bak scratch/arms/CTRL-b41-s13.bak scratch/arms/BROAD-tkCH-s41.bak scratch/arms/gd3repro-OB3RB2s23.bak scratch/arms/RB2P-s13.bak"
echo "=== 5P / 3P（eval-5p，seed 77000）==="
for p in $PACKS js/bundled-champion-3p.js; do
  n=$(basename $p .bak)
  f5=$(node tools/eval-5p.mjs 12 5 77000 $p 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  f3=$(node tools/eval-5p.mjs 12 3 77000 $p 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
  printf "%-24s 5P=%-6s 3P=%s\n" "$n" "$f5" "$f3"
done
echo "=== 压力场（40 局/格：R-1 的 targeter+tank，R-4 观察的 mix4/focusfire/minespam）==="
for fld in targeter tank mix4 focusfire minespam; do
  printf "%-11s" "$fld"
  for p in $PACKS js/bundled-champion-3p.js; do
    r=$(node tools/eval-5p.mjs 40 5 77000 $p --field=$fld 2>/dev/null | grep '^\[冠军\]' | sed -E 's/.*1st=([0-9.]+)%.*/\1/')
    printf "%-9s" "$r"
  done
  echo
done
echo "=== 广度下限 B-1（breadth2 训练镜 120 局，锚 v7 同尺）==="
node tools/proto2/breadth2.mjs --pack=scratch/arms/RICH-b41-s7.bak,scratch/arms/RICH-b41-s13.bak,scratch/arms/RICH-rb2-s7.bak,scratch/arms/RICH-rb2-s13.bak,scratch/arms/CTRL-b41-s7.bak,scratch/arms/CTRL-b41-s13.bak,scratch/arms/BROAD-tkCH-s41.bak,scratch/arms/gd3repro-OB3RB2s23.bak,scratch/arms/RB2P-s13.bak --out=scratch/BREADTH2-RICH.json 2>&1 | tail -12
echo "=== done $(date +%H:%M:%S)"
