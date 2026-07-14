@echo off
echo ===================================================
echo   Craft-Core Shop & Dashboard Production Startup Script
echo ===================================================
echo.

echo [1/6] Stopping existing PM2 processes...
call pm2 delete craft-core-bot >nul 2>nul
call pm2 delete craft-core-backend >nul 2>nul
call pm2 delete craft-core-frontend >nul 2>nul
echo.

echo [2/6] Building Backend...
cd web-dashboard\backend
call npm run build
cd ..\..
echo.

echo [3/6] Building Frontend...
cd web-dashboard\frontend
call npm run build
cd ..\..
echo.

echo [4/6] Starting Discord Bot...
call pm2 start src/index.js --name craft-core-bot --cwd discord-bot
echo.

echo [5/6] Starting Web Dashboard Backend (Prod)...
call pm2 start dist/server.js --name craft-core-backend --cwd web-dashboard/backend
echo.

echo [6/6] Serving Web Dashboard Frontend (Prod)...
call pm2 serve web-dashboard/frontend/dist 5173 --spa --name craft-core-frontend
echo.

echo ===================================================
echo   All production services are running under PM2!
echo   Use "pm2 status" to monitor process states.
echo   Use "pm2 logs" to view real-time logs.
echo ===================================================
echo.
pause
