@echo off
echo Abriendo aplicacion...
@echo off
echo Iniciando servidor local para evitar errores de red...
start "" python -m http.server 8000
timeout /t 2 >nul
start http://localhost:8000
exit
