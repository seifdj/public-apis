@echo off
chcp 65001 >nul
title J.A.R.V.I.S.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js n'est pas encore installe sur cet ordinateur.
  echo  La page de telechargement va s'ouvrir : installe la version LTS,
  echo  puis relance ce fichier.
  echo.
  start "" https://nodejs.org/fr/download
  pause
  exit /b 1
)
if not exist "node_modules\@anthropic-ai\sdk" (
  echo  Premiere utilisation : installation des composants, patiente un instant...
  call npm install --omit=dev --no-audit --no-fund
)
node server.js
if errorlevel 1 pause
