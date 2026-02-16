@echo off
cd /d "%~dp0"
echo -------------------------------------------
echo      SUBIENDO CAMBIOS A LA NUBE (V2)
echo -------------------------------------------
echo.
echo 1. Guardando archivos...
git add .
echo.
echo 2. Creando version...
git commit -m "Actualizacion V2.62 (Gastos y Ventas Diarias)"
echo.
echo 3. Enviando a GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo.
    echo !!!!!!!!!!!!! ERROR !!!!!!!!!!!!!
    echo No se pudieron subir los cambios.
    echo Revisa tu conexion a internet o si hay conflictos.
    echo.
) else (
    echo.
    echo -------------------------------------------
    echo      EXITO: CAMBIOS EN LA NUBE
    echo -------------------------------------------
)
echo.
echo AHORA:
echo 1. Espera 2 minutos.
echo 2. Abre la app en tu celular.
echo 3. IMPORTANTE: Si no ves cambios, cierra y abre la app 2 veces.
echo.
pause
