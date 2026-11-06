# run-c2.ps1 — 段 C 第二波：把"当选在冻结桌上判"做成一条真臂（fxSelect）
# 预登记（跑前定死）：
#   预算 targetGames=6000 ‖ 终局读数 holdoutGames=2400（SE≈0.65pt/臂，两臂差的 SE≈0.9pt）
#   主对照 = A1(fx off) vs A2(fx on)，同 paired 同 games 同种子族 ⇒ 只差"当选在哪批桌上判"
#   每格两粒 seed ⇒ 单 seed 的方向不算数（在册条款）
#   判语线：|dFirst| < 2pt ⇒ 写"分不开"；inLoopBest 涨而 holdoutFit 跌 ⇒ 判"在选择噪声上爬坡"
# 输出用 UTF-8（上一波 PowerShell 默认写成 UTF-16，读数得反过来解码，白折腾一次）
$ErrorActionPreference = 'Continue'
Set-Location 'D:\code\Epirus-Web'
$log = 'D:\code\Epirus-Web\scratch\c2-wave.log'
function say($t) { Add-Content -Encoding utf8 -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $t) }
function runArm($name, $paired, $fx, $games, $mode, $seed) {
  $env:EPIRUS_ARCH2 = 'S1'; $env:EPIRUS_MUT_MODE = 'seg'
  if ($paired -eq 1) { $env:EPIRUS_PAIRED = '1' } else { Remove-Item Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue }
  say ("START {0} paired={1} fx={2} games={3} mode={4} seed={5}" -f $name, $paired, $fx, $games, $mode, $seed)
  $p = "node tools/probe-cem-arm.mjs --mode=$mode --targetGames=6000 --holdoutGames=2400 --games=$games --n=3 --trainMode=multi --pop=14 --elite=4 --fxSelect=$fx --seed=$seed"
  & cmd /c "$p > scratch\$name.log 2>&1"
  say ("END {0} rc={1}" -f $name, $LASTEXITCODE)
}
say '=== 段 C 第二波开跑（fxSelect 对照 ‖ 8 臂串行）==='
runArm 'A1-fx0-p1'   1 0 6  'esa' 2001
runArm 'A2-fx1-p1'   1 1 6  'esa' 2002
runArm 'A3-fx0-p0'   0 0 6  'esa' 2003
runArm 'A4-fx1-p0'   0 1 6  'esa' 2004
runArm 'A5-cem-p1'   1 0 6  'cem' 2005
runArm 'A6-fx1-p1-b' 1 1 6  'esa' 2006
runArm 'A7-fx0-p1-b' 1 0 6  'esa' 2007
runArm 'A8-fx1-g12'  1 1 12 'esa' 2008
Remove-Item Env:\EPIRUS_ARCH2, Env:\EPIRUS_MUT_MODE, Env:\EPIRUS_PAIRED -ErrorAction SilentlyContinue
say '=== 段 C 第二波跑完 ==='
