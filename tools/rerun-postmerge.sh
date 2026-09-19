#!/usr/bin/env bash
# 09-19 下午：把夜间 §27/§28 那两张表在**新引擎（61a7711c）**上重跑一遍。
# 包集 = 夜里的全部 v7l2*（与旧表同一人群，才能逐行对比）+ ds 新世的 v7press*/v7fix1*/v7noteach1*
#        + 旧线上包 v7new5_005-31 + 新冠军（js/bundled-champion-3p.js）。
# 旧引擎的原始日志与矩阵**已先快照保留**：docs/artifacts/eng1391/ 与 docs/l2-eval-matrix-engine-1391c094.tsv。
# 每步都 echo 到 docs/artifacts/rerun.log，跑完留 RERUN_DONE（会话侧不要轮询，看这个标记）。
set -u
cd "$(dirname "$0")/.."
L(){ echo "[$(date +%H:%M:%S)] $*"; }
PACKS=$(ls docs/artifacts/v7l2*.bak docs/artifacts/v7press*.bak docs/artifacts/v7fix1*.bak docs/artifacts/v7noteach1*.bak docs/artifacts/v7new5_005-31.bak 2>/dev/null | tr '\n' ' ')
N=$(echo $PACKS | wc -w)
L "包集 = $N 个（含旧线上包 .bak；新冠军走 js/bundled-champion-3p.js 这一路径）"

L "① probe-leftover（ep 深度 / 兑现 / 终局余款）30 局"
node tools/probe-leftover.mjs 30 js/bundled-champion-3p.js $PACKS > docs/artifacts/leftover-all.log 2>&1
L "   完成：$(grep -c '\[multi\]' docs/artifacts/leftover-all.log) 行"

L "② crowding V1（对手=random）80 局"
node tools/crowding.mjs 80 js/bundled-champion-3p.js $PACKS > docs/artifacts/crowd-random.log 2>&1
L "   完成：$(grep -c 'v7l2\|v7press\|v7fix1\|v7noteach\|线上包' docs/artifacts/crowd-random.log) 行"
L "③ crowding V2/V4（对手=balanced）80 局"
CROWD_OPP=balanced node tools/crowding.mjs 80 js/bundled-champion-3p.js $PACKS > docs/artifacts/crowd-balanced.log 2>&1
L "   完成"

L "④ champ-audit（G 有效技能数 = 宽度协变量）20+20 局 —— 新引擎"
node tools/champ-audit.mjs --games=20 --exam-games=20 js/bundled-champion-3p.js $PACKS > docs/artifacts/audit-newengine.log 2>&1
git checkout -- docs/skill-report.html 2>/dev/null
L "   完成"

L "⑤ 考卷矩阵 A卷/targeter/ringwall @120（L2_EVAL_FRESH=1 ⇒ 新引擎单独一份，不覆盖夜间那份）"
L2_EVAL_FRESH=1 node tools/l2-eval.mjs 120 js/bundled-champion-3p.js $PACKS > /dev/null 2>&1
cp docs/artifacts/l2-eval.log docs/l2-eval-matrix-engine-61a7711c.tsv
L "   完成：$(grep -c . docs/l2-eval-matrix-engine-61a7711c.tsv) 行"

L "⑥ 出表：ep 深度 × 各轴（新引擎）"
MATRIX=docs/l2-eval-matrix-engine-61a7711c.tsv node tools/l2-epdepth-axis.mjs > docs/artifacts/table-epdepth-newengine.log 2>&1
L "⑦ 出表：宽度 G × 各轴（新引擎）"
AUDIT=docs/artifacts/audit-newengine.log node tools/l2-width-price.mjs > docs/artifacts/table-width-newengine.log 2>&1
L "RERUN_DONE"
echo RERUN_DONE >> docs/artifacts/rerun-done.marker
