@echo off
title Zero FM TikTok Bot
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
echo ==========================================
echo    Iniciando Bot de Pedidos Zero FM
echo ==========================================
echo.

:main
echo === INICIO ===
echo Carpeta: "%CD%"
echo.

if not exist "index.js" (
  echo [ERROR] No se encontro index.js. Esta carpeta no parece ser tiktok-bot.
  exit /b 2
)

echo Node (verificacion):
where node
if errorlevel 1 (
  echo [ERROR] Node.js no esta disponible en PATH.
  exit /b 3
)
node -v
echo.

if not exist "node_modules" (
  if exist "node_modules.zip" (
    echo [INFO] node_modules no existe. Extrayendo node_modules.zip...
    where powershell >nul 2>&1
    if errorlevel 1 (
      echo [ERROR] Falta PowerShell para extraer node_modules.zip.
      exit /b 4
    )
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Expand-Archive -Force -Path 'node_modules.zip' -DestinationPath '.'"
    if errorlevel 1 (
      echo [ERROR] No se pudo extraer node_modules.zip.
      exit /b 5
    )
  ) else (
    echo [ERROR] Falta node_modules y no existe node_modules.zip.
    exit /b 6
  )
)

echo Abriendo panel de configuracion...
set "DASH_PORT=3000"
timeout /t 1 >nul
start http://localhost:%DASH_PORT%/
echo.

:loop
echo [INFO] Iniciando Bot...
node index.js
set "EXITCODE=%ERRORLEVEL%"
echo.
echo [ALERTA] El bot se cerro (codigo !EXITCODE!).
echo [INFO] Reiniciando en 5 segundos...
timeout /t 5
goto loop
