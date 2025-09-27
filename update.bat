@echo off
chcp 65001 > nul

:: BatchGotAdmin
:-------------------------------------
REM  --> Check for permissions
set "params=%*"
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set objShell = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo objShell.ShellExecute "%~s0", "%params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"
    setlocal enabledelayedexpansion
:--------------------------------------

echo.
title INZO Winner App Updater
color 0B
echo =================================================
echo      INZO Winner App Updater
echo =================================================
echo.

echo [1/4] Stopping any running server on port 3000...
set "server_found=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    set "server_found=true"
    echo Attempting to stop server process (PID: %%a)...
    taskkill /F /PID %%a > nul 2>&1
    if !errorlevel! equ 0 (
        echo   -> Server process stopped successfully.
    ) else (
        echo   -> Could not stop server process. It might require admin rights.
    )
)
if "%server_found%"=="false" (
    echo No running server found on port 3000.
)
echo.

echo [2/4] Pulling latest updates from the remote repository...
where git >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] Git is not installed or not in your system's PATH.
    echo Please install Git to use the updater.
    pause
    exit /b 1
)
git pull origin main
if !errorlevel! neq 0 (
    echo [ERROR] Failed to pull updates from Git. Please check your internet connection and Git setup.
    pause
    exit /b 1
)
echo.

echo [3/4] Installing/updating dependencies...
cd backend
npm install
if !errorlevel! neq 0 (
    echo [ERROR] 'npm install' failed. Please check your internet connection or antivirus settings.
    cd ..
    pause
    exit /b 1
)
cd ..
echo.

echo [4/4] Update complete. Restarting the server...
echo.
start "" "start-server.bat"

echo Update process finished. The server is restarting in a new window.
pause