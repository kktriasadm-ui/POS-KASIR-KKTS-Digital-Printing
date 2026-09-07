@echo off
title KKTS DIGITAL PRINTING - Reset Password Admin
color 0E

echo =========================================================
echo    KKTS DIGITAL PRINTING - RESET AKUN ADMIN
echo =========================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo Menjalankan proses reset akun admin...
echo.

cmd /c "npx.cmd tsx server/scripts/resetAdmin.ts"

echo.
echo =========================================================
echo  Selesai! Silakan gunakan username dan password di atas
echo  untuk login kembali ke aplikasi KKTS Digital Printing.
echo =========================================================
echo.
pause
