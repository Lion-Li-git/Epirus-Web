$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\m-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
# M 波（第二次于今夜，此前 M 批是"贪心执行 + 修好 arena"那批）：**强度 × 一致率曲线**
#   焦点席每一手以概率 q 交给被测 2.0 粒、其余仍由 v7 参照包决定 ⇒ q=0 = 纯 v7、q=1 = 纯那枚粒。
#   端点是已知值 ⇒ 端点对不上就当场判这台尺的 arena 与 profile2 不同（只读形状，不读绝对值）。
foreach ($p in @('R1-v7fix-S1','ABpre-v7bug-S1','A11-v7fix-S1','N1-fx-S1')) {
  say ("START mixprobe {0}" -f $p)
  & cmd /c "node --max-old-space-size=4096 tools/proto2/mixprobe.mjs --pack=scratch/arms/$p.bak --games=120 --mixes=0,0.25,0.5,0.75,1 > scratch/MX-$p.log 2>&1"
  say ("  mixprobe {0} rc={1}" -f $p, $LASTEXITCODE)
}
say '=== M 波（曲线）跑完 ==='
