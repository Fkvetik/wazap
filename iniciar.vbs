Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Dim dir : dir = fso.GetParentFolderName(WScript.ScriptFullName)

' Garante que não há outro node rodando antes de iniciar
WshShell.Run "taskkill /F /IM node.exe", 0, True
WScript.Sleep 2000

WshShell.Run "cmd /c cd /d """ & dir & """ && node src\index.js >> logs\wazap.log 2>&1", 0, False
