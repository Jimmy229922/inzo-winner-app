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
if %errorlevel% neq 0 (
    echo [ERROR] 'npm install' failed. Check your internet connection, antivirus settings, or try running as Administrator.
    cd ..
    pause
    exit
)
echo.
echo [OK] Backend dependencies installed.
echo.

echo [2/2] Creating configuration file...

REM Create the .env file directly from the batch script
(
    echo # MongoDB Connection String
    echo MONGODB_URI=mongodb://127.0.0.1:27017/inzo-db
    echo.
    echo # Initial Super Admin Credentials
    echo SUPER_ADMIN_EMAIL=admin@inzo.com
    echo SUPER_ADMIN_PASSWORD=inzo123
    echo.
    echo # JWT Secret for authentication tokens
    echo JWT_SECRET=your-super-secret-jwt-key-that-is-long-and-random-and-changed
) > ".env"

echo [OK] Configuration file (.env) created successfully.
cd ..

echo =================================================================
echo  Setup Complete! The system is now ready.
echo =================================================================
echo You can now run 'start-server.bat' to launch the application.
echo.
pause