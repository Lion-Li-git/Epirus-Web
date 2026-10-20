#!/usr/bin/env bash
# §E663 剖面批（预注册在 docs/research/PREREG-2026-10-20-eval-profile-qoder.md，**先看那份再看这份的输出**）
# 6 个包 × 两档（ε=0 纯贪心 ‖ 工具缺省的浏览器档）。串行、只读、不写引擎档。
# 判活看这份日志的收尾行 ALLDONE，不看包装器退出码。
cd /d/code/Epirus-Web || exit 3
AR=docs/research/archive/2026-10-18-night2-prior-caliber/arms
OUT=docs/research/archive/2026-10-20-night-d15-gates/eval-profile.log.txt
: > "$OUT"
for PACK in \
  "$AR/gv-gv0-77000--gv0-77000-band5.bak" "$AR/gv-gv0-77000--gv0-77000-band4.bak" \
  "$AR/gv-gv0-77002--gv0-77002-band5.bak" "$AR/gv-gv0-77002--gv0-77002-band2.bak" \
  "$AR/b9-b90-77001--b90-77001-band6.bak" "$AR/b9-b90-77001--b90-77001-band2.bak"; do
  for EPS in 0 default; do
    echo "@@@ $(basename "$PACK") eps=$EPS $(date '+%T')" >> "$OUT"
    if [ "$EPS" = "0" ]; then
      node tools/behavior-profile.mjs --champion="$PACK" --eps=0 >> "$OUT" 2>&1
    else
      node tools/behavior-profile.mjs --champion="$PACK" >> "$OUT" 2>&1
    fi
    echo "rc=$?" >> "$OUT"
  done
done
echo "ALLDONE $(date '+%F %T')" >> "$OUT"
