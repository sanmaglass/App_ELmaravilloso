@echo off
title El Maravilloso - Launcher
cd /d "%~dp0"

echo.
echo ============================================================
echo               EL MARAVILLOSO - INICIANDO
echo ============================================================
echo.
echo  PC  (este computador) : http://localhost:8000
echo  MOVIL / WEB           : https://el-maravilloso-final.vercel.app
echo.
echo ============================================================
echo.
echo  Abriendo servidor local y navegador...
echo.

wscript.exe "%~dp0launcher.vbs"

timeout /t 3 >nul
exit
