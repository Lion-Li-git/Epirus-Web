@echo off
cd /d "%~dp0.."
node server\train-server.mjs %*
