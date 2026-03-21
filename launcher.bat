@echo off
cd /d "C:\Users\sanma\OneDrive\Documentos\GitHub\el-maravilloso-final"
start "" python -m http.server 8000
timeout /t 2 >nul
start http://localhost:8000
exit
