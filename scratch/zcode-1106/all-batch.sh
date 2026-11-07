#!/bin/bash
cd /d/code/Epirus-Web
(node champion-map/eps-full.mjs --games=120 --epsTier=lv:regular --jobs=8 --extra=extra-all-1107.tsv --out=epsfull-all-multi-1107.tsv > scratch/zcode-1106/all-multi.log 2>&1; echo "multi rc=$?" >> scratch/zcode-1106/all-multi.log) &
(node champion-map/eps-full.mjs --games=120 --epsTier=lv:regular --jobs=8 --mode=long --extra=extra-all-1107.tsv --out=epsfull-all-long-1107.tsv > scratch/zcode-1106/all-long.log 2>&1; echo "long rc=$?" >> scratch/zcode-1106/all-long.log) &
wait
echo ALL-BOTH-DONE
