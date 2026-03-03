@echo off
setlocal enabledelayedexpansion
cls
echo =========================================
echo   SINCRONIZANDO CON GITHUB...
echo =========================================
echo.

:: 1. Traer cambios remotos por si editaste desde otra PC o el celular
echo [1/4] ACTUALIZANDO DESDE GITHUB (git pull)
git pull >nul 2>&1
echo.

:: 2. Buscar el ultimo numero de cambio
set "LAST_MSG="
for /f "delims=" %%i in ('git log -1 --pretty^=%%B 2^>nul') do (
    if not defined LAST_MSG set "LAST_MSG=%%i"
)

set "NEXT_NUM=1"
echo !LAST_MSG! | findstr /i /b /c:"CAMBIO " >nul
if !errorlevel! equ 0 (
    for /f "tokens=2" %%a in ("!LAST_MSG!") do (
        set "LAST_NUM=%%a"
        set /a NEXT_NUM=LAST_NUM+1
    )
)

:: Obtener la fecha corta actual
for /f "tokens=1-3 delims=/" %%a in ("%date%") do (set "HOY=%%a/%%b/%%c")
set "COMMIT_MSG=CAMBIO !NEXT_NUM! - %HOY%"

echo Preparando: "%COMMIT_MSG%"
echo.

:: 3. Subir cambios
echo [2/4] GUARDANDO ARCHIVOS (git add)
git add .
echo.

echo [3/4] CREANDO VERSION (git commit)
git commit -m "%COMMIT_MSG%" >nul 2>&1
echo.

echo [4/4] SUBIENDO A INTERNET (git push)
git push
echo.

echo =========================================
echo   !LISTO! TU APP ESTA RESPALDADA Y ONLINE
echo =========================================
timeout /t 5
