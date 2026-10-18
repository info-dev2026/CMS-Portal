@echo off
title PostgreSQL 18 Server Launcher
echo ========================================================
echo  ⚡ STARTING POSTGRESQL 18 SERVER
echo ========================================================

REM Check if stale postmaster.pid exists when process is not running
if exist "C:\Program Files\PostgreSQL\18\data\postmaster.pid" (
    tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL | find /I /N "postgres.exe">NUL
    if "%ERRORLEVEL%"=="1" (
        echo [INFO] Removing stale postmaster.pid lock file...
        del /F /Q "C:\Program Files\PostgreSQL\18\data\postmaster.pid"
    )
)

"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\18\data" start

echo.
echo ========================================================
echo  PostgreSQL Server Status:
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\18\data" status
echo ========================================================
echo Port: 5432
echo Database: cms_backend
echo.
timeout /t 5
