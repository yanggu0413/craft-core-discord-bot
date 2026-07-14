@echo off
echo ===================================================
echo   Craft-Core Shop & Dashboard Production Startup Script
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

echo [1/8] Stopping existing PM2 processes...
call pm2 delete craft-core-bot >nul 2>nul
call pm2 delete craft-core-backend >nul 2>nul
call pm2 delete craft-core-frontend >nul 2>nul
call pm2 delete craft-core-docs >nul 2>nul
echo.

echo [2/8] Building Backend...
cd web-dashboard\backend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend build failed!
    cd ..\..
    pause
    exit /b %ERRORLEVEL%
)
cd ..\..
echo.

echo [3/8] Building Frontend...
cd web-dashboard\frontend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed!
    cd ..\..
    pause
    exit /b %ERRORLEVEL%
)
cd ..\..
echo.

echo [4/8] Building Wiki Documentation (VitePress)...
cd docs
call npm run docs:build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Wiki Documentation build failed!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..
echo.

echo [5/8] Building Portal Website (Next.js)...
cd website
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Portal Website build failed!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..
echo.

echo [6/8] Starting Discord Bot...
call pm2 start src/index.js --name craft-core-bot --cwd discord-bot
echo.

echo [7/8] Starting Web Dashboard Backend (Prod)...
call pm2 start dist/server.js --name craft-core-backend --cwd web-dashboard/backend
echo.

echo [8/8] Serving Web Dashboard Frontend (Prod)...
call pm2 serve web-dashboard/frontend/dist 5173 --spa --name craft-core-frontend
echo.

echo ===================================================
echo   All production services are running under PM2!
echo   * Dashboard Frontend is served on port 5173
echo   * Portal Website and Wiki Docs can be served directly by Caddy
echo.
echo   Use "pm2 status" to monitor process states.
echo   Use "pm2 logs" to view real-time logs.
echo ===================================================
echo.
pause
