@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut(\"$d\Jarvis.lnk\"); $s.TargetPath='%~dp0Demarrer-Jarvis.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0public\jarvis.ico'; $s.WindowStyle=7; $s.Description='Demarrer Jarvis'; $s.Save()"
if errorlevel 1 (
  echo Le raccourci n'a pas pu etre cree.
) else (
  echo Raccourci "Jarvis" cree sur ton Bureau.
)
pause
