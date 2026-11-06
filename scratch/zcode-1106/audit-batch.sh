#!/bin/bash
# 新包入池前体检:promote --dry(阻断项+考卷) + feas allMulti(过线闸)。只读,不写任何包/槽。
cd /d/code/Epirus-Web
for id in CR8-s13 MX25-s13 CR4-s13 CTRL-s13 P8-s13; do
  echo "=== promote-dry $id $(date +%H:%M:%S) ==="
  node tools/promote-champion.mjs scratch/ga-arms/$id.js --dry > scratch/zcode-1106/promote-$id.log 2>&1
  echo "rc=$?"
done
echo AUDIT-DONE
