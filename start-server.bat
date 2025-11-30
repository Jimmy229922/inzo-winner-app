@echo off
echo ========================================
echo   INZO Winner App - Starting Server
echo ========================================
echo.

:: Change to backend directory
cd backend

:: Start the server
echo Starting backend server...
start "" "http://localhost:30001"
node server.js

pause
