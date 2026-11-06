#!/bin/bash
cd /d/code/Epirus-Web || exit 3
mkdir -p docs/artifacts/2p0-pool
tail -n +2 scratch/qoder-1105-pool-g3.tsv | while IFS=$'\t' read -r bid bwid bpath btier brest; do
  [ -z "$bid" ] && continue
  if [ -f "$bpath" ]; then cp "$bpath" "docs/artifacts/2p0-pool/$bid.bak"; else echo "MISS $bid $bpath"; continue; fi
  echo "=== promote-dry $bid $(date +%H:%M:%S) ==="
  node tools/promote-champion.mjs "docs/artifacts/2p0-pool/$bid.bak" --dry > "scratch/zcode-1106/promote-$bid.log" 2>&1
  echo "rc=$?"
done
echo BAND20-AUDIT-DONE
