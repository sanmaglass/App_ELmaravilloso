@echo off
title Subir Cambios a GitHub
cd /d "%~dp0"
echo.
echo  =============================================
echo       SUBIENDO CAMBIOS A GITHUB
echo  =============================================
echo.
echo  Guardando todos los cambios...
git add .
echo.
set /p mensaje="Descripcion del cambio (Enter para omitir): "
if "%mensaje%"=="" set mensaje=Actualizacion general
git commit -m "%mensaje%"
echo.
echo  Enviando a GitHub...
git push origin main
echo.
if %errorlevel% neq 0 (
    echo  ERROR: No se pudieron subir los cambios.
    echo  Revisa tu conexion a internet.
) else (
    echo  LISTO! Cambios subidos correctamente.
    echo  Espera 2 minutos y recarga la app en el celular.
)
echo.
pause
