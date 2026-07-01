@echo off
title Estudio de Contenido - El Maravilloso
cd /d "%~dp0studio"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

rem Si el estudio ya esta corriendo, solo abre el navegador y sale.
powershell -NoProfile -Command "try{ Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:8000' | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  echo.
  echo   El Estudio ya estaba corriendo. Abriendo navegador...
  start "" http://127.0.0.1:8000
  timeout /t 2 >nul
  exit /b
)

echo.
echo   Iniciando Estudio de Contenido...
echo   Se abrira solo en tu navegador (http://127.0.0.1:8000)
echo   Deja esta ventana abierta mientras lo usas. Cierra con Ctrl+C.
echo.
python server.py
pause
