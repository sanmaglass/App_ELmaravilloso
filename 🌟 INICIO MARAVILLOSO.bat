@echo off
title El Maravilloso - Sistema de Gestión
color 0A
echo.
echo ================================================
echo         🌟 EL MARAVILLOSO 🌟
echo      Sistema de Gestión Empresarial
echo ================================================
echo.
echo Iniciando aplicación...
echo.
timeout /t 1 /nobreak >nul
start "" "%~dp0index.html"
echo.
echo ✅ Aplicación abierta en tu navegador
echo.
echo Puedes cerrar esta ventana.
timeout /t 2 /nobreak >nul
exit
