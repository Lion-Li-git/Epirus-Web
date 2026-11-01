#!/bin/bash
# GA 审计电池（ZCode · 11-01）：9 支臂终产物 + 2 起点，同一把尺
# 每包 5 读数：5P / 3P / gunwall / skill-mastery / breadth2
cd /d/code/Epirus-Web
OUT=scratch/GA-AUDIT-1101.tsv
LOGD=scratch/ga-audit-logs
mkdir -p $LOGD
echo -e "pack\tp5\tp3\tgunwall\tavgRound_gunwall" > $OUT
for p in GA-ration-s7 GA-ration-s13 GA-ration-s41 GA-broad-s7 GA-broad-s13 GA-broad-s41 GA-cold-s7 GA-cold-s13 GA-cold-s41 GD3-RATION BROAD-tkCH-s41; do
  if [ -f scratch/ga-arms/$p.js ]; then PACK=scratch/ga-arms/$p.js; else PACK=scratch/arms/$p.bak; fi
  [ -f "$PACK" ] || { echo "$p MISSING"; continue; }
  node tools/eval-5p.mjs 12 5 77000 "$PACK" > $LOGD/$p-5p.log 2>&1
  node tools/eval-5p.mjs 12 3 77000 "$PACK" > $LOGD/$p-3p.log 2>&1
  node tools/eval-5p.mjs 12 5 77000 "$PACK" --field=gunwall > $LOGD/$p-gunwall.log 2>&1
  node tools/proto2/skill-mastery.mjs --pack="$PACK" > $LOGD/$p-mastery.log 2>&1
  node tools/proto2/breadth2.mjs --pack="$PACK" > $LOGD/$p-breadth2.log 2>&1
  echo "$p done"
done
echo ALL-DONE
