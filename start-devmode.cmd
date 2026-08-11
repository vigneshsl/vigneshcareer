@echo off
rem Double-click this file to start Dev Mode. Closing the window stops it.
setlocal

cd /d "%~dp0"

rem Starting a second copy would only fail with EADDRINUSE.
netstat -ano | findstr /c:"127.0.0.1:4321" | findstr /i "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo   Dev Mode is already running. Opening it now.
    echo.
    start "" "http://127.0.0.1:4321"
    timeout /t 3 >nul
    exit /b 0
)

set "NODE_EXE="
where node >nul 2>&1 && set "NODE_EXE=node"

rem Falls back to the portable runtime for machines with no Node installed.
if not defined NODE_EXE (
    for /d %%D in ("%LOCALAPPDATA%\vc-node\node-v*") do (
        if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
    )
)

if not defined NODE_EXE (
    echo.
    echo   Node.js was not found on this computer.
    echo.
    echo   Install it once by running this in PowerShell:
    echo       winget install OpenJS.NodeJS.LTS
    echo.
    echo   Then close that window, open a new one, and run this file again.
    echo.
    pause
    exit /b 1
)

echo.
echo   Dev Mode is starting on http://127.0.0.1:4321
echo   Your browser will open in a moment.
echo.
echo   Keep this window open. Closing it stops Dev Mode.
echo.

start "" "http://127.0.0.1:4321"
"%NODE_EXE%" "server\devmode-server.js"

echo.
echo   Dev Mode has stopped.
pause
