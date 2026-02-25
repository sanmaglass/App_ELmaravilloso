@echo off
title SUBIR CAMBIOS - EL MARAVILLOSO 2026
cd /d "%~dp0"
echo.
echo  =============================================
echo       EL MARAVILLOSO - SUBIR CAMBIOS (v2.0)
echo  =============================================
echo.
echo  Guardando todos los cambios...
git add .
echo.
set /p mensaje="Descripcion del cambio (Enter para omitir): "
if "%mensaje%"=="" set mensaje=Actualizacion general 2026
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
    echo  La maquinaria esta actualizada.
    echo  Espera 1 minuto y recarga la app.
)
echo.
pause
