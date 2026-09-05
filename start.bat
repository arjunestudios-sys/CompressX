@echo off
title CompressX — Dev Server
color 0A

echo.
echo  ============================================
echo   CompressX — Starting Development Server
echo  ============================================
echo.

:: ── Check Node.js ────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Download it from: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% found.

:: ── Check if node_modules exists ─────────────────────────────
if not exist "%~dp0node_modules\" (
    echo.
    echo  [INFO] node_modules not found. Installing dependencies...
    echo  This may take a minute on first run.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo  [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Dependencies installed.
)

:: ── Check if .env exists ──────────────────────────────────────
if not exist "%~dp0backend\.env" (
    echo.
    echo  [WARN] backend\.env not found.
    if exist "%~dp0backend\.env.example" (
        echo  Copying from backend\.env.example...
        copy "%~dp0backend\.env.example" "%~dp0backend\.env" >nul
        echo  [OK] backend\.env created. Edit it with your secrets.
    ) else (
        echo  [WARN] No .env.example found either. Server may use defaults.
    )
)

:: ── Create storage folders if missing ────────────────────────
if not exist "%~dp0backend\storage\uploads\"     mkdir "%~dp0backend\storage\uploads"
if not exist "%~dp0backend\storage\converted\"   mkdir "%~dp0backend\storage\converted"
if not exist "%~dp0backend\storage\compressed\"  mkdir "%~dp0backend\storage\compressed"
if not exist "%~dp0backend\storage\temp\"        mkdir "%~dp0backend\storage\temp"

:: ── Start the server ─────────────────────────────────────────
echo.
echo  [INFO] Starting CompressX backend + frontend server...
echo  [INFO] Open your browser at: http://localhost:5000
echo.
echo  Press Ctrl+C to stop the server.
echo  ============================================
echo.

:: Use nodemon if available, else fallback to node
where nodemon >nul 2>&1
if %errorlevel% equ 0 (
    echo  [INFO] Using nodemon (auto-restart on file changes)
    echo.
    cd /d "%~dp0"
    nodemon backend/server.js
) else (
    echo  [INFO] Using node (install nodemon for auto-restart: npm i -g nodemon)
    echo.
    cd /d "%~dp0"
    node backend/server.js
)

:: ── If server exits ───────────────────────────────────────────
echo.
echo  [INFO] Server stopped.
pause
