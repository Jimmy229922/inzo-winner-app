@echo off
chcp 65001 > nul
title Enzo Winner System

echo Starting Enzo Winner Management System...
echo.

REM Navigate to the backend directory
cd backend

REM Install dependencies if node_modules folder doesn't exist
IF NOT EXIST "node_modules" (
    echo Installing backend dependencies (this might take a moment)...
    call npm install
)

REM Start the backend server in a new window
echo Starting backend server...
start "Enzo Backend Server" cmd /k "npm start"

REM Wait a few seconds for the server to initialize
timeout /t 5 /nobreak > nul

echo Opening the frontend application in your browser...
start ..\frontend\index.html

echo.
echo Setup complete. The server is running in a separate window.