$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\p-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
# N 波主判据（预登记见第十一段）：profile2 --temp=0.001 的 Δ夺1(2.0 − 同结构随机起点)，SE≈1.0
#   > +2pt ⇒ "稠密且与强度同向的货币"这条路成立；< −2pt 且剖面仍塌成单一技能 ⇒ 换目标（序列级），不换结构。
foreach ($arm in @('N1-fx-S1', 'N2-fx-S1o')) {
  say ("START profile2 {0} temp=0.001 games=120" -f $arm)
  & cmd /c "node --max-old-space-size=4096 tools/proto2/profile2.mjs --pack=scratch/arms/$arm.bak --temp=0.001 --games=120 > scratch\P-$arm-t0.001.log 2>&1"
  say ("END profile2 {0} rc={1}" -f $arm, $LASTEXITCODE)
}
say '=== N 波强度档跑完 ==='
