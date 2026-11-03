#!/usr/bin/env bash
# 带间直交四系列（预注册 §三十二：判线 ≥4pt 且 ≥2σ）
set -u
cd /d/code/Epirus-Web || exit 1
STRONG="scratch/night5/L5-1200-s13.js,scratch/night5/D1200-s13.js,scratch/night4/DSTR4-s13.js,scratch/night5/EFFG-s41.js,scratch/night5/EFFG-s5.js,scratch/night5/EFFG-s7.js,scratch/night3/GD3ALL-G5-8p-s41.js,scratch/night3/GD3ALL-PUSHON-s41.js,scratch/night5/G5DEF-s41.js,scratch/night3/GD3ALL-POPP-s17.js,scratch/night3/GD3ALL-POPP-s41.js"
WEAK="scratch/night3/GD3ALL-PUSHON-s13.js,scratch/night4/D-b-hpseed-s13.js,scratch/night4/D-a-s13.js,scratch/night3/GD3ALL-PLAIN-s13.js,scratch/night4/DDEF-s13.js,scratch/night4/DSTR-s13.js,scratch/night4/CB-s13.js,scratch/night4/LE-s13.js,scratch/night3/GD3ALL-G5-s13.js,scratch/night3/GD3ALL-NGA2R-s41.js"
MID="scratch/night3/GD3ALL-PUSHON-s41.js,scratch/night5/G5DEF-s41.js,scratch/night3/GD3ALL-POPP-s17.js,scratch/night3/GD3ALL-POPP-s41.js,scratch/night3/GD3ALL-PUSHON-s13.js,scratch/night4/D-b-hpseed-s13.js,scratch/night4/D-a-s13.js"
T3S="scratch/night5/L5-1200-s13.js,scratch/night5/D1200-s13.js,scratch/night4/DSTR4-s13.js,scratch/night5/EFFG-s41.js,scratch/night5/EFFG-s5.js,scratch/night5/EFFG-s7.js,scratch/night3/GD3ALL-G5-8p-s41.js"
T3W="scratch/night3/GD3ALL-PLAIN-s13.js,scratch/night4/DDEF-s13.js,scratch/night4/DSTR-s13.js,scratch/night4/CB-s13.js,scratch/night4/LE-s13.js,scratch/night3/GD3ALL-G5-s13.js,scratch/night3/GD3ALL-NGA2R-s41.js"
: > scratch/night6/h2h.txt
node scratch/night6-h2h.mjs --label="两带直交·强vs弱（5P long）" --mode=long --games=400 --seed=91000 --a="$STRONG" --b="$WEAK" >> scratch/night6/h2h.txt 2>&1
node scratch/night6-h2h.mjs --label="两带直交·强vs弱（4P multi4）" --mode=multi4 --games=300 --seed=92000 --a="$STRONG" --b="$WEAK" >> scratch/night6/h2h.txt 2>&1
node scratch/night6-h2h.mjs --label="三带直交·强vs中（5P long）" --mode=long --games=400 --seed=93000 --a="$T3S" --b="$MID" >> scratch/night6/h2h.txt 2>&1
node scratch/night6-h2h.mjs --label="三带直交·中vs弱（5P long）" --mode=long --games=400 --seed=94000 --a="$MID" --b="$T3W" >> scratch/night6/h2h.txt 2>&1
echo "=== 直交四系列完成 $(date +%H:%M)" >> scratch/night6/h2h.txt
