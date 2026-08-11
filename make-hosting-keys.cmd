@echo off
rem Double-click this file to generate the credentials a hosted Dev Mode needs.
rem The values it prints are secrets. Copy them into the host, then close this window.
setlocal

cd /d "%~dp0"

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
echo   Pick a username and password for the hosted Dev Mode login.
echo   What you type will not appear on screen. That is normal.
echo.

"%NODE_EXE%" "scripts\hash-password.js"

echo.
echo   Copy the lines above into your host's environment variables.
echo   Do not paste them into a file inside this folder, and do not share them.
echo.
pause
