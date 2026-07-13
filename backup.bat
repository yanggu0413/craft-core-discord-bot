@echo off
title Craft-Core Server Backup Tool
echo ===================================================
echo   Craft-Core Server Data Backup Utility
echo ===================================================
echo.

:: Define backup directory (You can change this to your USB drive, Google Drive sync folder, or NAS mount)
set BACKUP_DIR=C:\Server_Backups

:: Get current date and time for filename (YYYYMMDD_HHMMSS)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

set TARGET_FOLDER=%BACKUP_DIR%\Backup_%TIMESTAMP%

echo [1/3] Creating backup directory at: %TARGET_FOLDER%
mkdir "%TARGET_FOLDER%" >nul 2>nul
echo.

echo [2/3] Backing up Minecraft Mod Databases...
:: Minecraft config files (adjust target path if your server run directory is different)
if exist "fabric-mod\config\craft-core-shop" (
    mkdir "%TARGET_FOLDER%\minecraft_configs"
    xcopy /S /E /Y "fabric-mod\config\craft-core-shop" "%TARGET_FOLDER%\minecraft_configs\" >nul
    echo      [SUCCESS] Minecraft databases backed up.
) else (
    echo      [WARNING] Minecraft data directory not found in default path. Skipping.
)
echo.

echo [3/3] Backing up Discord Bot Databases...
:: SQLite databases
if exist "discord-bot\db_web_dashboard.db" (
    mkdir "%TARGET_FOLDER%\discord_bot"
    copy /Y "discord-bot\db_web_dashboard.db" "%TARGET_FOLDER%\discord_bot\" >nul
    echo      [SUCCESS] Discord Bot SQLite database backed up.
) else (
    echo      [WARNING] Discord Bot database not found. Skipping.
)
echo.

echo ===================================================
echo   Backup completed successfully!
echo   Target: %TARGET_FOLDER%
echo ===================================================
echo.
pause
