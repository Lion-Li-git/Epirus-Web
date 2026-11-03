$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\m2-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
# M2 = 修好 mixprobe 的第二个端点之后重跑曲线（第一版 M 批 q=1 读出 15.1% 而 profile2 同一枚粒读 21.9% ⇒ 手搓候选面偏宽）
# --expect 传的是 profile2 那行的夺1%（从 scratch/P-*-t0.001.log 里读，不是记忆）
foreach ($p in @('R1-v7fix-S1|21.9','ABpre-v7bug-S1|0.7','A11-v7fix-S1|15.7','N1-fx-S1|18.8')) {
  $bits = $p.Split('|')
  say ("START mixprobe2 {0} expect={1}" -f $bits[0], $bits[1])
  & cmd /c "node --max-old-space-size=4096 tools/proto2/mixprobe.mjs --pack=scratch/arms/$($bits[0]).bak --games=120 --expect=$($bits[1]) --mixes=0,0.25,0.5,0.75,1 > scratch/MX2-$($bits[0]).log 2>&1"
  say ("  mixprobe2 {0} rc={1}" -f $bits[0], $LASTEXITCODE)
}
say '=== M2 跑完 ==='
