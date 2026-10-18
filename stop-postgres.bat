@echo off
title Stop PostgreSQL 18 Server
echo ========================================================
echo  🛑 STOPPING POSTGRESQL 18 SERVER
echo ========================================================

"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\18\data" stop -m fast

echo.
echo PostgreSQL server stopped.
timeout /t 5
