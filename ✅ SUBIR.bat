@echo off
setlocal enabledelayedexpansion
cls

:: Secuencias de escape de colores ANSI
set "ESC="
set "RED=%ESC%[91m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "BLUE=%ESC%[96m"
set "RESET=%ESC%[0m"

echo %BLUE%=========================================%RESET%
echo %GREEN%  SINCRONIZANDO CON GITHUB...%RESET%
echo %BLUE%=========================================%RESET%
echo.

:: 1. Traer cambios remotos
echo %YELLOW%[1/4] ACTUALIZANDO DESDE GITHUB (git pull)%RESET%
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

echo %YELLOW%Preparando commit:%RESET% %RED%^"%COMMIT_MSG%^"%RESET%
echo.

:: 3. Subir cambios
echo %YELLOW%[2/4] GUARDANDO ARCHIVOS (git add)%RESET%
git add .
echo.

echo %YELLOW%[3/4] CREANDO VERSION (git commit)%RESET%
git commit -m "!COMMIT_MSG!" >nul 2>&1
echo.

echo %YELLOW%[4/4] SUBIENDO A INTERNET (git push)%RESET%
git push
echo.

echo %GREEN%=========================================%RESET%
echo %GREEN%  !LISTO! TU APP ESTA RESPALDADA ONLINE%RESET%
echo %GREEN%  SE GUARDO COMO:%RESET% %RED%!COMMIT_MSG!%RESET%
echo %GREEN%=========================================%RESET%
echo.
echo %BLUE%La ventana se cerrara sola en 10 segundos...%RESET%
timeout /t 10 >nul
