#!/usr/bin/env bash
# 覆盖锚（EPIRUS_ANCHOR_TO=widest）冒烟 + 验牙（11-04 千问）
#  ① 回归：ANCHOR_TO 不设 vs 显式 seed ⇒ 产物逐位同（新增的分支不许动老路）
#  ② 老功能仍有效：λ=3(to=seed) 与 λ=0 产物必须**不同**（否则 λ 又空转，DS 那批已抓到过小 λ 空转）
#  ③ 拒绝：ANCHOR_TO=乱码 ⇒ exit 2 ‖ ANCHOR>0 且 widest 但没开 GA_GATE ⇒ exit 2
#  ④ 生效：widest 档 ⇒ 日志有 [锚·最宽] ‖ meta.recipe.anchor.live=1 ‖ moves≥1 ‖ 产物与 ① 不同
#  ⑤ 冷启动：不带 HOTSTART 也能 live=1（这就是我做这个杠杆的目的）
set -u
REPO="D:/code/Epirus-Web"; cd "$REPO" || exit 3
OUT="$REPO/scratch/anchor-cov"; mkdir -p "$OUT"
SPK='scratch/night6/CB3-s13.js'
run() {  # $1=name  $2=anchorλ  $3=to(空=不设)  $4=GA_GATE  $5=hot(1/0)
  local N="$1" A="$2" T="$3" G="$4" H="$5"
  ( export EPIRUS_ARCH2='S1ob:input=obs3b,gen=3,keySplit=1' EPIRUS_MUT_MODE='seg' EPIRUS_TRAIN_MODE='long'
    export EPIRUS_SEED=13 EPIRUS_ARM="ACOV-$N" EPIRUS_EFFSKILL_MIN=6
    export EPIRUS_BAND_DIR="$REPO/scratch/ga-bands/ACOV-$N" EPIRUS_T3P_OUT="scratch/ga-arms/ACOV-$N.js"
    export EPIRUS_ANCHOR="$A"
    [ -n "$T" ] && export EPIRUS_ANCHOR_TO="$T" || unset EPIRUS_ANCHOR_TO
    [ "$G" != "0" ] && export EPIRUS_GA_GATE="$G" || unset EPIRUS_GA_GATE
    if [ "$H" = "1" ]; then export EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK="$SPK"; else unset EPIRUS_HOTSTART EPIRUS_SEEDPACK; fi
    node tools/train-3p.mjs 14 5 12 8 > "$OUT/$N.log" 2>&1; echo "$N rc=$?" )
}
echo "=== 语法自检 ==="; node --check tools/train-3p.mjs && echo "train-3p 解析 OK"
echo "=== ③ 两条拒绝（必须当场 exit 2，不许静默回落）==="
EPIRUS_ANCHOR=3 EPIRUS_ANCHOR_TO=garbage node tools/train-3p.mjs 2 5 4 4 2>&1 | tail -1
echo "  ↑ 乱码 rc=${PIPESTATUS[0]}"
EPIRUS_ANCHOR=2 EPIRUS_ANCHOR_TO=widest node tools/train-3p.mjs 2 5 4 4 2>&1 | tail -1
echo "  ↑ 无 GA_GATE rc=${PIPESTATUS[0]}"
echo "=== ①② 三粒臂（缺省 vs seed vs λ=0）==="
run DEF 3 "" 0 1; run SEE 3 seed 0 1; run ZER 0 "" 0 1
echo "=== ④⑤ widest 两粒（热启动 ‖ 冷启动）==="
run WID 3 widest 3 1; run WIDCOLD 3 widest 3 0
wid() { node --input-type=module -e "
import {readFileSync} from 'node:fs';
import {widOf, parseMeta} from './champion-map/pack-id.mjs';   /* 身份只用单一来源，不自己抄 sha1 */
let t;try{t=readFileSync('scratch/ga-arms/ACOV-$1.js','utf8');}catch(e){console.log('$1 无产物');process.exit(0);}
const m=parseMeta(t)||{};
console.log('$1 wid='+(widOf(t)||'').slice(0,12)+'  anchor='+JSON.stringify(m.recipe&&m.recipe.anchor));" ; }
for N in DEF SEE ZER WID WIDCOLD; do wid "$N"; done
echo "=== 生效证据（④⑤ 必须有 [锚·最宽] 行）==="
for N in WID WIDCOLD; do printf '%-8s [锚·最宽] %s 行 ‖ GA_GATE 审计 %s 行\n' "$N" "$(grep -c '锚·最宽' "$OUT/$N.log")" "$(grep -c '门槛' "$OUT/$N.log")"; done
tail -2 "$OUT/WID.log" | cut -c1-140
