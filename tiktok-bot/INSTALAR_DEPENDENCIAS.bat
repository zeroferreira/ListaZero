@echo off
title Instalar Dependencias - Zero FM TikTok Bot
setlocal EnableExtensions
cd /d "%~dp0"
echo ==========================================
echo    INSTALAR DEPENDENCIAS (node_modules)
echo ==========================================
echo.

if not exist "package.json" (
  echo [ERROR] No se encontro package.json. Abre este archivo dentro de tiktok-bot.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta disponible en PATH.
  echo Instala Node.js LTS y reinicia la PC.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm no esta disponible en PATH.
  echo Reinstala Node.js LTS (incluye npm) y reinicia la PC.
  pause
  exit /b 1
)

echo Node:
node -v
echo.

echo NPM:
npm -v
echo.

echo [INFO] Instalando dependencias...
echo Si falla con "No se esperaba .", npm esta roto en Windows y debes reinstalar Node.js LTS.
echo.

call npm install --no-audit --no-fund

if errorlevel 1 (
  echo.
  echo [ERROR] No se pudieron instalar las dependencias.
  echo Recomendado: reinstalar Node.js LTS y reiniciar la PC.
  pause
  exit /b 1
)

echo.
echo [EXITO] Dependencias instaladas.
echo Ahora abre INICIAR_BOT.bat
echo.
pause
endlocal
