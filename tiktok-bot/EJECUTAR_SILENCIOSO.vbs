Set WshShell = CreateObject("WScript.Shell")
strPath = WshShell.CurrentDirectory & "\INICIAR_BOT.bat"
WshShell.Run chr(34) & strPath & chr(34), 0
Set WshShell = Nothing
