@echo off
setlocal enabledelayedexpansion
cls

echo.
echo ===============================================================================
echo                  == SUBIDA A GITHUB - AUTOMATICA Y MEJORADA ==
echo ===============================================================================
echo.

REM =============================================================================
REM 1. VERIFICAR STATUS ACTUAL
REM =============================================================================

echo [*] ESTADO ACTUAL
echo -----------------------------------------------------------------------

for /f "tokens=*" %%A in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%A
for /f "tokens=*" %%A in ('git rev-list --count origin/!BRANCH!..HEAD 2^>nul ^| find "."') do set AHEAD=%%A

if "!AHEAD!"=="" set AHEAD=0

if !AHEAD! equ 0 (
  echo   [OK] Ya está sincronizado
  echo.
  timeout /t 3 >nul
  exit /b 0
)

echo   Rama: !BRANCH!
echo   Commits a subir: !AHEAD!
echo.

REM =============================================================================
REM 2. MOSTRAR COMMITS
REM =============================================================================

echo [>>] COMMITS A SUBIR
echo -----------------------------------------------------------------------

git log --oneline origin/!BRANCH!..HEAD --no-decorate

echo.

REM =============================================================================
REM 3. MOSTRAR ARCHIVOS MODIFICADOS
REM =============================================================================

echo [+] ARCHIVOS MODIFICADOS
echo -----------------------------------------------------------------------

for /f "tokens=1*" %%A in ('git diff origin/!BRANCH!...HEAD --name-status') do (
  if "%%A"=="A" (
    echo   [+] [NUEVO]     %%B
  ) else if "%%A"=="M" (
    echo   [*] [MODIFICADO] %%B
  ) else if "%%A"=="D" (
    echo   [-] [ELIMINADO]  %%B
  ) else (
    echo   [?] [%%A]      %%B
  )
)

echo.

REM =============================================================================
REM 4. ESTADÍSTICAS
REM =============================================================================

echo [=] ESTADÍSTICAS
echo -----------------------------------------------------------------------

git diff origin/!BRANCH!...HEAD --stat

echo.

REM =============================================================================
REM 5. SUBIR AUTOMATICAMENTE
REM =============================================================================

echo [>>] SUBIENDO A GITHUB...
echo -----------------------------------------------------------------------
echo.

git add . >nul 2>&1
git commit -m "Auto-commit: !AHEAD! cambios sincronizados" >nul 2>&1
git push origin !BRANCH! 2>&1

if !ERRORLEVEL! equ 0 (
  echo.
  echo ===============================================================================
  echo                        [OK] SUBIDA EXITOSA A GITHUB
  echo ===============================================================================
  echo.
  echo [=] RESUMEN:
  echo   Rama: !BRANCH!
  echo   Commits: !AHEAD!
  echo.
  echo [>>] GitHub:
  echo   https://github.com/sanmaglass/App_ELmaravilloso/commits/!BRANCH!
  echo.
  echo [OK] Tu proyecto está respaldado en GitHub
  echo.
  timeout /t 5 >nul
) else (
  echo.
  echo [ERROR] ERROR EN LA SUBIDA
  echo.
  timeout /t 5 >nul
  exit /b 1
)
