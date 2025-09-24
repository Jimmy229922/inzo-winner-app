@echo off
chcp 65001 > nul
title inzo Winner System - First-Time Setup
color 0B

REM Set the current directory to the script's location for reliable paths
cd /d "%~dp0"

echo =================================================================
echo.
echo      Welcome to the inzo Winner System Setup
echo.
echo =================================================================

echo This script will automatically install and configure the system.
echo Please wait...
echo.

echo [1/2] Installing backend dependencies...
echo      (This may take a moment)...
cd backend
call npm install 
call npm install @supabase/supabase-js
if %errorlevel% neq 0 (
    echo [ERROR] 'npm install' failed. Check your internet connection, antivirus settings, or try running as Administrator.
    cd ..
    pause
    exit
)
echo.
echo [OK] Backend dependencies installed.
echo.

REM Run the Node.js setup script to create the .env file automatically
echo [2/2] Creating configuration file...
node backend/setup.js
if %errorlevel% neq 0 (
    echo [ERROR] The configuration script failed to run.
    cd ..
    pause
    exit
)
cd ..

echo =================================================================
echo  Setup Complete! The system is now ready.
echo =================================================================
echo You can now run 'start-server.bat' to launch the application.
echo.
pause