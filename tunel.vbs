Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Dim dir : dir = fso.GetParentFolderName(WScript.ScriptFullName)

' Salva URL fixa permanente
Dim urlFile : urlFile = dir & "\logs\tunnel_url.txt"
Set f = fso.OpenTextFile(urlFile, 2, True)
f.WriteLine "https://wazap.rhimob.com.br"
f.Close

' Inicia túnel nomeado (URL permanente, não muda nunca)
WshShell.Run "cmd /c cd /d """ & dir & """ && cloudflared.exe tunnel run wazap >> logs\tunel.log 2>&1", 0, False
