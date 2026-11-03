@echo off
setlocal
title Epirus Skill Report
cd /d "%~dp0.."

rem ===== Skill report generator (double-click to run) =====
rem Usage: tools\skill-report.cmd [champion-file] [games-per-condition=6]
rem   default champion = js\bundled-champion-3p.js  (current shipped multiplayer champion)
rem   to measure an archived version:
rem     tools\skill-report.cmd docs\artifacts\champion-5p-hA9.bak
rem Output: docs\skill-report.html  (opened automatically)
rem
rem NOTE: keep this file ASCII-only. Chinese comments break the cmd parser under
rem the default GBK console codepage (UTF-8 bytes get split into bogus commands).
rem
rem The last column "tool to use" tells you which flag can measure the skills this
rem instrument cannot (--grant / --plan / --combo / --smart / --ban).
rem Set EPIRUS_NO_OPEN=1 to skip opening the browser.

set CHAMP=%~1
if "%CHAMP%"=="" set CHAMP=js\bundled-champion-3p.js
set GAMES=%~2
if "%GAMES%"=="" set GAMES=6
set OUT=docs\skill-report.html

if not exist "%CHAMP%" (
  echo.
  echo  [Epirus] Champion file not found: %CHAMP%
  echo           Example: docs\artifacts\champion-5p-hA9.bak
  pause >nul
  exit /b 1
)

echo.
echo  [Epirus] Skill report
echo    champion        : %CHAMP%
echo    players         : 5
echo    games/condition : %GAMES%
echo    output          : %OUT%
echo.

node "tools\skill-report.mjs" 5 %GAMES% "%OUT%" --champ="%CHAMP%"
if errorlevel 1 goto :fail

echo.
echo  [Epirus] Done. Opening %OUT% ...
if not "%EPIRUS_NO_OPEN%"=="1" start "" "%OUT%"
echo  Press any key to close.
pause >nul
exit /b 0

:fail
echo.
echo  [Epirus] FAILED - copy the error above when asking for help.
pause >nul
exit /b 1
