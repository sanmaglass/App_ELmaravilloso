@echo off
title Debug Dashboard
echo.
echo ================================================
echo       🔍 DIAGNÓSTICO DE DASHBOARD
echo ================================================
echo.
echo Instrucciones:
echo 1. Este script va a abrir la aplicación
echo 2. Presiona F12 para abrir DevTools
echo 3. Ve a la pestaña "Console" (Consola)
echo 4. Busca errores en ROJO
echo 5. Copia TODO el texto de la consola
echo.
echo Abriendo aplicación...
timeout /t 2 /nobreak >nul
start "" "c:\Users\sanma\OneDrive\Documentos\GitHub\el-maravilloso-final\index.html"
echo.
echo ✅ Aplicación abierta
echo.
echo IMPORTANTE: Presiona F12 y revisa la consola
echo.
pause
