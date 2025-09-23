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
echo.
echo This script is for the system administrator to perform the
echo initial setup. It will install components and create the
echo configuration file. If a configuration already exists,
echo you can run 'reset-config.bat' to remove it first.
echo.
pause

echo Installing backend dependencies...
echo      (This may take a moment)...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] 'npm install' failed. Check your internet connection, antivirus settings, or try running as Administrator.
    cd ..
    pause
    exit
)
echo.
echo Backend dependencies installed.
echo.

REM Run the Node.js setup script to gather user input
echo Starting interactive configuration...
node setup.js
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