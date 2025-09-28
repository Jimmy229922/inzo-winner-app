@echo off
chcp 65001 > nul
title inzo Winner System - Daily Launcher

cd /d "%~dp0"
color 0B

echo.
echo =================================================
echo  Starting inzo Winner System...
echo =================================================
echo.

echo [1/3] Verifying system setup...
IF NOT EXIST "backend\.env" (
    color 0C
    echo [ERROR] Configuration file is missing.
    echo.
    echo Please run 'setup.bat' first to configure the system.
    echo.
    pause
    exit /b 1
)

IF NOT EXIST "backend\node_modules" (
    color 0C
    echo [ERROR] Required components are missing.
    echo.
    echo Please run 'setup.bat' first to install dependencies.
    echo.
    pause
    exit /b 1
)
color 0A
echo [OK] System is configured correctly.
color 0B
echo.

echo [2/3] Starting application in browser...
echo      Opening frontend in your browser...
start "" "http://localhost:30001"
echo.

echo [3/3] Starting server...
echo =================================================
echo  Starting Server... This window will now become the server log.
echo  It must remain open for the application to work.
echo =================================================
echo.
 
:start
cd backend
node server.js
 
IF %errorlevel% == 42 (
    color 0E
    echo.
    echo [SYSTEM] Server restarting to apply updates...
    echo.
    timeout /t 2 /nobreak > nul
    goto start
)
 
IF %errorlevel% NEQ 0 (
    color 0C
    echo.
    echo =================================================================
    echo  [CRITICAL ERROR] The server has crashed unexpectedly.
    echo =================================================================
    echo.
    echo  Please copy ALL the text in this window (Ctrl+A, Ctrl+C)
    echo  and send it to the administrator for troubleshooting.
    echo.
)

color 07
pause
