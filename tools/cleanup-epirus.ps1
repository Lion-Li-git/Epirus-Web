# Epirus 探针孤儿清理（定向，绝不全局杀进程）
# 只动两类目标：
#   1) 命令行里带 epirus- 临时 profile 的 chrome（探针自己起的 headless）
#   2) 监听探针 CDP 端口（9349/9351/9353）的进程
# 用法：pwsh -NoProfile -File tools/cleanup-epirus.ps1 [-WhatIfOnly] [-KeepTemp]
param(
  [switch]$WhatIfOnly,
  [switch]$KeepTemp
)
$ErrorActionPreference = 'SilentlyContinue'
$cdpPorts = 9349, 9351, 9353, 9337

Write-Host '=== 1) 带 epirus- 临时 profile 的 chrome ==='
$mine = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like '*epirus-*' }
if ($mine) {
  foreach ($p in $mine) {
    Write-Host ("  kill pid={0}  {1}" -f $p.ProcessId, ($p.CommandLine.Substring(0, [Math]::Min(110, $p.CommandLine.Length))))
    if (-not $WhatIfOnly) { Stop-Process -Id $p.ProcessId -Force }
  }
} else { Write-Host '  （无）' }

Write-Host '=== 2) 监听探针 CDP 端口的进程 ==='
foreach ($port in $cdpPorts) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen
  foreach ($c in $conns) {
    $pid2 = $c.OwningProcess
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$pid2"
    $cmd = if ($proc) { $proc.CommandLine } else { '' }
    # 双保险：端口对 + 命令行确实带 epirus- 才杀，避免误伤别人占用同端口
    if ($cmd -like '*epirus-*') {
      Write-Host ("  port {0} -> pid={1} (epirus) kill" -f $port, $pid2)
      if (-not $WhatIfOnly) { Stop-Process -Id $pid2 -Force }
    } elseif ($cmd) {
      Write-Host ("  port {0} -> pid={1} 非 epirus，跳过" -f $port, $pid2)
    }
  }
}

if (-not $KeepTemp) {
  Write-Host '=== 3) 清理 %TEMP%\epirus-* 目录 ==='
  $dirs = Get-ChildItem $env:TEMP -Directory -Filter 'epirus-*'
  Write-Host ("  待清理 {0} 个" -f @($dirs).Count)
  if (-not $WhatIfOnly) {
    foreach ($d in $dirs) { Remove-Item -LiteralPath $d.FullName -Recurse -Force }
    Write-Host ("  已清理，剩余 {0} 个" -f @(Get-ChildItem $env:TEMP -Directory -Filter 'epirus-*').Count)
  }
}
Write-Host '完成（未触碰任何非 epirus 的 chrome / node 进程）'
