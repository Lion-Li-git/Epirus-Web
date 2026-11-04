#!/usr/bin/env bash
# 11-04 晨班取证：D4 修法的三条变异 + D191④ 豁免面的一条变异，全部落成原件（此前只在对话里）
# 用法：bash scratch/morning1104-mutation-evidence.sh
set -u
REPO="D:/code/Epirus-Web"
WT="D:/code/epirus-mut-1104"
OUT="$REPO/scratch/night6/morning1104-mutation-evidence.txt"
GUARD="C:/Users/14765/.qoder-cn/skills/doc-structure-guard/scripts/check.cjs"
cd "$REPO" || exit 3
echo "# D4 / D191④ 变异取证 $(date -Iseconds) ‖ 主仓 HEAD=$(git rev-parse --short HEAD)" > "$OUT"

git worktree add --detach "$WT" 47b05c06 >> "$OUT" 2>&1 || { echo "worktree 建不起来" >> "$OUT"; exit 4; }
cd "$WT" || exit 5

run() { # $1=标签  $2=--only=
  local line
  line=$(node tools/np-test.mjs --only="$2" 2>&1 | grep -E "  [✔✘] " | head -1)
  echo "[$1] $line" | tee -a "$OUT"
}

echo "--- 基线：夜班末（47b05c06）的旧腿 + 当时的产品 ⇒ 期望红（门被 if 守卫架空）" >> "$OUT"
run "旧腿/未变异" "D4 opponent rotation"

cp "$REPO/tools/gates/engine-rules.mjs" tools/gates/engine-rules.mjs
echo "--- 对照 0：只换新腿、产品一字不动 ⇒ 期望绿" >> "$OUT"
run "新腿/未变异" "D4 opponent rotation"

node -e "const fs=require('fs');let s=fs.readFileSync('js/train/evo.js','utf8');
const a='if (OPP_SWEEP) return (g * 4 + k + gen * 4) % oppsLen;';
const b='if (OPP_SWEEP) return (idx * 4 + k + gen * 4) % oppsLen;';
if(s.indexOf(a)<0){console.log('M1 锚点没命中');process.exit(9);} fs.writeFileSync('js/train/evo.js',s.replace(a,b));" >> "$OUT" 2>&1
echo "--- M1：开档那条改用 idx ⇒ 期望红并点名那条分支（旧腿对这条只能报'扫不到真身'）" >> "$OUT"
run "M1 idx" "D4 opponent rotation"

git checkout -- js/train/evo.js
node -e "const fs=require('fs');let s=fs.readFileSync('js/train/evo.js','utf8');
fs.writeFileSync('js/train/evo.js',s.split('oppSeatIndex').join('oppSeatIndexRet'));" >> "$OUT" 2>&1
echo "--- M2：函数改名 ⇒ 期望响亮报'两处都扫不到 = 这条门已被重构架空'" >> "$OUT"
run "M2 改名" "D4 opponent rotation"

git checkout -- js/train/evo.js
node -e "const fs=require('fs');let s=fs.readFileSync('js/train/evo.js','utf8');
const i=s.indexOf('    if (OPP_SWEEP) return');const j=s.indexOf('\n',i);
fs.writeFileSync('js/train/evo.js',s.slice(0,i)+s.slice(j+1));" >> "$OUT" 2>&1
echo "--- M3：摘掉开档那条（回到单 return 老形状）⇒ 期望绿，且形状自证那条不许虚报多条" >> "$OUT"
run "M3 老形状" "D4 opponent rotation"

cd "$REPO" || exit 6
git worktree remove --force "$WT" >> "$OUT" 2>&1
echo "--- worktree 已拆：$(git worktree list | wc -l) 个（应只剩主仓）" >> "$OUT"

echo "--- D191④ 牙：把已注册过的同权重再抄第三份（band1 的 canonical 侧已在账本里）" >> "$OUT"
cp docs/artifacts/CB3-s7-band1.bak docs/artifacts/MUT-D191-probe.bak
node tools/dedupe-artifacts.mjs --audit 2>/dev/null | grep '^{' | tail -1 >> "$OUT"
rm -f docs/artifacts/MUT-D191-probe.bak
node tools/dedupe-artifacts.mjs --audit 2>/dev/null | grep '^{' | tail -1 >> "$OUT"
echo "  上面两行 = 有探针（unregistered=1 并点名 MUT-D191-probe）‖ 摘掉后（0）" >> "$OUT"
node tools/np-test.mjs --group=meta 2>&1 | tail -3 >> "$OUT"
node "$GUARD" --file docs/research/RESULTS-2026-11-03-DAY-qoder.md 2>&1 | tail -3 >> "$OUT"
echo "=== 取证写完 → $OUT ‖ 探针残留：$(ls docs/artifacts/MUT-D191-probe.bak 2>&1 | tail -1)"
tail -22 "$OUT"
