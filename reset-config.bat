@echo off
chcp 65001 > nul
title Reset Configuration
color 0C

REM Set the current directory to the script's location for reliable paths
cd /d "%~dp0"

echo =================================================================
echo  Resetting System Configuration
echo =================================================================
echo.

IF EXIST "backend\.env" (
    echo Deleting existing configuration file (backend\.env)...
    del "backend\.env"
    echo [OK] Configuration has been reset.
    echo.
    echo You can now run 'setup.bat' to create a new configuration.
) ELSE (
    echo No configuration file (backend\.env) found. Nothing to do.
)

echo.
pause