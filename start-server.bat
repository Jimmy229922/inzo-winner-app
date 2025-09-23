@echo off
chcp 65001 > nul
title inzo Winner System - Daily Launcher

REM Set the current directory to the script's location for reliable paths
cd /d "%~dp0"

echo.
echo =================================================
echo  Starting inzo Winner System...
echo =================================================
echo.

REM --- Step 1: Check for required files ---
echo [1/2] Verifying system setup...
IF NOT EXIST "backend\.env" (
    echo [ERROR] Configuration file is missing.
    echo.
    echo Please run 'setup.bat' first to configure the system.
    echo.
    pause
    exit
)

IF NOT EXIST "backend\node_modules" (
    echo [ERROR] Required components are missing.
    echo.
    echo Please run 'setup.bat' first to install dependencies.
    echo.
    pause
    exit
)
echo [OK] System is configured correctly.
echo.

REM --- Step 2: Start the application ---
echo [2/2] Starting application...
echo      Opening frontend in your browser...
start "" "http://localhost:3000"

echo.
echo =================================================
echo  Starting Server... This window will now become the server log.
echo  It must remain open for the application to work.
echo =================================================
echo.
 
:start
REM Navigate to backend and start the server
cd backend
node server.js

REM Check the exit code. If it's 1, it means we need to restart for an update.
IF %errorlevel% == 1 (
    echo.
    echo [SYSTEM] Server restarting to apply updates...
    echo.
    timeout /t 2 /nobreak > nul
    goto start
)

REM Check for other errors. A non-zero exit code other than 1 indicates a crash.
IF %errorlevel% NEQ 0 (
    echo.
    echo [ERROR] The server has crashed unexpectedly.
    echo Please check the logs above for any error messages.
    echo.
)

echo.
echo Server has stopped. You can close this window now.
pause
