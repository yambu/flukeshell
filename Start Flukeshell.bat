@echo off
rem Starts Flukeshell. The first time it installs whatever is missing:
rem   Node.js (via winget), the npm dependencies, Electron and - if you want - Claude Code.
rem   "Start Flukeshell.bat --install-only" installs everything without opening the app.
setlocal
title Flukeshell
cd /d "%~dp0"

rem --- 1. Node.js -------------------------------------------------------------
where node >nul 2>nul
if not errorlevel 1 goto node_ok
echo Node.js is not installed: installing it with winget...
where winget >nul 2>nul
if errorlevel 1 goto node_manual
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if not errorlevel 1 goto node_ok
:node_manual
echo.
echo Could not install Node.js automatically.
echo Download the LTS version from https://nodejs.org and run this file again.
pause
exit /b 1
:node_ok

rem --- 2. npm dependencies: first run, or when package.json has changed --------
if not exist "node_modules\" goto install
fc /b package.json "node_modules\.flukeshell-stamp" >nul 2>nul
if not errorlevel 1 goto deps_ok
:install
echo Installing dependencies, first run only: this takes a few minutes...
call npm install --no-fund --no-audit
if errorlevel 1 goto npm_error
copy /y package.json "node_modules\.flukeshell-stamp" >nul
:deps_ok

rem --- 3. Electron: npm sometimes skips the download, retry here ---------------
if exist "node_modules\electron\dist\electron.exe" goto electron_ok
echo Downloading Electron...
node node_modules\electron\install.js
if not exist "node_modules\electron\dist\electron.exe" goto electron_error
:electron_ok

rem --- 3b. Flukeshell.exe: Electron with the Flukeshell icon and name ----------
if exist "node_modules\electron\dist\Flukeshell.exe" goto exe_ok
node build-exe.js
if not exist "node_modules\electron\dist\Flukeshell.exe" goto electron_error
:exe_ok

rem --- 4. Claude Code: if missing, ask before installing it ---------------------
where claude >nul 2>nul
if not errorlevel 1 goto claude_ok
if exist "%USERPROFILE%\.local\bin\claude.exe" goto claude_ok
echo.
echo Claude Code is not installed. Flukeshell still works as a terminal without it.
choice /c YN /m "Install it now with the official Anthropic installer"
if errorlevel 2 goto claude_ok
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"
:claude_ok

if /i "%~1"=="--install-only" (echo All installed. & exit /b 0)
start "" "%~dp0node_modules\electron\dist\Flukeshell.exe" "%~dp0."
exit /b 0

:npm_error
echo.
echo npm install failed: see the error above.
pause
exit /b 1

:electron_error
echo.
echo Could not download Electron: check your connection and try again.
pause
exit /b 1
