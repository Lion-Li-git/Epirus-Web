@echo off
setlocal enabledelayedexpansion
title Epirus Skill Report - Compare
cd /d "%~dp0.."

rem ===== Compare skill reports across champion versions (double-click to run) =====
rem Usage: tools\skill-report-compare.cmd [games-per-condition=6] [label1 label2 ...]
rem   label = name of <label>.bak under docs\artifacts\ (without .bak).
rem   With no labels it uses the DEFAULT_SPECS list below.
rem   Example: tools\skill-report-compare.cmd 4 champion-5p-hA9 champion-5p-hB12
rem Output: docs\artifacts\sr-<label>.html/.json per version, then
rem         docs\skill-report-cmp.html (skill x version matrix + coverage table), opened.
rem
rem NOTE: keep this file ASCII-only (Chinese comments break the cmd parser under GBK).
rem Set EPIRUS_NO_OPEN=1 to skip opening the browser.

set GAMES=%~1
if "%GAMES%"=="" set GAMES=6

rem collect remaining args as labels (NOTE: %* ignores `shift`, so loop explicitly)
set SPECS=
shift
:collect
if "%~1"=="" goto :collected
set SPECS=%SPECS% %~1
shift
goto :collect
:collected
if "%SPECS%"=="" set SPECS=champion-5p-v1.3.58 champion-5p-hA9 champion-5p-hB12 champion-5p-armB12f champion-5p-armA9

echo.
echo  [Epirus] Skill report - compare versions   (games/condition = %GAMES%)
echo.

set FILES=
for %%S in (%SPECS%) do (
  if exist "docs\artifacts\%%S.bak" (
    echo    - %%S
    node "tools\skill-report.mjs" 5 %GAMES% "docs\artifacts\sr-%%S.html" --champ="docs\artifacts\%%S.bak" --json="docs\artifacts\sr-%%S.json"
    if errorlevel 1 (
      echo      [skip] %%S failed
    ) else (
      set FILES=!FILES! "docs\artifacts\sr-%%S.json"
    )
  ) else (
    echo    - %%S   ^(missing docs\artifacts\%%S.bak^)
  )
)

echo    - current (js\bundled-champion-3p.js)
node "tools\skill-report.mjs" 5 %GAMES% "docs\artifacts\sr-current.html" --champ="js\bundled-champion-3p.js" --json="docs\artifacts\sr-current.json"
if not errorlevel 1 set FILES=!FILES! "docs\artifacts\sr-current.json"

if "%FILES%"=="" (
  echo.
  echo  [Epirus] No versions measured - nothing to compare.
  pause >nul
  exit /b 1
)

echo.
echo  [Epirus] Building compare page ...
node "tools\skill-report-cmp.mjs" !FILES! --out="docs\skill-report-cmp.html" --title="Epirus skill report - version compare"
if errorlevel 1 goto :fail

echo.
echo  [Epirus] Done. Opening docs\skill-report-cmp.html ...
if not "%EPIRUS_NO_OPEN%"=="1" start "" "docs\skill-report-cmp.html"
echo  Press any key to close.
pause >nul
exit /b 0

:fail
echo.
echo  [Epirus] FAILED - copy the error above when asking for help.
pause >nul
exit /b 1
