@echo off
title CompressX — Launcher
color 0A

echo.
echo  ============================================
echo   CompressX — Full Stack Launcher
echo  ============================================
echo.
echo  Opening backend server in a new terminal...
echo.

:: Open backend in its own window
start "CompressX Backend" cmd /k "cd /d "%~dp0" && start-backend.bat"

:: Small delay so backend can claim port 5000 first
timeout /t 3 /nobreak >nul

echo  [OK] Backend terminal launched.
echo.
echo  [INFO] Frontend is served by the backend at:
echo         http://localhost:5000
echo.
echo  Open your browser at: http://localhost:5000
echo.
echo  Both servers run in their own windows.
echo  Close those windows (or press Ctrl+C inside them) to stop.
echo.
pause
