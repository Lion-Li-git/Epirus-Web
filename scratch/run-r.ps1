$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\r-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
# R 波 = 修好 §E824 那条"蓄能形参错位"之后，把 F1 那一格（v7 蒸馏货币）在**独立起点**上复跑
#   预登记判据（在册 §十 + 第十一段）：主读数 = profile2 --temp=0.001 的 Δ夺1(2.0 − 同结构随机起点)，SE 由工具印；
#   R1 已经读到 +3.49pt（SE≈1.29，过线）⇒ **单格过线不算方向**，必须再加两枚独立 seed 才算这条方向的复现。
foreach ($s in @(8, 9)) {
  say ("START rankfit R{0} arch=S1 seed={1} (v7 蒸馏货币，蓄能已回到标签面)" -f $s, $s)
  & cmd /c "node --max-old-space-size=4096 tools/proto2/rankfit.mjs --arch=S1 --groups=1600 --pops=16 --iters=120 --seed=$s --out=scratch/arms/R$s-v7fix-S1.bak > scratch/R$s.log 2>&1"
  say ("END rankfit R{0} rc={1}" -f $s, $LASTEXITCODE)
  say ("START profile2 R{0} temp=0.001 games=120" -f $s)
  & cmd /c "node --max-old-space-size=4096 tools/proto2/profile2.mjs --pack=scratch/arms/R$s-v7fix-S1.bak --temp=0.001 --games=120 > scratch/P-R$s-t0.001.log 2>&1"
  say ("END profile2 R{0} rc={1}" -f $s, $LASTEXITCODE)
}
say '=== R 波跑完 ==='
