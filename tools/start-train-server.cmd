@echo off
setlocal
title Epirus Train Server
echo.
echo  [Epirus] Starting train server (multi-core)...
echo  Keep this window open. Open the game and go to Training.
echo  If this window closes instantly, run from a terminal:
echo      node "server\train-server.mjs" 8787
echo.
cd /d "%~dp0.."
node "server\train-server.mjs" 8787
echo.
echo  [Epirus] Train server exited. Press any key to close.
pause >nul
