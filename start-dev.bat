@echo off
title KKTS POS Development Server
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
& "C:\Program Files\nodejs\npm.cmd" run dev
