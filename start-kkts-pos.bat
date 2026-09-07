@echo off
title KKTS DIGITAL PRINTING - POS System Launcher
color 0B

echo =========================================================
echo    KKTS DIGITAL PRINTING - POS & MANAGEMENT SYSTEM
echo =========================================================
echo.
echo [1/3] Menyiapkan environment Node.js...
set "PATH=C:\Program Files\nodejs;%PATH%"

cd /d "%~dp0"

echo [2/3] Menjalankan Server POS (SQLite Offline-First)...
start /b cmd /c "npx.cmd tsx server/index.ts"

echo [3/3] Menunggu server siap...
timeout /t 3 /nobreak > nul

echo.
echo =========================================================
echo  Sistem POS siap digunakan pada: http://localhost:3001
echo  Username Admin : admin    ^| Password: admin123
echo  Username Kasir : kasir1   ^| Password: kasir123
echo =========================================================
echo.

:: Coba buka Chrome dalam mode app/kiosk jika ada, atau default browser
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3001
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:3001
) else (
    start http://localhost:3001
)

echo Aplikasi KKTS Digital Printing sedang berjalan di latar belakang.
echo Jangan tutup jendela ini selama kasir beroperasi.
echo.
pause
