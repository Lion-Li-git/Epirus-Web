#!/usr/bin/env bash
# N2 xfer44 种群重掷（§N2 预注册 · 断点续跑：完成一粒 touch docs/artifacts/.n2-<tag>.done）
# 用法：bash docs/debug/night-n2-reroll.sh   （必须从仓库根目录跑）
set -u
cd "$(git rev-parse --show-toplevel)"
ART=docs/artifacts
run_arm() {
  local tag="$1" seed="$2" extraenv="$3"
  [ -f "$ART/.n2-$tag.done" ] && { echo "[skip] $tag 已完成"; return; }
  echo "=== arm $tag seed=$seed $extraenv $(date +%H:%M) ==="
  # 换槽：tgt-44 → 2P 壳
  node -e "const fs=require('fs');const s=fs.readFileSync('docs/artifacts/v7tgt-44.bak','utf8');const m=/window\\.EPIRUS_CHAMPION_3P\\s*=\\s*(\\{[\\s\\S]*\\});/.exec(s);fs.writeFileSync('js/bundled-champion.js','window.EPIRUS_CHAMPION = '+m[1]+';'+String.fromCharCode(10));" || { echo "slot-swap FAIL $tag"; return 1; }
  env EPIRUS_ARM="$tag" EPIRUS_SEED="$seed" $extraenv node tools/train-best.mjs 3 500 > "/tmp/$tag.log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    cp js/bundled-champion.js "$ART/$tag-2p.bak"
    grep -hE "band-save|选中|实际胜率" "/tmp/$tag.log" | tail -6
    # 每粒 winner 的 H2H 与种类速记（省时间：只记 div 行）
    grep -hE "sc=.*avg=.*hill05" "/tmp/$tag.log" >> "$ART/.n2-$tag.summary" || true
    touch "$ART/.n2-$tag.done"
  else
    echo "[fail] $tag exit=$rc（log /tmp/$tag.log，不标 done）"
  fi
  git checkout -- js/bundled-champion.js index.html 2>/dev/null
}
run_arm v7xfer44c6  6  ""
run_arm v7xfer44c7  7  ""
run_arm v7xfer44c8  8  ""
run_arm v7xfer44c9  9  ""
run_arm v7xfer44c10 10 ""
run_arm v7xfer44c11 11 ""
run_arm v7xfer44c12 12 ""
run_arm v7xfer44c13 13 ""
run_arm v7xfer44d6w 6  "EPIRUS_DIV_W=0.6"   # N2b 广度项对照（econ-env → worker fit；评测不吃它）
echo "N2-ALL-DONE $(date +%H:%M)"
