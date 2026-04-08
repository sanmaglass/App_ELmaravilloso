' ============================================================
' El Maravilloso — Silent Launcher
' Inicia el servidor Python sin ventana y abre el navegador
' ============================================================
Option Explicit

Dim oShell, sPath, sCmd

' Directorio del script
sPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

Set oShell = CreateObject("WScript.Shell")

' Matar instancia previa de Python en puerto 8000 (si existe)
oShell.Run "cmd /c taskkill /f /im python.exe >nul 2>&1", 0, True

' Iniciar servidor Python SIN ventana (0 = oculto)
sCmd = "cmd /c cd /d """ & sPath & """ && python -m http.server 8000"
oShell.Run sCmd, 0, False

' Esperar que el servidor arranque
WScript.Sleep 1200

' Abrir en el navegador predeterminado
oShell.Run "http://localhost:8000", 1, False

Set oShell = Nothing
WScript.Quit
