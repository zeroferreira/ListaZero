@echo off
title Zero FM TikTok Bot
setlocal EnableExtensions
cd /d "%~dp0"
echo ==========================================
echo    Iniciando Bot de Pedidos Zero FM
echo ==========================================
echo.

if not exist "index.js" (
    echo [ERROR] No se encontro index.js. Esta carpeta no parece ser tiktok-bot.
    echo Abre este archivo dentro de la carpeta correcta del bot.
    pause
    exit /b 1
)

echo Node:
node -v
if errorlevel 1 (
    echo [ERROR] Node.js no esta disponible. Instala Node.js LTS (incluye npm).
    pause
    exit /b 1
)

echo NPM:
npm -v
if errorlevel 1 (
    echo [ERROR] npm no esta disponible. Reinstala Node.js (con npm).
    pause
    exit /b 1
)

:: Instalar dependencias si no existen
if not exist "node_modules" (
    echo [INFO] Primera vez iniciando. Instalando librerias necesarias...
    echo Esto puede tardar unos minutos. Por favor espera.
    if exist "package-lock.json" (
        call npm ci --no-audit --no-fund
    ) else (
        call npm install --no-audit --no-fund
    )
    if errorlevel 1 (
        echo [ERROR] Instalacion de dependencias fallo.
        pause
        exit /b 1
    )
)

:: Auto-reparar dependencias si faltan (por updates)
if not exist "node_modules\socket.io\package.json" (
    echo [INFO] Actualizando librerias (socket.io faltante)...
    if exist "package-lock.json" (
        call npm ci --no-audit --no-fund
    ) else (
        call npm install --no-audit --no-fund
    )
    if errorlevel 1 (
        echo [ERROR] Instalacion de dependencias fallo.
        pause
        exit /b 1
    )
)
if not exist "node_modules\firebase\package.json" (
    echo [INFO] Actualizando librerias (firebase faltante)...
    if exist "package-lock.json" (
        call npm ci --no-audit --no-fund
    ) else (
        call npm install --no-audit --no-fund
    )
    if errorlevel 1 (
        echo [ERROR] Instalacion de dependencias fallo.
        pause
        exit /b 1
    )
)

:: Abrir Dashboard
echo Abriendo panel de configuracion...
set "DASH_PORT=3000"
timeout /t 1 >nul
start http://localhost:%DASH_PORT%/

:: Iniciar el bot con reconexion automatica
:loop
echo [INFO] Iniciando Bot...
node index.js
echo.
echo [ALERTA] El bot se cerro inesperadamente.
echo [INFO] Reiniciando en 5 segundos...
timeout /t 5
goto loop
