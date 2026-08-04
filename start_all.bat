@echo off
title Craft-Core Services Manager
echo ===================================================
echo   Craft-Core Production Services Startup Script
echo ===================================================
echo.

echo Checking environment prerequisites...
where pm2 >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PM2 is not installed or not in PATH!
    echo Please install PM2 globally via: npm install -g pm2
    pause
    exit /b 1
)
echo PM2 is available.
echo.

echo [1/2] Stopping existing PM2 processes...
call pm2 delete craft-core-bot >nul 2>nul
:: Clean up old deprecated PM2 processes if they exist
call pm2 delete craft-core-backend >nul 2>nul
call pm2 delete craft-core-frontend >nul 2>nul
call pm2 delete craft-core-docs >nul 2>nul
echo.

echo [2/2] Starting PM2 Daemons...
echo Starting Discord Bot (WebSocket Server & SQLite Database)...
call pm2 start src/index.js --name craft-core-bot --cwd discord-bot
echo.

echo ===================================================
echo   All production services are running under PM2!
echo.
echo   * Discord Bot & WebSocket Server: Managed by PM2 (craft-core-bot)
echo   * SQLite Database: discord-bot/src/database/database.db
echo.
echo   Useful Commands:
echo   - Monitor: pm2 status
echo   - Logs:    pm2 logs
echo   - Restart: pm2 restart all
echo ===================================================
echo.
pause
