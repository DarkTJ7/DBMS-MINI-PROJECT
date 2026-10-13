@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"
if errorlevel 1 (
  echo.
  echo Setup or startup failed. Read START-HERE.txt and README.md in this folder.
)
pause
