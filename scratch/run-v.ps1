$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\v-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
# V 波 = 把"单枚种子的读数"换成"种子分布"。动因（03:3x 实测）：
#   · §E824 那条 bug 的钱已经用**单变量 A/B**量出来了（同 seed=7：修好前 −17.71pt ‖ 修好后 +3.49pt）；
#   · 但修好之后的三枚独立起点是 +3.49 / +2.45 / **−6.09** ⇒ 臂与臂之间散到 9.6pt，远大于单臂 SE(≈1.2)。
#   ⇒ 任何 ≤5pt 的效应都必须在**种子分布**上判，不能在一枚格子上判。这一波就补分母。
#   每臂：rankfit(~2.5 分钟) → profile2 --temp=0.001 --games=120(~15 秒) ⇒ 主读数 = Δ夺1 vs **同一枚固定随机起点粒**（profile2 里定标 4242，跨臂可比）。
foreach ($s in @(10, 11, 12, 13, 14)) {
  say ("START A$s ‖ 货币=v7 蒸馏(修好后) ‖ seed=$s")
  & cmd /c "node --max-old-space-size=4096 tools/proto2/rankfit.mjs --arch=S1 --groups=1600 --pops=16 --iters=120 --seed=$s --out=scratch/arms/A$s-v7fix-S1.bak > scratch/A$s.log 2>&1"
  say ("  rankfit A$s rc=$LASTEXITCODE")
  & cmd /c "node --max-old-space-size=4096 tools/proto2/profile2.mjs --pack=scratch/arms/A$s-v7fix-S1.bak --temp=0.001 --games=120 > scratch/P-A$s-t0.001.log 2>&1"
  say ("  profile2 A$s rc=$LASTEXITCODE")
}
foreach ($s in @(8, 9, 10, 11, 12)) {
  say ("START B$s ‖ 货币=rollout 赢率(§E824 夹具) ‖ seed=$s")
  & cmd /c "node --max-old-space-size=4096 tools/proto2/rankfit.mjs --arch=S1 --fromdump=scratch/N-fx-dump240.jsonl --fxmin=150 --pops=16 --iters=120 --seed=$s --out=scratch/arms/B$s-fx-S1.bak > scratch/B$s.log 2>&1"
  say ("  rankfit B$s rc=$LASTEXITCODE")
  & cmd /c "node --max-old-space-size=4096 tools/proto2/profile2.mjs --pack=scratch/arms/B$s-fx-S1.bak --temp=0.001 --games=120 > scratch/P-B$s-t0.001.log 2>&1"
  say ("  profile2 B$s rc=$LASTEXITCODE")
}
say '=== V 波跑完 ==='
