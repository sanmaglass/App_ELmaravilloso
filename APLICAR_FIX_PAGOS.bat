@echo off
title Aplicar Correcci\u00f3n de Pagos
color 0A
echo.
echo ================================================
echo       \ud83d\udd27 APLICANDO CORRECCI\u00d3N
echo ================================================
echo.
echo Este script va a:
echo 1. Hacer backup de utils.js
echo 2. Aplicar la correcci\u00f3n de c\u00e1lculo de pagos
echo.
pause

cd /d "%~dp0"

echo Creando backup...
copy "js\utils.js" "js\utils.js.backup" >nul
echo \u2705 Backup creado: js\ut utils.js.backup

echo.
echo Aplicando correcci\u00f3n...
powershell -ExecutionPolicy Bypass -File "aplicar_fix.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo       \u2705 CORRECCI\u00d3N APLICADA
    echo ================================================
    echo.
    echo SIGUIENTE PASO:
    echo 1. Ejecuta LIMPIAR_CACHE.bat
    echo 2. Prueba la aplicaci\u00f3n
    echo.
) else (
    echo.
    echo \u274c Error al aplicar correcci\u00f3n
    echo Se mantuvo el archivo original
    echo.
)

pause
