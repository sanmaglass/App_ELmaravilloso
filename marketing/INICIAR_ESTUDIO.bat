@echo off
title Estudio de Contenido - El Maravilloso
cd /d "%~dp0studio"
echo.
echo   Iniciando Estudio de Contenido...
echo   Se abrira solo en tu navegador (http://127.0.0.1:8000)
echo   Deja esta ventana abierta mientras lo usas. Cierra con Ctrl+C.
echo.
python server.py
pause
