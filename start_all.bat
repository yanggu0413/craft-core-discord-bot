@echo off
title Craft-Core Services Control Panel
echo ===================================================
echo   Craft-Core Services Startup Script (PM2)
echo ===================================================
echo.

:: Check if PM2 is installed
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PM2 is not installed or not in PATH.
    echo Please install PM2 globally: npm install -g pm2
    echo.
    pause
    exit /b 1
)

echo [1/4] Cleaning existing PM2 processes...
call pm2 delete craft-core-bot >nul 2>nul
call pm2 delete craft-core-backend >nul 2>nul
call pm2 delete craft-core-frontend >nul 2>nul
echo.

echo [2/4] Starting Discord Bot...
call pm2 start src/index.js --name craft-core-bot --cwd discord-bot
echo.

echo [3/4] Starting Web Dashboard Backend...
call pm2 start npm --name craft-core-backend --cwd web-dashboard/backend -- run dev
echo.

echo [4/4] Starting Web Dashboard Frontend...
call pm2 start npm --name craft-core-frontend --cwd web-dashboard/frontend -- run dev
echo.

echo ===================================================
echo   All services have been registered under PM2!
echo   Use "pm2 status" to monitor process states.
echo   Use "pm2 logs" to view real-time logs.
echo ===================================================
echo.
pause
