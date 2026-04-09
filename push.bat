@echo off
setlocal enabledelayedexpansion

REM ════════════════════════════════════════════════════════════════════════════
REM 🚀 SMART GIT PUSH SCRIPT - Windows Batch
REM Muestra información relevante antes/después de subir a GitHub
REM ════════════════════════════════════════════════════════════════════════════

cls

echo.
echo ╔══════════════════════════════════════════════════════════════════════════╗
echo ║                    🚀 GITHUB PUSH - INFORMACIÓN RELEVANTE               ║
echo ╚══════════════════════════════════════════════════════════════════════════╝
echo.

REM ─────────────────────────────────────────────────────────────────────────────
REM 1. VERIFICAR STATUS GIT
REM ─────────────────────────────────────────────────────────────────────────────

echo 📋 ESTADO GIT ACTUAL
echo ───────────────────────────────────────────────────────────────────────────

for /f "tokens=*" %%A in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%A
for /f "tokens=*" %%A in ('git config branch.!BRANCH!.remote') do set REMOTE=%%A

if "!REMOTE!"=="" set REMOTE=origin

echo   Rama actual: !BRANCH!
echo   Remote: !REMOTE!
echo.

REM ─────────────────────────────────────────────────────────────────────────────
REM 2. CAMBIOS SIN COMMITEAR
REM ─────────────────────────────────────────────────────────────────────────────

for /f "tokens=*" %%A in ('git status --short ^| find /c /v ""') do set UNCOMMITTED=%%A

if !UNCOMMITTED! gtr 0 (
  echo ⚠️  ADVERTENCIA: Hay !UNCOMMITTED! cambios sin commitear
  echo.
  git status --short
  echo.
  set /p CONTINUE="¿Continuar sin commitear? (s/n) "
  if /i not "!CONTINUE!"=="s" (
    echo ❌ Push cancelado
    exit /b 1
  )
  echo.
)

REM ─────────────────────────────────────────────────────────────────────────────
REM 3. COMMITS A SUBIR
REM ─────────────────────────────────────────────────────────────────────────────

echo 📦 COMMITS A SUBIR
echo ───────────────────────────────────────────────────────────────────────────

for /f "tokens=*" %%A in ('git rev-list --count origin/!BRANCH!..HEAD 2^>nul ^| find "."') do set AHEAD=%%A

if "!AHEAD!"=="" set AHEAD=0

if !AHEAD! equ 0 (
  echo   ✅ Ya está sincronizado ^(0 commits nuevos^)
  echo.
  exit /b 0
)

echo   Commits nuevos: !AHEAD!
echo.

git log --oneline origin/!BRANCH!..HEAD --no-decorate

echo.

REM ─────────────────────────────────────────────────────────────────────────────
REM 4. CAMBIOS POR ARCHIVO
REM ─────────────────────────────────────────────────────────────────────────────

echo 📁 ARCHIVOS MODIFICADOS
echo ───────────────────────────────────────────────────────────────────────────

for /f "tokens=1*" %%A in ('git diff origin/!BRANCH!...HEAD --name-status') do (
  if "%%A"=="A" (
    echo   ✨ [NUEVO]     %%B
  ) else if "%%A"=="M" (
    echo   📝 [MODIFICADO] %%B
  ) else if "%%A"=="D" (
    echo   🗑️  [ELIMINADO]  %%B
  ) else if "%%A"=="R" (
    echo   🔄 [RENOMBRADO] %%B
  ) else (
    echo   ❓ [%%A]      %%B
  )
)

echo.

REM ─────────────────────────────────────────────────────────────────────────────
REM 5. ESTADÍSTICAS
REM ─────────────────────────────────────────────────────────────────────────────

echo 📊 ESTADÍSTICAS
echo ───────────────────────────────────────────────────────────────────────────

git diff origin/!BRANCH!...HEAD --stat

echo.

REM ─────────────────────────────────────────────────────────────────────────────
REM 6. ÚLTIMO COMMIT
REM ─────────────────────────────────────────────────────────────────────────────

echo 📌 ÚLTIMO COMMIT
echo ───────────────────────────────────────────────────────────────────────────

git log -1 --format="  %%h - %%s (%%an, %%ar)"

echo.

REM ─────────────────────────────────────────────────────────────────────────────
REM 7. CONFIRMACIÓN
REM ─────────────────────────────────────────────────────────────────────────────

echo ═══════════════════════════════════════════════════════════════════════════
set /p CONFIRM="✅ ¿Subir !AHEAD! commit(s) a GitHub? (s/n) "

if /i not "!CONFIRM!"=="s" (
  echo ❌ Push cancelado
  exit /b 1
)

echo.

REM ─────────────────────────────────────────────────────────────────────────────
REM 8. EJECUTAR PUSH
REM ─────────────────────────────────────────────────────────────────────────────

echo 🚀 SUBIENDO A GITHUB...
echo ───────────────────────────────────────────────────────────────────────────
echo.

REM Registrar tiempo
for /f "tokens=*" %%A in ('powershell -Command "[int][double]::Parse((Get-Date -UFormat %%s))"') do set START_TIME=%%A

git push origin !BRANCH!

if !ERRORLEVEL! equ 0 (
  for /f "tokens=*" %%A in ('powershell -Command "[int][double]::Parse((Get-Date -UFormat %%s))"') do set END_TIME=%%A
  set /a DURATION=!END_TIME!-!START_TIME!

  echo.
  echo ╔══════════════════════════════════════════════════════════════════════════╗
  echo ║                        ✅ PUSH EXITOSO                                   ║
  echo ╚══════════════════════════════════════════════════════════════════════════╝
  echo.
  echo 📊 RESUMEN:
  echo   Rama: !BRANCH!
  echo   Commits: !AHEAD!
  echo   Destino: origin
  echo   Tiempo: !DURATION!s
  for /f "tokens=*" %%A in ('powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do echo   Timestamp: %%A
  echo.
  echo 🔗 GitHub:
  echo   https://github.com/sanmaglass/App_ELmaravilloso/commits/!BRANCH!
  echo.
  exit /b 0
) else (
  echo.
  echo ❌ ERROR: Falló el push a GitHub
  echo.
  echo Posibles causas:
  echo   • Sin internet
  echo   • Credenciales inválidas
  echo   • Conflicto de ramas
  echo.
  exit /b 1
)
