#!/bin/bash
cd /d/code/Epirus-Web
(node champion-map/eps-full.mjs --games=120 --epsTier=lv:regular --jobs=8 --extra=extra-all-1107.tsv --onlyExtra --only=_only-pool-1107.txt --out=epsfull-val-multi-1107.tsv > scratch/zcode-1106/val-multi.log 2>&1; echo "multi rc=$?" >> scratch/zcode-1106/val-multi.log) &
(node champion-map/eps-full.mjs --games=120 --epsTier=lv:regular --jobs=8 --mode=long --extra=extra-all-1107.tsv --onlyExtra --only=_only-pool-1107.txt --out=epsfull-val-long-1107.tsv > scratch/zcode-1106/val-long.log 2>&1; echo "long rc=$?" >> scratch/zcode-1106/val-long.log) &
wait
echo VAL-BOTH-DONE
