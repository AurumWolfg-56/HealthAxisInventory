Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\Enciende Inteligencia Norvexis.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)

' Path to the AI Gateway batch script
oLink.TargetPath = "R:\APPS\healthaxis-inventory-pwa\start-ai-gateway.bat"

' Set the working directory to the project folder so Python can find its files
oLink.WorkingDirectory = "R:\APPS\healthaxis-inventory-pwa"

' Add a nice description
oLink.Description = "Inicia LM Studio y Norvexis Whisper Gateway"

' Set icon to a generic Windows system robot/gear or cmd icon, here we use shell32.dll gears
oLink.IconLocation = "shell32.dll, 21"

oLink.Save

WScript.Echo "¡Éxito! Busca el nuevo icono de engranaje en tu Escritorio de Windows llamado 'Enciende Inteligencia Norvexis'."
