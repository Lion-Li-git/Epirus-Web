Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object { "{0}  {1}" -f $_.ProcessId, $_.CommandLine } | Out-String -Width 260
