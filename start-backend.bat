@echo off
title CompressX — Backend Server
color 0B

echo.
echo  =============================================
echo   CompressX — Backend Server (Port 5000)
echo  =============================================
echo.

:: ── Check Node.js ─────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js not found. Download: https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

:: ── Kill anything on port 5000 ────────────────────────────────
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING" 2^>nul') do (
    echo  [INFO] Killing process %%a on port 5000...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:: ── Install backend deps if missing ──────────────────────────
if not exist "%~dp0node_modules\" (
    echo  [INFO] Installing dependencies...
    cd /d "%~dp0"
    call npm install
)

:: ── Ensure backend/.env ───────────────────────────────────────
if not exist "%~dp0backend\.env" (
    if exist "%~dp0backend\.env.example" (
        copy "%~dp0backend\.env.example" "%~dp0backend\.env" >nul
        echo  [OK] Created backend\.env from example.
    )
)

:: ── Create storage folders ────────────────────────────────────
if not exist "%~dp0backend\storage\uploads\"    mkdir "%~dp0backend\storage\uploads"
if not exist "%~dp0backend\storage\converted\"  mkdir "%~dp0backend\storage\converted"
if not exist "%~dp0backend\storage\compressed\" mkdir "%~dp0backend\storage\compressed"
if not exist "%~dp0backend\storage\temp\"       mkdir "%~dp0backend\storage\temp"

:: ── Start backend ─────────────────────────────────────────────
echo.
echo  [INFO] Starting backend on http://localhost:5000
echo  [INFO] Press Ctrl+C to stop.
echo.

cd /d "%~dp0"
where nodemon >nul 2>&1
if %errorlevel% equ 0 (
    nodemon backend/server.js
) else (
    node backend/server.js
)

echo.
echo  [INFO] Backend stopped.
pause
